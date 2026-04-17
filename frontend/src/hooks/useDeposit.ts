import { useMutation } from "@tanstack/react-query";
import { useSdkStore } from "@/stores/sdkStore";
import { useWalletSession } from "@/providers/WalletProvider";
import { useToast } from "@/components/ui/Toast";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import {
  generateRandomSecret,
} from "@sunset/sdk";
import {
  buildErc20ApprovalTx,
  buildShieldedDepositTx,
  buildSubmitMerkleRootTx,
} from "@/config/evm";
import { env } from "@/config/env";

interface DepositInput {
  amount: bigint;
  token: string;
}

export function useDeposit() {
  const client = useSdkStore((s) => s.client);
  const refreshBalances = useSdkStore((s) => s.refreshBalances);
  const { execute } = useWalletSession();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ amount, token }: DepositInput) => {
      if (!client) throw new Error("SDK not initialized");
      if (!env.contracts.pool) {
        throw new Error("Pool address is not configured");
      }
      if (!env.contracts.coordinator) {
        throw new Error("Coordinator address is not configured");
      }

      const secret = generateRandomSecret();
      const nullifier = generateRandomSecret();
      const noteManager = client.getNoteManager();
      const snapshot = noteManager.snapshot();

      try {
        const prepared = await client.deposit({
          secret,
          nullifier,
          amount,
          token,
        });

        const commitmentHex = `0x${BigInt(prepared.commitment).toString(16)}`;
        const txHash = await execute([
          buildErc20ApprovalTx(
            token,
            env.contracts.pool,
            amount,
            "Approve shield deposit",
          ),
          buildShieldedDepositTx({
            poolAddress: env.contracts.pool,
            tokenAddress: token,
            amount,
            commitment: commitmentHex,
          }),
          buildSubmitMerkleRootTx({
            coordinatorAddress: env.contracts.coordinator,
            root: prepared.root,
          }),
        ]);

        await client.saveNotes();
        return { txHash, leafIndex: prepared.leafIndex, commitment: prepared.commitment };
      } catch (error) {
        noteManager.restore(snapshot);
        await client.saveNotes();
        throw error;
      }
    },
    onSuccess: (data) => {
      refreshBalances();
      queryClient.invalidateQueries({ queryKey: queryKeys.treeRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.merkleRoot() });
      toast(`Deposit confirmed (leaf ${data.leafIndex})`, "success");
    },
    onError: (err) => {
      toast(`Deposit failed: ${err.message}`, "error");
    },
  });
}
