import { useMutation } from "@tanstack/react-query";
import { useSdkStore } from "@/stores/sdkStore";
import { useWalletSession } from "@/providers/WalletProvider";
import { useToast } from "@/components/ui/Toast";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { buildShieldedWithdrawTx } from "@/config/evm";
import { env } from "@/config/env";

interface WithdrawInput {
  noteCommitment: string;
}

export function useWithdraw() {
  const client = useSdkStore((s) => s.client);
  const refreshBalances = useSdkStore((s) => s.refreshBalances);
  const { address, execute } = useWalletSession();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ noteCommitment }: WithdrawInput) => {
      if (!client) throw new Error("SDK not initialized");
      if (!address) throw new Error("Wallet not connected");
      if (!env.contracts.pool) throw new Error("Pool address is not configured");

      const noteManager = client.getNoteManager();
      const snapshot = noteManager.snapshot();

      try {
        const result = await client.withdraw({
          noteCommitment,
          recipient: address,
        });
        const txHash = await execute(
          buildShieldedWithdrawTx({
            poolAddress: env.contracts.pool,
            calldata: result.calldata,
          }),
        );
        await client.saveNotes();
        return { txHash, nullifierHash: result.nullifierHash };
      } catch (error) {
        noteManager.restore(snapshot);
        await client.saveNotes();
        throw error;
      }
    },
    onSuccess: (data) => {
      refreshBalances();
      queryClient.invalidateQueries({ queryKey: queryKeys.treeRoot() });
      toast(`Withdrawal confirmed: ${data.txHash.slice(0, 10)}...`, "success");
    },
    onError: (err) => {
      toast(`Withdrawal failed: ${err.message}`, "error");
    },
  });
}
