const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments");
const DEPLOYMENTS_PATH = path.join(DEPLOYMENTS_DIR, "contracts.json");
const DEFAULT_POOL_CONFIG = {
  fee: 3000,
  tickSpacing: 60,
  tickLower: -600,
  tickUpper: 600,
  sqrtPriceLowerX96: 39614081257132168796771975168n,
  sqrtPriceUpperX96: 118842243771396506390315925504n,
  initialSqrtPriceX96: 79228162514264337593543950336n,
};

function env(key, fallback = "") {
  return (process.env[key] ?? fallback).trim();
}

function envBool(key, fallback = false) {
  const value = env(key, fallback ? "true" : "false").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function envNumber(key, fallback) {
  const raw = env(key, String(fallback));
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be a finite number. Received "${raw}".`);
  }
  return parsed;
}

function envBigInt(key, fallback) {
  const raw = env(key, fallback.toString());
  try {
    return BigInt(raw);
  } catch {
    throw new Error(`${key} must be a valid integer. Received "${raw}".`);
  }
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function requireAddress(key) {
  const value = env(key);
  if (!isAddress(value)) {
    throw new Error(`${key} must be a valid EVM address.`);
  }
  return value;
}

function optionalAddress(key) {
  const value = env(key);
  if (!value) return "";
  if (!isAddress(value)) {
    throw new Error(`${key} must be a valid EVM address when provided.`);
  }
  return value;
}

function toLowerAddress(value) {
  return value ? ethers.getAddress(value) : "";
}

async function deployContract(name, args = []) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function deployVerifiers(useMocks) {
  if (useMocks) {
    const membership = await deployContract("MockVerifier");
    const swap = await deployContract("MockVerifier");
    const mint = await deployContract("MockVerifier");
    const burn = await deployContract("MockVerifier");
    return {
      membership: await membership.getAddress(),
      swap: await swap.getAddress(),
      mint: await mint.getAddress(),
      burn: await burn.getAddress(),
      mode: "mock",
    };
  }

  return {
    membership: requireAddress("VERIFIER_MEMBERSHIP_ADDRESS"),
    swap: requireAddress("VERIFIER_SWAP_ADDRESS"),
    mint: requireAddress("VERIFIER_MINT_ADDRESS"),
    burn: requireAddress("VERIFIER_BURN_ADDRESS"),
    mode: "external",
  };
}

async function deployMockTokens(deployerAddress) {
  const tokenA = await deployContract("MockERC20", ["Wrapped Bitcoin", "WBTC", 8]);
  const tokenB = await deployContract("MockERC20", ["USDT0", "USDT0", 6]);

  await (await tokenA.mint(deployerAddress, 10_000_000_000n)).wait();
  await (await tokenB.mint(deployerAddress, 10_000_000_000n)).wait();

  return {
    token0: await tokenA.getAddress(),
    token1: await tokenB.getAddress(),
    token0Symbol: "WBTC",
    token1Symbol: "USDT0",
    mode: "mock",
  };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const useMocks = network.name === "hardhat" || envBool("DEPLOY_MOCKS");
  const deployPool = network.name === "hardhat" || envBool("DEPLOY_POOL");

  const owner = optionalAddress("OWNER_ADDRESS") || deployerAddress;
  const rootSubmitter = optionalAddress("ROOT_SUBMITTER_ADDRESS") || deployerAddress;
  const feeRecipient = optionalAddress("FEE_RECIPIENT_ADDRESS") || deployerAddress;
  const protocolFeeBps = envNumber("PROTOCOL_FEE_BPS", 1000);

  console.log("Sunset deploy");
  console.log("=============");
  console.log(`network:   ${network.name}`);
  console.log(`chainId:   ${chainId}`);
  console.log(`deployer:  ${deployerAddress}`);
  console.log(`owner:     ${owner}`);
  console.log(`mocks:     ${useMocks ? "enabled" : "disabled"}`);
  console.log(`pool:      ${deployPool ? "create" : "skip"}`);

  const verifiers = await deployVerifiers(useMocks);
  const coordinator = await deployContract("SunsetVerifierCoordinator", [owner, rootSubmitter]);

  await (await coordinator.setVerifier(0, verifiers.membership)).wait();
  await (await coordinator.setVerifier(1, verifiers.swap)).wait();
  await (await coordinator.setVerifier(2, verifiers.mint)).wait();
  await (await coordinator.setVerifier(3, verifiers.burn)).wait();

  const factory = await deployContract("SunsetPoolFactory", [
    owner,
    await coordinator.getAddress(),
    feeRecipient,
    protocolFeeBps,
  ]);

  let tokenMetadata = {
    token0: optionalAddress("TOKEN0_ADDRESS"),
    token1: optionalAddress("TOKEN1_ADDRESS"),
    token0Symbol: env("TOKEN0_SYMBOL"),
    token1Symbol: env("TOKEN1_SYMBOL"),
    mode: "external",
  };

  if (useMocks && (!tokenMetadata.token0 || !tokenMetadata.token1)) {
    tokenMetadata = await deployMockTokens(deployerAddress);
  }

  let poolAddress = "";
  if (deployPool) {
    if (!tokenMetadata.token0 || !tokenMetadata.token1) {
      throw new Error("TOKEN0_ADDRESS and TOKEN1_ADDRESS are required when DEPLOY_POOL=true without mocks.");
    }

    const ordered = [tokenMetadata.token0, tokenMetadata.token1]
      .map((value) => ethers.getAddress(value))
      .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));

    const config = {
      token0: ordered[0],
      token1: ordered[1],
      fee: envNumber("POOL_FEE", DEFAULT_POOL_CONFIG.fee),
      tickSpacing: envNumber("POOL_TICK_SPACING", DEFAULT_POOL_CONFIG.tickSpacing),
      tickLower: envNumber("POOL_TICK_LOWER", DEFAULT_POOL_CONFIG.tickLower),
      tickUpper: envNumber("POOL_TICK_UPPER", DEFAULT_POOL_CONFIG.tickUpper),
      sqrtPriceLowerX96: envBigInt("POOL_SQRT_PRICE_LOWER_X96", DEFAULT_POOL_CONFIG.sqrtPriceLowerX96),
      sqrtPriceUpperX96: envBigInt("POOL_SQRT_PRICE_UPPER_X96", DEFAULT_POOL_CONFIG.sqrtPriceUpperX96),
      initialSqrtPriceX96: envBigInt("POOL_INITIAL_SQRT_PRICE_X96", DEFAULT_POOL_CONFIG.initialSqrtPriceX96),
      protocolFeeBps: envNumber("POOL_PROTOCOL_FEE_BPS", protocolFeeBps),
      feeRecipient,
      coordinator: await coordinator.getAddress(),
    };

    const createTx = await factory.createPool(config);
    const receipt = await createTx.wait();
    const event = receipt.logs.find((log) => {
      try {
        return factory.interface.parseLog(log).name === "PoolCreated";
      } catch {
        return false;
      }
    });

    if (!event) {
      throw new Error("PoolCreated event not found in createPool receipt.");
    }

    poolAddress = factory.interface.parseLog(event).args.pool;
    await (await coordinator.setAuthorizedDepositor(poolAddress, true)).wait();
  }

  const manifest = {
    network: network.name,
    chainId: chainId.toString(),
    deployer: toLowerAddress(deployerAddress),
    owner: toLowerAddress(owner),
    rootSubmitter: toLowerAddress(rootSubmitter),
    feeRecipient: toLowerAddress(feeRecipient),
    protocolFeeBps,
    coordinator: toLowerAddress(await coordinator.getAddress()),
    factory: toLowerAddress(await factory.getAddress()),
    pool: toLowerAddress(poolAddress),
    verifiers: {
      membership: toLowerAddress(verifiers.membership),
      swap: toLowerAddress(verifiers.swap),
      mint: toLowerAddress(verifiers.mint),
      burn: toLowerAddress(verifiers.burn),
      mode: verifiers.mode,
    },
    tokens: {
      token0: toLowerAddress(tokenMetadata.token0),
      token1: toLowerAddress(tokenMetadata.token1),
      token0Symbol: tokenMetadata.token0Symbol,
      token1Symbol: tokenMetadata.token1Symbol,
      mode: tokenMetadata.mode,
    },
    deployedAt: new Date().toISOString(),
  };

  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  fs.writeFileSync(DEPLOYMENTS_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log("");
  console.log("Deployed:");
  console.log(`  coordinator: ${manifest.coordinator}`);
  console.log(`  factory:     ${manifest.factory}`);
  console.log(`  pool:        ${manifest.pool || "(not deployed)"}`);
  console.log(`  manifest:    ${DEPLOYMENTS_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
