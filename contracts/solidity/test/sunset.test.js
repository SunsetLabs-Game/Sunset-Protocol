const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sunset Conflux contracts", function () {
  async function deployFixture() {
    const [owner, feeRecipient, rootSubmitter, alice, bob] = await ethers.getSigners();

    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    const membershipVerifier = await MockVerifier.deploy();
    const swapVerifier = await MockVerifier.deploy();
    const mintVerifier = await MockVerifier.deploy();
    const burnVerifier = await MockVerifier.deploy();

    const Coordinator = await ethers.getContractFactory("SunsetVerifierCoordinator");
    const coordinator = await Coordinator.deploy(owner.address, rootSubmitter.address);

    await coordinator.setVerifier(0, membershipVerifier.target);
    await coordinator.setVerifier(1, swapVerifier.target);
    await coordinator.setVerifier(2, mintVerifier.target);
    await coordinator.setVerifier(3, burnVerifier.target);

    const Token = await ethers.getContractFactory("MockERC20");
    const tokenA = await Token.deploy("Wrapped Bitcoin", "WBTC", 8);
    const tokenB = await Token.deploy("USDT0", "USDT0", 6);

    const [token0, token1] =
      BigInt(tokenA.target) < BigInt(tokenB.target)
        ? [tokenA, tokenB]
        : [tokenB, tokenA];

    await token0.mint(alice.address, 10_000_000_000n);
    await token1.mint(alice.address, 10_000_000_000n);
    await token0.mint(bob.address, 10_000_000_000n);
    await token1.mint(bob.address, 10_000_000_000n);

    const Factory = await ethers.getContractFactory("SunsetPoolFactory");
    const factory = await Factory.deploy(
      owner.address,
      coordinator.target,
      feeRecipient.address,
      1_000
    );

    const config = {
      token0: token0.target,
      token1: token1.target,
      fee: 3000,
      tickSpacing: 60,
      tickLower: -600,
      tickUpper: 600,
      sqrtPriceLowerX96: 39614081257132168796771975168n,
      sqrtPriceUpperX96: 118842243771396506390315925504n,
      initialSqrtPriceX96: 79228162514264337593543950336n,
      protocolFeeBps: 1_000,
      feeRecipient: ethers.ZeroAddress,
      coordinator: ethers.ZeroAddress
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
    const parsed = factory.interface.parseLog(event);
    const poolAddress = parsed.args.pool;

    const Pool = await ethers.getContractFactory("SunsetRangePool");
    const pool = Pool.attach(poolAddress);

    await coordinator.setAuthorizedDepositor(pool.target, true);
    await coordinator.submitMerkleRoot(ethers.keccak256(ethers.toUtf8Bytes("root-1")));

    return {
      owner,
      feeRecipient,
      rootSubmitter,
      alice,
      bob,
      coordinator,
      membershipVerifier,
      swapVerifier,
      mintVerifier,
      burnVerifier,
      token0,
      token1,
      factory,
      pool
    };
  }

  it("creates range pools with dynamic configuration", async function () {
    const { factory, token0, token1 } = await deployFixture();

    const key = await factory.computePoolKey({
      token0: token0.target,
      token1: token1.target,
      fee: 3000,
      tickSpacing: 60,
      tickLower: -600,
      tickUpper: 600,
      sqrtPriceLowerX96: 39614081257132168796771975168n,
      sqrtPriceUpperX96: 118842243771396506390315925504n,
      initialSqrtPriceX96: 79228162514264337593543950336n,
      protocolFeeBps: 1000,
      feeRecipient: ethers.ZeroAddress,
      coordinator: ethers.ZeroAddress
    });

    expect(await factory.pools(key)).to.not.equal(ethers.ZeroAddress);
  });

  it("mints liquidity, swaps, and accrues LP fees", async function () {
    const { pool, token0, token1, alice, bob } = await deployFixture();

    await token0.connect(alice).approve(pool.target, ethers.MaxUint256);
    await token1.connect(alice).approve(pool.target, ethers.MaxUint256);
    await pool.connect(alice).mint(1_000_000n, alice.address);

    await token1.connect(bob).approve(pool.target, ethers.MaxUint256);
    const upper = await pool.sqrtPriceUpperX96();
    await pool.connect(bob).swap(false, 500_000n, upper, bob.address);

    const position = await pool.getPosition(alice.address);
    expect(position.liquidity).to.equal(1_000_000n);

    await pool.connect(alice).collect(alice.address);
    const token0Balance = await token0.balanceOf(alice.address);
    const token1Balance = await token1.balanceOf(alice.address);

    expect(token0Balance).to.be.greaterThan(0n);
    expect(token1Balance).to.be.greaterThan(0n);
  });

  it("supports shielded deposits and shielded withdrawals through the coordinator", async function () {
    const { pool, coordinator, membershipVerifier, token0, alice } = await deployFixture();

    await token0.connect(alice).approve(pool.target, ethers.MaxUint256);
    const commitment = ethers.keccak256(ethers.toUtf8Bytes("commitment-1"));
    await pool.connect(alice).shieldedDeposit(token0.target, 1000n, commitment);

    expect(await coordinator.commitments(0)).to.equal(commitment);
    expect(await pool.shieldedBalances(token0.target)).to.equal(1000n);
    expect(await pool.reserve0()).to.equal(0n);

    const root = await coordinator.getCurrentRoot();
    const response = ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(bytes32 root, bytes32 nullifierHash, address recipient, address token, uint256 amount)"],
      [[root, ethers.keccak256(ethers.toUtf8Bytes("nullifier-1")), alice.address, token0.target, 1000n]]
    );
    await membershipVerifier.setResponse(response);

    const before = await token0.balanceOf(alice.address);
    await pool.connect(alice).shieldedWithdraw("0x1234");
    const after = await token0.balanceOf(alice.address);

    expect(after).to.be.greaterThan(before);
    expect(await pool.shieldedBalances(token0.target)).to.equal(0n);
  });

  it("executes shielded mint and burn against real pool liquidity state", async function () {
    const { pool, coordinator, mintVerifier, burnVerifier, token0, token1, alice } = await deployFixture();

    await token0.connect(alice).approve(pool.target, ethers.MaxUint256);
    await token1.connect(alice).approve(pool.target, ethers.MaxUint256);

    await pool.connect(alice).shieldedDeposit(token0.target, 2_000_000n, ethers.keccak256(ethers.toUtf8Bytes("shielded-token0")));
    await pool.connect(alice).shieldedDeposit(token1.target, 2_000_000n, ethers.keccak256(ethers.toUtf8Bytes("shielded-token1")));

    const root = await coordinator.getCurrentRoot();
    const positionCommitment = ethers.keccak256(ethers.toUtf8Bytes("position-1"));
    const changeCommitment0 = ethers.keccak256(ethers.toUtf8Bytes("change-0"));
    const changeCommitment1 = ethers.keccak256(ethers.toUtf8Bytes("change-1"));

    const mintResponse = ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(bytes32 root, bytes32 nullifierHash0, bytes32 nullifierHash1, bytes32 positionCommitment, bytes32 changeCommitment0, bytes32 changeCommitment1)"],
      [[
        root,
        ethers.keccak256(ethers.toUtf8Bytes("nullifier-mint-0")),
        ethers.keccak256(ethers.toUtf8Bytes("nullifier-mint-1")),
        positionCommitment,
        changeCommitment0,
        changeCommitment1
      ]]
    );
    await mintVerifier.setResponse(mintResponse);

    const expectedReserve0AfterMint = 333_333n;
    const expectedReserve1AfterMint = 500_000n;
    await pool.connect(alice).shieldedMint("0x1234", 1_000_000n);

    const shieldedPosition = await pool.getShieldedPosition(positionCommitment);
    expect(shieldedPosition.liquidity).to.equal(1_000_000n);
    expect(await pool.totalLiquidity()).to.equal(1_000_000n);
    expect(await coordinator.commitments(2)).to.equal(positionCommitment);
    expect(await pool.shieldedBalances(token0.target)).to.equal(2_000_000n - expectedReserve0AfterMint);
    expect(await pool.shieldedBalances(token1.target)).to.equal(2_000_000n - expectedReserve1AfterMint);
    expect(await pool.reserve0()).to.equal(expectedReserve0AfterMint);
    expect(await pool.reserve1()).to.equal(expectedReserve1AfterMint);

    const burnResponse = ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(bytes32 root, bytes32 positionNullifierHash, bytes32 newCommitment0, bytes32 newCommitment1)"],
      [[
        root,
        ethers.keccak256(ethers.toUtf8Bytes("nullifier-burn-position")),
        ethers.keccak256(ethers.toUtf8Bytes("burn-note-0")),
        ethers.keccak256(ethers.toUtf8Bytes("burn-note-1"))
      ]]
    );
    await burnVerifier.setResponse(burnResponse);

    await pool.connect(alice).shieldedBurn("0x5678", positionCommitment, 400_000n);

    const updatedPosition = await pool.getShieldedPosition(positionCommitment);
    expect(updatedPosition.liquidity).to.equal(600_000n);
    expect(await pool.totalLiquidity()).to.equal(600_000n);
    expect(await pool.shieldedBalances(token0.target)).to.be.greaterThan(1_000_000n);
    expect(await pool.shieldedBalances(token1.target)).to.be.greaterThan(1_000_000n);
  });

  it("keeps reserve accounting aligned when LPs and protocol collect fees", async function () {
    const { pool, token0, token1, feeRecipient, alice, bob } = await deployFixture();

    await token0.connect(alice).approve(pool.target, ethers.MaxUint256);
    await token1.connect(alice).approve(pool.target, ethers.MaxUint256);
    await pool.connect(alice).mint(1_000_000n, alice.address);

    await token1.connect(bob).approve(pool.target, ethers.MaxUint256);
    const reserve0BeforeSwap = await pool.reserve0();
    const reserve1BeforeSwap = await pool.reserve1();
    const upper = await pool.sqrtPriceUpperX96();
    await pool.connect(bob).swap(false, 500_000n, upper, bob.address);

    const reserve0AfterSwap = await pool.reserve0();
    const reserve1AfterSwap = await pool.reserve1();
    expect(reserve0AfterSwap).to.be.lessThan(reserve0BeforeSwap);
    expect(reserve1AfterSwap).to.be.greaterThan(reserve1BeforeSwap);

    const expectedCollect = await pool.connect(alice).collect.staticCall(alice.address);
    const protocolFees1 = await pool.protocolFees1();
    expect(expectedCollect[1]).to.be.greaterThan(0n);
    expect(protocolFees1).to.be.greaterThan(0n);

    const reserve1BeforeCollect = await pool.reserve1();
    await pool.connect(alice).collect(alice.address);
    const reserve1AfterCollect = await pool.reserve1();
    expect(reserve1AfterCollect).to.equal(reserve1BeforeCollect - expectedCollect[1]);

    const feeRecipientBefore = await token1.balanceOf(feeRecipient.address);
    await pool.collectProtocolFees();
    const feeRecipientAfter = await token1.balanceOf(feeRecipient.address);
    expect(feeRecipientAfter - feeRecipientBefore).to.equal(protocolFees1);
    expect(await pool.reserve1()).to.equal(reserve1AfterCollect - protocolFees1);
  });
});
