// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISunsetVerifierCoordinator} from "./interfaces/ISunsetVerifierCoordinator.sol";
import {SunsetTypes} from "./libraries/SunsetTypes.sol";
import {RangeMath} from "./libraries/RangeMath.sol";

contract SunsetRangePool is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct PoolConfig {
        address token0;
        address token1;
        uint24 fee;
        uint24 tickSpacing;
        int24 tickLower;
        int24 tickUpper;
        uint160 sqrtPriceLowerX96;
        uint160 sqrtPriceUpperX96;
        uint160 initialSqrtPriceX96;
        uint16 protocolFeeBps;
        address feeRecipient;
        address coordinator;
    }

    struct Position {
        uint128 liquidity;
        uint256 feeGrowth0LastX128;
        uint256 feeGrowth1LastX128;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    error InvalidTokenPair();
    error InvalidFee();
    error InvalidConfig();
    error InsufficientLiquidity();
    error InsufficientShieldedBalance(address token);
    error PriceLimitOutsideRange();

    event LiquidityAdded(address indexed owner, uint128 liquidity, uint256 amount0, uint256 amount1);
    event LiquidityRemoved(address indexed owner, uint128 liquidity, uint256 amount0, uint256 amount1);
    event ShieldedLiquidityAdded(bytes32 indexed positionCommitment, uint128 liquidity, uint256 amount0, uint256 amount1);
    event ShieldedLiquidityRemoved(bytes32 indexed positionCommitment, uint128 liquidity, uint256 amount0, uint256 amount1);
    event SwapExecuted(address indexed recipient, bool zeroForOne, uint256 amountIn, uint256 amountOut, uint160 sqrtPriceX96);
    event ShieldedDeposit(bytes32 indexed commitment, address indexed token, uint256 amount, uint32 leafIndex);
    event ShieldedWithdrawal(address indexed recipient, address indexed token, uint256 amount);
    event CoordinatorUpdated(address indexed coordinator);
    event FeeRecipientUpdated(address indexed feeRecipient);
    event ProtocolFeeUpdated(uint16 protocolFeeBps);

    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;
    uint24 public immutable tickSpacing;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;
    uint160 public immutable sqrtPriceLowerX96;
    uint160 public immutable sqrtPriceUpperX96;

    address public feeRecipient;
    ISunsetVerifierCoordinator public coordinator;
    uint16 public protocolFeeBps;

    uint160 public sqrtPriceX96;
    uint128 public totalLiquidity;
    uint256 public feeGrowthGlobal0X128;
    uint256 public feeGrowthGlobal1X128;
    uint128 public protocolFees0;
    uint128 public protocolFees1;
    uint256 public reserve0;
    uint256 public reserve1;

    mapping(address => Position) public positions;
    mapping(bytes32 => Position) public shieldedPositions;
    mapping(address => uint256) public shieldedBalances;

    constructor(PoolConfig memory config, address initialOwner) Ownable(initialOwner) {
        if (config.token0 == address(0) || config.token1 == address(0) || config.token0 >= config.token1) {
            revert InvalidTokenPair();
        }
        if (config.fee == 0 || config.fee > 100_000) revert InvalidFee();
        if (config.feeRecipient == address(0) || config.coordinator == address(0)) revert InvalidConfig();

        RangeMath.validateRange(
            config.sqrtPriceLowerX96,
            config.sqrtPriceUpperX96,
            config.initialSqrtPriceX96
        );

        token0 = config.token0;
        token1 = config.token1;
        fee = config.fee;
        tickSpacing = config.tickSpacing;
        tickLower = config.tickLower;
        tickUpper = config.tickUpper;
        sqrtPriceLowerX96 = config.sqrtPriceLowerX96;
        sqrtPriceUpperX96 = config.sqrtPriceUpperX96;
        sqrtPriceX96 = config.initialSqrtPriceX96;
        protocolFeeBps = config.protocolFeeBps;
        feeRecipient = config.feeRecipient;
        coordinator = ISunsetVerifierCoordinator(config.coordinator);
    }

    function setCoordinator(address newCoordinator) external onlyOwner {
        if (newCoordinator == address(0)) revert InvalidConfig();
        coordinator = ISunsetVerifierCoordinator(newCoordinator);
        emit CoordinatorUpdated(newCoordinator);
    }

    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert InvalidConfig();
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(newFeeRecipient);
    }

    function setProtocolFeeBps(uint16 newProtocolFeeBps) external onlyOwner {
        if (newProtocolFeeBps > 10_000) revert InvalidConfig();
        protocolFeeBps = newProtocolFeeBps;
        emit ProtocolFeeUpdated(newProtocolFeeBps);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function mint(uint128 liquidityDelta, address recipient)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amount0, uint256 amount1)
    {
        if (recipient == address(0) || liquidityDelta == 0) revert InvalidConfig();
        (amount0, amount1) = RangeMath.amountsForLiquidity(
            sqrtPriceX96,
            sqrtPriceLowerX96,
            sqrtPriceUpperX96,
            liquidityDelta
        );

        _accruePosition(recipient);
        positions[recipient].liquidity += liquidityDelta;
        totalLiquidity += liquidityDelta;

        reserve0 += amount0;
        reserve1 += amount1;

        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        emit LiquidityAdded(recipient, liquidityDelta, amount0, amount1);
    }

    function burn(uint128 liquidityDelta, address recipient)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amount0, uint256 amount1)
    {
        if (recipient == address(0) || liquidityDelta == 0) revert InvalidConfig();
        Position storage position = positions[msg.sender];
        _accruePosition(msg.sender);
        if (position.liquidity < liquidityDelta || totalLiquidity == 0) revert InsufficientLiquidity();

        amount0 = (reserve0 * liquidityDelta) / totalLiquidity;
        amount1 = (reserve1 * liquidityDelta) / totalLiquidity;

        position.liquidity -= liquidityDelta;
        totalLiquidity -= liquidityDelta;
        reserve0 -= amount0;
        reserve1 -= amount1;

        IERC20(token0).safeTransfer(recipient, amount0);
        IERC20(token1).safeTransfer(recipient, amount1);

        emit LiquidityRemoved(msg.sender, liquidityDelta, amount0, amount1);
    }

    function collect(address recipient) external nonReentrant whenNotPaused returns (uint128 amount0, uint128 amount1) {
        if (recipient == address(0)) revert InvalidConfig();
        _accruePosition(msg.sender);
        Position storage position = positions[msg.sender];
        amount0 = position.tokensOwed0;
        amount1 = position.tokensOwed1;
        position.tokensOwed0 = 0;
        position.tokensOwed1 = 0;

        if (amount0 > 0) {
            reserve0 -= amount0;
            IERC20(token0).safeTransfer(recipient, amount0);
        }
        if (amount1 > 0) {
            reserve1 -= amount1;
            IERC20(token1).safeTransfer(recipient, amount1);
        }
    }

    function swap(bool zeroForOne, uint256 amountIn, uint160 sqrtPriceLimitX96, address recipient)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amountOut)
    {
        if (recipient == address(0) || amountIn == 0 || totalLiquidity == 0) revert InvalidConfig();

        uint256 feeAmount = RangeMath.feeAmount(amountIn, fee);
        uint256 amountInAfterFee = amountIn - feeAmount;
        uint256 protocolFeeAmount = RangeMath.protocolFee(feeAmount, protocolFeeBps);
        uint256 lpFeeAmount = feeAmount - protocolFeeAmount;

        if (zeroForOne) {
            IERC20(token0).safeTransferFrom(msg.sender, address(this), amountIn);
            uint160 nextSqrtPriceX96 = RangeMath.nextSqrtPriceFromAmount0In(sqrtPriceX96, totalLiquidity, amountInAfterFee);
            if (nextSqrtPriceX96 < sqrtPriceLowerX96 || nextSqrtPriceX96 < sqrtPriceLimitX96) {
                revert PriceLimitOutsideRange();
            }

            amountOut = RangeMath.amount1Delta(nextSqrtPriceX96, sqrtPriceX96, totalLiquidity);
            sqrtPriceX96 = nextSqrtPriceX96;
            reserve0 += amountIn;
            reserve1 -= amountOut;
            protocolFees0 += uint128(protocolFeeAmount);
            feeGrowthGlobal0X128 += (lpFeeAmount << 128) / totalLiquidity;
            IERC20(token1).safeTransfer(recipient, amountOut);
        } else {
            IERC20(token1).safeTransferFrom(msg.sender, address(this), amountIn);
            uint160 nextSqrtPriceX96 = RangeMath.nextSqrtPriceFromAmount1In(sqrtPriceX96, totalLiquidity, amountInAfterFee);
            if (nextSqrtPriceX96 > sqrtPriceUpperX96 || nextSqrtPriceX96 > sqrtPriceLimitX96) {
                revert PriceLimitOutsideRange();
            }

            amountOut = RangeMath.amount0Delta(sqrtPriceX96, nextSqrtPriceX96, totalLiquidity);
            sqrtPriceX96 = nextSqrtPriceX96;
            reserve1 += amountIn;
            reserve0 -= amountOut;
            protocolFees1 += uint128(protocolFeeAmount);
            feeGrowthGlobal1X128 += (lpFeeAmount << 128) / totalLiquidity;
            IERC20(token0).safeTransfer(recipient, amountOut);
        }

        emit SwapExecuted(recipient, zeroForOne, amountIn, amountOut, sqrtPriceX96);
    }

    function shieldedDeposit(address token, uint256 amount, bytes32 commitment)
        external
        nonReentrant
        whenNotPaused
        returns (uint32 leafIndex)
    {
        if (token == address(0) || amount == 0 || commitment == bytes32(0)) revert InvalidConfig();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        shieldedBalances[token] += amount;
        leafIndex = coordinator.depositCommitment(commitment);
        emit ShieldedDeposit(commitment, token, amount, leafIndex);
    }

    function shieldedSwap(bytes calldata proofData, uint160 sqrtPriceLimitX96)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amountOut)
    {
        SunsetTypes.SwapPublicInputs memory inputs = coordinator.verifySwap(proofData);
        bool zeroForOne = inputs.tokenIn == token0 && inputs.tokenOut == token1;
        if (!zeroForOne && !(inputs.tokenIn == token1 && inputs.tokenOut == token0)) {
            revert InvalidTokenPair();
        }
        amountOut = _swapFromCustody(zeroForOne, inputs.amountIn, inputs.amountOutMin, sqrtPriceLimitX96);
    }

    function shieldedWithdraw(bytes calldata proofData) external nonReentrant whenNotPaused {
        SunsetTypes.MembershipPublicInputs memory inputs = coordinator.verifyMembership(proofData);
        if (shieldedBalances[inputs.token] < inputs.amount) revert InsufficientShieldedBalance(inputs.token);
        shieldedBalances[inputs.token] -= inputs.amount;
        IERC20(inputs.token).safeTransfer(inputs.recipient, inputs.amount);
        emit ShieldedWithdrawal(inputs.recipient, inputs.token, inputs.amount);
    }

    function shieldedMint(bytes calldata proofData, uint128 liquidityDelta)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amount0, uint256 amount1)
    {
        if (liquidityDelta == 0) revert InvalidConfig();

        SunsetTypes.MintPublicInputs memory inputs = coordinator.verifyMint(proofData);
        _accrueShieldedPosition(inputs.positionCommitment);

        (amount0, amount1) = RangeMath.amountsForLiquidity(
            sqrtPriceX96,
            sqrtPriceLowerX96,
            sqrtPriceUpperX96,
            liquidityDelta
        );

        if (shieldedBalances[token0] < amount0) revert InsufficientShieldedBalance(token0);
        if (shieldedBalances[token1] < amount1) revert InsufficientShieldedBalance(token1);

        shieldedBalances[token0] -= amount0;
        shieldedBalances[token1] -= amount1;
        shieldedPositions[inputs.positionCommitment].liquidity += liquidityDelta;
        totalLiquidity += liquidityDelta;
        reserve0 += amount0;
        reserve1 += amount1;

        emit ShieldedLiquidityAdded(inputs.positionCommitment, liquidityDelta, amount0, amount1);
    }

    function shieldedBurn(bytes calldata proofData, bytes32 positionCommitment, uint128 liquidityDelta)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amount0, uint256 amount1)
    {
        if (liquidityDelta == 0) revert InvalidConfig();

        coordinator.verifyBurn(proofData);
        _accrueShieldedPosition(positionCommitment);

        Position storage position = shieldedPositions[positionCommitment];
        if (position.liquidity < liquidityDelta || totalLiquidity == 0) revert InsufficientLiquidity();

        amount0 = (reserve0 * liquidityDelta) / totalLiquidity;
        amount1 = (reserve1 * liquidityDelta) / totalLiquidity;

        position.liquidity -= liquidityDelta;
        totalLiquidity -= liquidityDelta;
        reserve0 -= amount0;
        reserve1 -= amount1;
        shieldedBalances[token0] += amount0;
        shieldedBalances[token1] += amount1;

        emit ShieldedLiquidityRemoved(positionCommitment, liquidityDelta, amount0, amount1);
    }

    function collectProtocolFees() external nonReentrant whenNotPaused {
        uint128 fees0 = protocolFees0;
        uint128 fees1 = protocolFees1;
        protocolFees0 = 0;
        protocolFees1 = 0;

        if (fees0 > 0) {
            reserve0 -= fees0;
            IERC20(token0).safeTransfer(feeRecipient, fees0);
        }
        if (fees1 > 0) {
            reserve1 -= fees1;
            IERC20(token1).safeTransfer(feeRecipient, fees1);
        }
    }

    function getPosition(address owner_) external view returns (Position memory) {
        return positions[owner_];
    }

    function getShieldedPosition(bytes32 positionCommitment) external view returns (Position memory) {
        return shieldedPositions[positionCommitment];
    }

    function _swapFromCustody(
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOutMin,
        uint160 sqrtPriceLimitX96
    ) internal returns (uint256 amountOut) {
        if (amountIn == 0 || totalLiquidity == 0) revert InvalidConfig();

        uint256 feeAmount = RangeMath.feeAmount(amountIn, fee);
        uint256 amountInAfterFee = amountIn - feeAmount;
        uint256 protocolFeeAmount = RangeMath.protocolFee(feeAmount, protocolFeeBps);
        uint256 lpFeeAmount = feeAmount - protocolFeeAmount;

        if (zeroForOne) {
            if (shieldedBalances[token0] < amountIn) revert InsufficientShieldedBalance(token0);
            uint160 nextSqrtPriceX96 = RangeMath.nextSqrtPriceFromAmount0In(sqrtPriceX96, totalLiquidity, amountInAfterFee);
            if (nextSqrtPriceX96 < sqrtPriceLowerX96 || nextSqrtPriceX96 < sqrtPriceLimitX96) {
                revert PriceLimitOutsideRange();
            }
            amountOut = RangeMath.amount1Delta(nextSqrtPriceX96, sqrtPriceX96, totalLiquidity);
            if (amountOut < amountOutMin) revert PriceLimitOutsideRange();
            shieldedBalances[token0] -= amountIn;
            shieldedBalances[token1] += amountOut;
            sqrtPriceX96 = nextSqrtPriceX96;
            reserve0 += amountIn;
            reserve1 -= amountOut;
            protocolFees0 += uint128(protocolFeeAmount);
            feeGrowthGlobal0X128 += (lpFeeAmount << 128) / totalLiquidity;
        } else {
            if (shieldedBalances[token1] < amountIn) revert InsufficientShieldedBalance(token1);
            uint160 nextSqrtPriceX96 = RangeMath.nextSqrtPriceFromAmount1In(sqrtPriceX96, totalLiquidity, amountInAfterFee);
            if (nextSqrtPriceX96 > sqrtPriceUpperX96 || nextSqrtPriceX96 > sqrtPriceLimitX96) {
                revert PriceLimitOutsideRange();
            }
            amountOut = RangeMath.amount0Delta(sqrtPriceX96, nextSqrtPriceX96, totalLiquidity);
            if (amountOut < amountOutMin) revert PriceLimitOutsideRange();
            shieldedBalances[token1] -= amountIn;
            shieldedBalances[token0] += amountOut;
            sqrtPriceX96 = nextSqrtPriceX96;
            reserve1 += amountIn;
            reserve0 -= amountOut;
            protocolFees1 += uint128(protocolFeeAmount);
            feeGrowthGlobal1X128 += (lpFeeAmount << 128) / totalLiquidity;
        }
    }

    function _accruePosition(address owner_) internal {
        Position storage position = positions[owner_];
        if (position.liquidity == 0) {
            position.feeGrowth0LastX128 = feeGrowthGlobal0X128;
            position.feeGrowth1LastX128 = feeGrowthGlobal1X128;
            return;
        }

        uint256 delta0 = feeGrowthGlobal0X128 - position.feeGrowth0LastX128;
        uint256 delta1 = feeGrowthGlobal1X128 - position.feeGrowth1LastX128;

        uint128 owed0 = uint128((uint256(position.liquidity) * delta0) >> 128);
        uint128 owed1 = uint128((uint256(position.liquidity) * delta1) >> 128);

        position.tokensOwed0 += owed0;
        position.tokensOwed1 += owed1;
        position.feeGrowth0LastX128 = feeGrowthGlobal0X128;
        position.feeGrowth1LastX128 = feeGrowthGlobal1X128;
    }

    function _accrueShieldedPosition(bytes32 positionCommitment) internal {
        Position storage position = shieldedPositions[positionCommitment];
        if (position.liquidity == 0) {
            position.feeGrowth0LastX128 = feeGrowthGlobal0X128;
            position.feeGrowth1LastX128 = feeGrowthGlobal1X128;
            return;
        }

        uint256 delta0 = feeGrowthGlobal0X128 - position.feeGrowth0LastX128;
        uint256 delta1 = feeGrowthGlobal1X128 - position.feeGrowth1LastX128;

        uint128 owed0 = uint128((uint256(position.liquidity) * delta0) >> 128);
        uint128 owed1 = uint128((uint256(position.liquidity) * delta1) >> 128);

        position.tokensOwed0 += owed0;
        position.tokensOwed1 += owed1;
        position.feeGrowth0LastX128 = feeGrowthGlobal0X128;
        position.feeGrowth1LastX128 = feeGrowthGlobal1X128;
    }
}
