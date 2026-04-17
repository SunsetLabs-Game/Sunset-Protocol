const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const DEPLOYMENTS_PATH = path.join(__dirname, "..", "deployments", "contracts.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadManifest() {
  if (!fs.existsSync(DEPLOYMENTS_PATH)) {
    throw new Error(`Deployment manifest not found at ${DEPLOYMENTS_PATH}. Run the deploy script first.`);
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8"));
}

async function smokeHardhat() {
  const [owner, feeRecipient, rootSubmitter, alice, bob] = await ethers.getSigners();

  const membershipVerifier = await (await ethers.getContractFactory("MockVerifier")).deploy();
  const swapVerifier = await (await ethers.getContractFactory("MockVerifier")).deploy();
  const mintVerifier = await (await ethers.getContractFactory("MockVerifier")).deploy();
  const burnVerifier = await (await ethers.getContractFactory("MockVerifier")).deploy();
  await Promise.all([
    membershipVerifier.waitForDeployment(),
    swapVerifier.waitForDeployment(),
    mintVerifier.waitForDeployment(),
    burnVerifier.waitForDeployment(),
  ]);

  const coordinator = await (await ethers.getContractFactory("SunsetVerifierCoordinator")).deploy(
    owner.address,
    rootSubmitter.address,
  );
  await coordinator.waitForDeployment();

  await (await coordinator.setVerifier(0, await membershipVerifier.getAddress())).wait();
  await (await coordinator.setVerifier(1, await swapVerifier.getAddress())).wait();
  await (await coordinator.setVerifier(2, await mintVerifier.getAddress())).wait();
  await (await coordinator.setVerifier(3, await burnVerifier.getAddress())).wait();

  const tokenA = await (await ethers.getContractFactory("MockERC20")).deploy("Wrapped Bitcoin", "WBTC", 8);
  const tokenB = await (await ethers.getContractFactory("MockERC20")).deploy("USDT0", "USDT0", 6);
  await Promise.all([tokenA.waitForDeployment(), tokenB.waitForDeployment()]);

  const ordered = [await tokenA.getAddress(), await tokenB.getAddress()]
    .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));

  await (await tokenA.mint(alice.address, 10_000_000_000n)).wait();
  await (await tokenB.mint(alice.address, 10_000_000_000n)).wait();
  await (await tokenA.mint(bob.address, 10_000_000_000n)).wait();
  await (await tokenB.mint(bob.address, 10_000_000_000n)).wait();

  const factory = await (await ethers.getContractFactory("SunsetPoolFactory")).deploy(
    owner.address,
    await coordinator.getAddress(),
    feeRecipient.address,
    1000,
  );
  await factory.waitForDeployment();

  const config = {
    token0: ordered[0],
    token1: ordered[1],
    fee: 3000,
    tickSpacing: 60,
    tickLower: -600,
    tickUpper: 600,
    sqrtPriceLowerX96: 39614081257132168796771975168n,
    sqrtPriceUpperX96: 118842243771396506390315925504n,
    initialSqrtPriceX96: 79228162514264337593543950336n,
    protocolFeeBps: 1000,
    feeRecipient: feeRecipient.address,
    coordinator: await coordinator.getAddress(),
  };

  const receipt = await (await factory.createPool(config)).wait();
  const event = receipt.logs.find((log) => {
    try {
      return factory.interface.parseLog(log).name === "PoolCreated";
    } catch {
      return false;
    }
  });
  assert(event, "PoolCreated event not found during smoke deployment.");
  const poolAddress = factory.interface.parseLog(event).args.pool;
  const pool = await ethers.getContractAt("SunsetRangePool", poolAddress);

  await (await coordinator.setAuthorizedDepositor(poolAddress, true)).wait();
  const root = ethers.keccak256(ethers.toUtf8Bytes("smoke-root"));
  await (await coordinator.connect(rootSubmitter).submitMerkleRoot(root)).wait();

  const token0 = await ethers.getContractAt("MockERC20", ordered[0]);
  const token1 = await ethers.getContractAt("MockERC20", ordered[1]);

  await (await token0.connect(alice).approve(poolAddress, ethers.MaxUint256)).wait();
  await (await token1.connect(alice).approve(poolAddress, ethers.MaxUint256)).wait();
  await (await pool.connect(alice).mint(1_000_000n, alice.address)).wait();

  const position = await pool.getPosition(alice.address);
  assert(position.liquidity === 1_000_000n, "Minted liquidity was not stored on the LP position.");

  await (await token1.connect(bob).approve(poolAddress, ethers.MaxUint256)).wait();
  await (await pool.connect(bob).swap(false, 500_000n, await pool.sqrtPriceUpperX96(), bob.address)).wait();
  const beforeCollect0 = await token0.balanceOf(alice.address);
  const beforeCollect1 = await token1.balanceOf(alice.address);
  await (await pool.connect(alice).collect(alice.address)).wait();
  const afterCollect0 = await token0.balanceOf(alice.address);
  const afterCollect1 = await token1.balanceOf(alice.address);
  assert(
    afterCollect0 > beforeCollect0 || afterCollect1 > beforeCollect1,
    "Swap did not accrue claimable LP fees.",
  );

  const commitment = ethers.keccak256(ethers.toUtf8Bytes("smoke-commitment"));
  await (await pool.connect(alice).shieldedDeposit(await token0.getAddress(), 1000n, commitment)).wait();
  assert((await coordinator.commitments(0)) === commitment, "Shielded deposit was not recorded by the coordinator.");

  const membershipPayload = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(bytes32 root, bytes32 nullifierHash, address recipient, address token, uint256 amount)"],
    [[
      root,
      ethers.keccak256(ethers.toUtf8Bytes("smoke-nullifier")),
      alice.address,
      await token0.getAddress(),
      1000n,
    ]],
  );
  await (await membershipVerifier.setResponse(membershipPayload)).wait();
  const beforeWithdraw = await token0.balanceOf(alice.address);
  await (await pool.connect(alice).shieldedWithdraw("0x1234")).wait();
  const afterWithdraw = await token0.balanceOf(alice.address);
  assert(afterWithdraw > beforeWithdraw, "Shielded withdraw did not release custody to the recipient.");

  console.log("Hardhat smoke test passed.");
  console.log(`  coordinator: ${await coordinator.getAddress()}`);
  console.log(`  factory:     ${await factory.getAddress()}`);
  console.log(`  pool:        ${poolAddress}`);
}

