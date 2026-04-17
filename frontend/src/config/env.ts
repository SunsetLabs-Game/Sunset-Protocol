function readEnv(key: string, fallback = ""): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function parseChainId(value: string): bigint | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "conflux-espace" || normalized === "conflux-espace-mainnet") {
    return 1030n;
  }

  if (normalized === "conflux-espace-testnet" || normalized === "conflux-testnet") {
    return 71n;
  }

  if (value.startsWith("0x") || value.startsWith("0X")) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }

  if (/^\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }

  return null;
}

function formatChainId(chainId: bigint | null): string {
  if (chainId === null) return "";
  return `0x${chainId.toString(16)}`;
}

const chainId = readEnv("VITE_CHAIN_ID", "0x406");
const parsedChainId = parseChainId(chainId);

export const env = {
  rpcUrl: readEnv("VITE_RPC_URL"),
  aspUrl: readEnv("VITE_ASP_URL", "http://localhost:3001"),
  chainId,
  chainIdHex: formatChainId(parsedChainId),
  chainName: readEnv("VITE_CHAIN_NAME", "Conflux eSpace"),
  explorerUrl: readEnv("VITE_EXPLORER_URL"),
  nativeCurrency: {
    name: readEnv("VITE_NATIVE_CURRENCY_NAME", "Conflux"),
    symbol: readEnv("VITE_NATIVE_CURRENCY_SYMBOL", "CFX"),
    decimals: Number(readEnv("VITE_NATIVE_CURRENCY_DECIMALS", "18")),
  },
  relayerAddress: readEnv("VITE_RELAYER_ADDRESS"),
  contracts: {
    pool: readEnv("VITE_POOL_ADDRESS"),
    coordinator: readEnv("VITE_COORDINATOR_ADDRESS"),
  },
} as const;
