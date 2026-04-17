// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library RangeMath {
    uint256 internal constant Q96 = 2 ** 96;
    uint256 internal constant Q192 = 2 ** 192;
    uint256 internal constant FEE_DENOMINATOR = 1_000_000;

    error InvalidRange();
    error InvalidLiquidity();
    error PriceOutsideRange();
    error PriceLimitExceeded();

    function validateRange(
        uint160 sqrtPriceLowerX96,
        uint160 sqrtPriceUpperX96,
        uint160 sqrtPriceX96
    ) internal pure {
        if (
            sqrtPriceLowerX96 == 0 ||
            sqrtPriceUpperX96 <= sqrtPriceLowerX96 ||
            sqrtPriceX96 < sqrtPriceLowerX96 ||
            sqrtPriceX96 > sqrtPriceUpperX96
        ) {
            revert InvalidRange();
        }
    }

    function amountsForLiquidity(
        uint160 sqrtPriceX96,
        uint160 sqrtPriceLowerX96,
        uint160 sqrtPriceUpperX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        if (liquidity == 0) revert InvalidLiquidity();
        validateRange(sqrtPriceLowerX96, sqrtPriceUpperX96, sqrtPriceX96);

        uint256 liquidityX96 = uint256(liquidity) * Q96;
        amount0 =
            mulDiv(
                liquidityX96,
                uint256(sqrtPriceUpperX96) - uint256(sqrtPriceX96),
                uint256(sqrtPriceUpperX96)
            ) /
            uint256(sqrtPriceX96);
        amount1 = mulDiv(
            uint256(liquidity),
            uint256(sqrtPriceX96) - uint256(sqrtPriceLowerX96),
            Q96
        );
    }

    function nextSqrtPriceFromAmount0In(
        uint160 sqrtPriceX96,
        uint128 liquidity,
        uint256 amountIn
    ) internal pure returns (uint160 nextSqrtPriceX96) {
        uint256 numerator = uint256(liquidity) * uint256(sqrtPriceX96);
        uint256 denominator = uint256(liquidity) + mulDiv(amountIn, uint256(sqrtPriceX96), Q96);
        nextSqrtPriceX96 = uint160(mulDiv(numerator, 1, denominator));
    }

    function nextSqrtPriceFromAmount1In(
        uint160 sqrtPriceX96,
        uint128 liquidity,
        uint256 amountIn
    ) internal pure returns (uint160 nextSqrtPriceX96) {
        uint256 delta = mulDiv(amountIn, Q96, liquidity);
        nextSqrtPriceX96 = uint160(uint256(sqrtPriceX96) + delta);
    }

    function amount1Delta(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint128 liquidity
    ) internal pure returns (uint256) {
        if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        return mulDiv(uint256(liquidity), uint256(sqrtPriceBX96) - uint256(sqrtPriceAX96), Q96);
    }

    function amount0Delta(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint128 liquidity
    ) internal pure returns (uint256) {
        if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        uint256 liquidityX96 = uint256(liquidity) * Q96;
        return mulDiv(liquidityX96, uint256(sqrtPriceBX96) - uint256(sqrtPriceAX96), uint256(sqrtPriceBX96)) / uint256(sqrtPriceAX96);
    }

    function feeAmount(uint256 amountIn, uint24 fee) internal pure returns (uint256) {
        return mulDiv(amountIn, fee, FEE_DENOMINATOR);
    }

    function amountAfterFee(uint256 amountIn, uint24 fee) internal pure returns (uint256) {
        return amountIn - feeAmount(amountIn, fee);
    }

    function protocolFee(uint256 feeAmount_, uint16 protocolFeeBps) internal pure returns (uint256) {
        return mulDiv(feeAmount_, protocolFeeBps, 10_000);
    }

    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256 result) {
        result = (a * b) / denominator;
    }
}
