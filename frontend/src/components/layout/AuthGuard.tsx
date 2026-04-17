import { type ReactNode } from "react";
import { useWalletSession } from "@/providers/WalletProvider";
import { Navigate } from "react-router";

/**
 * Redirects to landing page if wallet is not connected.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isConnected } = useWalletSession();

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
