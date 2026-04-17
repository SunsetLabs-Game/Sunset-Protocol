import { useEffect } from "react";
import { useWalletSession } from "@/providers/WalletProvider";
import { useWalletStore } from "@/stores/walletStore";

/**
 * Syncs wallet state into Zustand store.
 */
export function useWalletSync() {
  const { address, isConnected } = useWalletSession();
  const { setWallet, clearWallet } = useWalletStore();

  useEffect(() => {
    if (isConnected && address) {
      setWallet(address);
    } else {
      clearWallet();
    }
  }, [isConnected, address, setWallet, clearWallet]);
}
