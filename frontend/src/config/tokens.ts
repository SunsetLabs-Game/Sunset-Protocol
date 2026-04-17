export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

function readToken(slot: number, defaults: Pick<Token, "symbol" | "name" | "decimals">): Token | null {
  const prefix = `VITE_TOKEN_${slot}`;
  const address = import.meta.env[`${prefix}_ADDRESS`];
  if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return null;
  }

  const symbol =
    (import.meta.env[`${prefix}_SYMBOL`] as string | undefined)?.trim() ||
    defaults.symbol;
  const name =
    (import.meta.env[`${prefix}_NAME`] as string | undefined)?.trim() ||
    defaults.name;
  const decimalsValue = import.meta.env[`${prefix}_DECIMALS`];
  const decimals =
    typeof decimalsValue === "string" && decimalsValue.trim().length > 0
      ? Number(decimalsValue)
      : defaults.decimals;

  return {
    address,
    symbol,
    name,
    decimals,
  };
}

const configuredTokens = [
  readToken(0, { symbol: "WBTC", name: "Wrapped Bitcoin", decimals: 8 }),
  readToken(1, { symbol: "USDT0", name: "USDT0", decimals: 6 }),
  readToken(2, { symbol: "SUN", name: "Sunset Token", decimals: 18 }),
].filter((token): token is Token => token !== null);

export const CONFIGURED_TOKENS = configuredTokens;
export const TESTNET_TOKENS = configuredTokens;

export function getConfiguredTokenPair(): [Token, Token] | null {
  if (CONFIGURED_TOKENS.length < 2) {
    return null;
  }

  return [CONFIGURED_TOKENS[0], CONFIGURED_TOKENS[1]];
}

export function getToken(address: string): Token | undefined {
  return CONFIGURED_TOKENS.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
}

export function getTokenSymbol(address: string): string {
  return getToken(address)?.symbol ?? `${address.slice(0, 6)}...${address.slice(-4)}`;
}
