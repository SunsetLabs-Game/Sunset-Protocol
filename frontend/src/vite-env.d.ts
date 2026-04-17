/// <reference types="vite/client" />

declare module "process";

interface ImportMetaEnv {
  readonly VITE_RPC_URL: string;
  readonly VITE_ASP_URL: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_CHAIN_NAME: string;
  readonly VITE_EXPLORER_URL: string;
  readonly VITE_NATIVE_CURRENCY_NAME: string;
  readonly VITE_NATIVE_CURRENCY_SYMBOL: string;
  readonly VITE_NATIVE_CURRENCY_DECIMALS: string;
  readonly VITE_POOL_ADDRESS: string;
  readonly VITE_COORDINATOR_ADDRESS: string;
  readonly VITE_RELAYER_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
