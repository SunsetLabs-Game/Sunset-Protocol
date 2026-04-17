import { useWalletSession } from "@/providers/WalletProvider";
import { env } from "@/config/env";
import { useState } from "react";
import {
  buildErc20ApprovalTx,
  buildPoolMintTx,
  buildPoolSwapTx,
  type EvmTransactionRequest,
} from "@/config/evm";

const POOL_ADDRESS = env.contracts.pool;

interface SwapParams {
  tokenInAddress: string;
  tokenOutAddress: string;
  amountIn: bigint;
  fee?: number;
  tickSpacing?: number;
}

interface MintParams {
  token0Address: string;
  token1Address: string;
  liquidity: bigint;
  fee?: number;
  tickSpacing?: number;
  tickLower?: number;
  tickUpper?: number;
  amount?: bigint;
}

export function usePoolOperations() {
  const { execute, address, isConnected } = useWalletSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Execute a swap with automatic token approval
   * This handles the entire flow:
   * 1. Check if approval is needed
   * 2. Build multicall with approval + swap
   * 3. Execute in single transaction via Cavos
   */
  const executeSwap = async (params: SwapParams) => {
    if (!execute || !address || !isConnected) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Determine token order
      const zeroForOne =
        BigInt(params.tokenInAddress) < BigInt(params.tokenOutAddress);
      // For simplicity, use a safe sqrt_price_limit
      // In production, you'd fetch pool state to calculate this
      const MIN_SQRT_PRICE = 4295128740n;
      const MAX_SQRT_PRICE = BigInt(
        "1461446703485210103287273052203988822378723970340",
      );
      const validLimit = zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE;

      const calls: EvmTransactionRequest[] = [
        buildErc20ApprovalTx(
          params.tokenInAddress,
          POOL_ADDRESS,
          params.amountIn,
          "Approve swap",
        ),
        buildPoolSwapTx({
          poolAddress: POOL_ADDRESS,
          zeroForOne,
          amountIn: params.amountIn,
          sqrtPriceLimitX96: validLimit,
          recipient: address!,
        }),
      ];

      const txHash = await execute(calls);
      console.log("Swap transaction hash:", txHash);

      setIsLoading(false);
      return txHash;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Swap failed";
      setError(message);
      setIsLoading(false);
      throw err;
    }
  };

  /**
   * Mint liquidity with automatic token approvals
   */
  const executeMint = async (params: MintParams) => {
    if (!execute || !address || !isConnected) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure token order (token0 < token1)
      const [token0, token1] =
        BigInt(params.token0Address) < BigInt(params.token1Address)
          ? [params.token0Address, params.token1Address]
          : [params.token1Address, params.token0Address];

      const calls: EvmTransactionRequest[] = [
        buildErc20ApprovalTx(token0, POOL_ADDRESS, params.liquidity, "Approve token 0"),
        buildErc20ApprovalTx(token1, POOL_ADDRESS, params.liquidity, "Approve token 1"),
        buildPoolMintTx({
          poolAddress: POOL_ADDRESS,
          liquidityDelta: params.liquidity,
          recipient: address!,
        }),
      ];

      const txHash = await execute(calls);
      console.log("Mint transaction hash:", txHash);

      setIsLoading(false);
      return txHash;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mint failed";
      setError(message);
      setIsLoading(false);
      throw err;
    }
  };

  return {
    executeSwap,
    executeMint,
    isLoading,
    error,
    isConnected,
    address,
  };
}
