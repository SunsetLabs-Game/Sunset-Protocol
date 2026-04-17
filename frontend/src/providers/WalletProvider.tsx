import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { BrowserProvider } from "ethers";
import { env } from "@/config/env";
import { getWalletChainConfig, type EvmTransactionRequest } from "@/config/evm";

interface InjectedWalletProvider {
  request: (args: {
    method: string;
    params?: unknown[] | object;
  }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

interface WalletContextValue {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  walletName: string | null;
  chainId: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  execute: (transactions: EvmTransactionRequest | EvmTransactionRequest[]) => Promise<string>;
}

declare global {
  interface Window {
    ethereum?: InjectedWalletProvider;
    conflux?: InjectedWalletProvider;
  }
}

const WalletContext = createContext<WalletContextValue | null>(null);

function getInjectedProvider(): InjectedWalletProvider | undefined {
  return window.ethereum ?? window.conflux;
}

function getWalletLabel(provider: InjectedWalletProvider | undefined): string | null {
  if (!provider) return null;
  if (window.conflux === provider) return "Conflux Wallet";
  return "Injected Wallet";
}

function normalizeChainId(chainId: unknown): string | null {
  if (typeof chainId !== "string") return null;
  if (!chainId.startsWith("0x")) return null;
  return chainId.toLowerCase();
}

async function ensureWalletChain(provider: InjectedWalletProvider): Promise<void> {
  if (!env.chainIdHex) {
    return;
  }

  const currentChainId = normalizeChainId(
    await provider.request({ method: "eth_chainId" }),
  );

  if (currentChainId === env.chainIdHex.toLowerCase()) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: env.chainIdHex }],
    });
    return;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? Number((error as { code?: unknown }).code)
      : undefined;

    if (code !== 4902) {
      throw error;
    }
  }

  const chainConfig = getWalletChainConfig();
  if (!chainConfig) {
    throw new Error("Conflux wallet chain configuration is incomplete.");
  }

  await provider.request({
    method: "wallet_addEthereumChain",
    params: [chainConfig],
  });
}

export function useWalletSession() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWalletSession must be used within WalletProvider");
  }
  return ctx;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setAddress(null);
      setWalletName(null);
      setChainId(null);
      return;
    }

    const browserProvider = new BrowserProvider(provider, "any");
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    const normalizedAddress = accounts?.[0] ?? null;
    const network = await browserProvider.getNetwork();

    setAddress(normalizedAddress);
    setWalletName(normalizedAddress ? getWalletLabel(provider) : null);
    setChainId(`0x${network.chainId.toString(16)}`);
  }, []);

  useEffect(() => {
    void refreshSession();

    const provider = getInjectedProvider();
    if (!provider?.on || !provider.removeListener) {
      return;
    }

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      const nextAddress = accounts[0] ?? null;
      setAddress(nextAddress);
      setWalletName(nextAddress ? getWalletLabel(provider) : null);
    };

    const handleChainChanged = async (...args: unknown[]) => {
      const nextChainId = args[0];
      setChainId(normalizeChainId(nextChainId));
      await refreshSession();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refreshSession]);

  const connect = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      throw new Error("No compatible injected wallet was found.");
    }

    setIsConnecting(true);
    try {
      await ensureWalletChain(provider);

      const browserProvider = new BrowserProvider(provider, "any");
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      const nextAddress = accounts?.[0] ?? null;
      if (!nextAddress) {
        throw new Error("No accounts returned from wallet");
      }

      const network = await browserProvider.getNetwork();
      setAddress(nextAddress);
      setWalletName(getWalletLabel(provider));
      setChainId(`0x${network.chainId.toString(16)}`);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setAddress(null);
    setWalletName(null);
    setChainId(null);
  }, []);

  const execute = useCallback(async (transactions: EvmTransactionRequest | EvmTransactionRequest[]) => {
    const provider = getInjectedProvider();
    if (!provider) {
      throw new Error("No compatible injected wallet was found.");
    }

    const steps = Array.isArray(transactions) ? transactions : [transactions];
    if (steps.length === 0) {
      throw new Error("No wallet transactions were provided.");
    }

    if (!address) {
      await connect();
    } else {
      await ensureWalletChain(provider);
    }

    const browserProvider = new BrowserProvider(provider, "any");
    const signer = await browserProvider.getSigner();
    let lastHash = "";

    for (const tx of steps) {
      const response = await signer.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ?? 0n,
      });
      lastHash = response.hash;
      await response.wait();
    }

    return lastHash;
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        walletName,
        chainId,
        connect,
        disconnect,
        execute,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
