import { useMutation } from "@tanstack/react-query";
import { useSdkStore } from "@/stores/sdkStore";
import { useWalletSession } from "@/providers/WalletProvider";
import { useToast } from "@/components/ui/Toast";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import type { PoolKey } from "@sunset/sdk";
import {
  buildShieldedBurnTx,
  buildSubmitMerkleRootTx,
} from "@/config/evm";
import { env } from "@/config/env";

interface BurnInput {
  poolKey: PoolKey;
  positionCommitment: string;
  amount0Out: bigint;
  token0: string;
  amount1Out: bigint;
  token1: string;
  liquidity: bigint;
}

export function useBurn() {
  const client = useSdkStore((s) => s.client);
  const refreshBalances = useSdkStore((s) => s.refreshBalances);
  const { execute } = useWalletSession();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: BurnInput) => {
      if (!client) throw new Error("SDK not initialized");
      if (!env.contracts.pool) throw new Error("Pool address is not configured");
      if (!env.contracts.coordinator) throw new Error("Coordinator address is not configured");

      const noteManager = client.getNoteManager();
      const snapshot = noteManager.snapshot();

      try {
        const result = await client.burn(input);
        const txHash = await execute([
          buildShieldedBurnTx({
            poolAddress: env.contracts.pool,
            calldata: result.calldata,
            positionCommitment: input.positionCommitment,
            liquidityDelta: input.liquidity,
          }),
          buildSubmitMerkleRootTx({
            coordinatorAddress: env.contracts.coordinator,
            root: result.finalRoot,
          }),
        ]);
        await client.saveNotes();
        return { ...result, txHash };
      } catch (error) {
        noteManager.restore(snapshot);
        await client.saveNotes();
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      refreshBalances();
      queryClient.invalidateQueries({
        queryKey: queryKeys.poolState(variables.poolKey),
      });
      toast(`Liquidity removed: ${data.txHash.slice(0, 10)}...`, "success");
    },
    onError: (err) => {
      toast(`Remove liquidity failed: ${err.message}`, "error");
    },
  });
}