async function smokeDeployedNetwork() {
  const manifest = loadManifest();
  const provider = ethers.provider;

  assert(manifest.coordinator, "Manifest is missing coordinator.");
  assert(manifest.factory, "Manifest is missing factory.");

  const coordinatorCode = await provider.getCode(manifest.coordinator);
  const factoryCode = await provider.getCode(manifest.factory);
  assert(coordinatorCode !== "0x", `No contract deployed at coordinator ${manifest.coordinator}.`);
  assert(factoryCode !== "0x", `No contract deployed at factory ${manifest.factory}.`);

  const coordinator = await ethers.getContractAt("SunsetVerifierCoordinator", manifest.coordinator);
  const factory = await ethers.getContractAt("SunsetPoolFactory", manifest.factory);

  const verifiers = [
    ["membership", 0, manifest.verifiers?.membership],
    ["swap", 1, manifest.verifiers?.swap],
    ["mint", 2, manifest.verifiers?.mint],
    ["burn", 3, manifest.verifiers?.burn],
  ];

  for (const [label, index, address] of verifiers) {
    assert(address, `Manifest is missing ${label} verifier address.`);
    const onchain = await coordinator.verifiers(index);
    assert(
      ethers.getAddress(onchain) === ethers.getAddress(address),
      `Coordinator verifier mismatch for ${label}: manifest=${address}, onchain=${onchain}`,
    );
  }

  assert(
    ethers.getAddress(await factory.defaultCoordinator()) === ethers.getAddress(manifest.coordinator),
    "Factory default coordinator does not match manifest coordinator.",
  );

  if (manifest.pool) {
    const poolCode = await provider.getCode(manifest.pool);
    assert(poolCode !== "0x", `No contract deployed at pool ${manifest.pool}.`);

    const pool = await ethers.getContractAt("SunsetRangePool", manifest.pool);
    assert(
      ethers.getAddress(await pool.coordinator()) === ethers.getAddress(manifest.coordinator),
      "Pool coordinator does not match manifest coordinator.",
    );
    assert(await coordinator.authorizedDepositors(manifest.pool), "Pool is not an authorized coordinator depositor.");
  } else {
    console.log("Manifest has no pool address. Skipping pool wiring checks.");
  }

  console.log("Deployed smoke test passed.");
  console.log(`  network:     ${network.name}`);
  console.log(`  coordinator: ${manifest.coordinator}`);
  console.log(`  factory:     ${manifest.factory}`);
  console.log(`  pool:        ${manifest.pool || "(none)"}`);
}

async function main() {
  console.log("Sunset smoke");
  console.log("============");
  console.log(`network: ${network.name}`);

  if (network.name === "hardhat") {
    await smokeHardhat();
    return;
  }

  await smokeDeployedNetwork();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
