import { Interface } from "ethers";
import { env } from "@/config/env";

export interface EvmTransactionRequest {
  to: string;
  data: string;
  value?: bigint;
  label?: string;
}

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
] as const;

const SUNSET_POOL_ABI = [
  "function swap(bool zeroForOne, uint256 amountIn, uint160 sqrtPriceLimitX96, address recipient) returns (uint256 amountOut)",
  "function mint(uint128 liquidityDelta, address recipient) returns (uint256 amount0, uint256 amount1)",
  "function burn(uint128 liquidityDelta, address recipient) returns (uint256 amount0, uint256 amount1)",
  "function collect(address recipient) returns (uint128 amount0, uint128 amount1)",
  "function shieldedDeposit(address token, uint256 amount, bytes32 commitment) returns (uint32 leafIndex)",
  "function shieldedSwap(bytes proofData, uint160 sqrtPriceLimitX96)",
  "function shieldedWithdraw(bytes proofData)",
  "function shieldedMint(bytes proofData, uint128 liquidityDelta)",
  "function shieldedBurn(bytes proofData, bytes32 positionCommitment, uint128 liquidityDelta)",
] as const;

const COORDINATOR_ABI = [
  "function submitMerkleRoot(bytes32 root)",
] as const;

const erc20Interface = new Interface(ERC20_ABI);
const poolInterface = new Interface(SUNSET_POOL_ABI);
const coordinatorInterface = new Interface(COORDINATOR_ABI);

function assertAddress(address: string, label: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`${label} must be a valid EVM address`);
  }

  return address;
}

function encodeCall(
  iface: Interface,
  method: string,
  args: readonly unknown[] = [],
): string {
  return iface.encodeFunctionData(method, args);
}

function parseWordToBytes32(word: string): Uint8Array {
  const normalized = word.trim();
  const value = normalized.startsWith("0x") || normalized.startsWith("0X")
    ? BigInt(normalized)
    : BigInt(normalized);
  const hex = value.toString(16).padStart(64, "0");
  return Uint8Array.from(hex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)));
}

function encodeProofCalldata(words: string[]): string {
  const bytes = words.flatMap((word) => Array.from(parseWordToBytes32(word)));
  return `0x${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function getWalletChainConfig() {
  if (!env.chainIdHex || !env.rpcUrl) {
    return null;
  }

  return {
    chainId: env.chainIdHex,
    chainName: env.chainName,
    rpcUrls: [env.rpcUrl],
    nativeCurrency: env.nativeCurrency,
    blockExplorerUrls: env.explorerUrl ? [env.explorerUrl] : undefined,
  };
}

export function buildErc20ApprovalTx(
  tokenAddress: string,
  spender: string,
  amount: bigint,
  label = "Approve token",
): EvmTransactionRequest {
  const token = assertAddress(tokenAddress, "tokenAddress");
  const target = assertAddress(spender, "spender");

  return {
    to: token,
    data: encodeCall(erc20Interface, "approve", [target, amount]),
    label,
  };
}

export function buildErc20TransferTx(
  tokenAddress: string,
  recipient: string,
  amount: bigint,
  label = "Transfer token",
): EvmTransactionRequest {
  const token = assertAddress(tokenAddress, "tokenAddress");
  const target = assertAddress(recipient, "recipient");

  return {
    to: token,
    data: encodeCall(erc20Interface, "transfer", [target, amount]),
    label,
  };
}

export function buildPoolSwapTx(params: {
  poolAddress: string;
  zeroForOne: boolean;
  amountIn: bigint;
  sqrtPriceLimitX96: bigint;
  recipient: string;
}): EvmTransactionRequest {
  return {
    to: assertAddress(params.poolAddress, "poolAddress"),
    data: encodeCall(poolInterface, "swap", [
      params.zeroForOne,
      params.amountIn,
      params.sqrtPriceLimitX96,
      assertAddress(params.recipient, "recipient"),
    ]),
    label: "Execute swap",
  };
}

export function buildPoolMintTx(params: {
  poolAddress: string;
  liquidityDelta: bigint;
  recipient: string;
}): EvmTransactionRequest {
  return {
    to: assertAddress(params.poolAddress, "poolAddress"),
    data: encodeCall(poolInterface, "mint", [
      params.liquidityDelta,
      assertAddress(params.recipient, "recipient"),
    ]),
    label: "Add liquidity",
  };
}

export function buildShieldedDepositTx(params: {
  poolAddress: string;
  tokenAddress: string;
  amount: bigint;
  commitment: string;
}): EvmTransactionRequest {
  return {
    to: assertAddress(params.poolAddress, "poolAddress"),
    data: encodeCall(poolInterface, "shieldedDeposit", [
      assertAddress(params.tokenAddress, "tokenAddress"),
      params.amount,
      params.commitment,
    ]),
    label: "Shield deposit",
  };
}

export function buildShieldedWithdrawTx(params: {
  poolAddress: string;
  calldata: string[];
}): EvmTransactionRequest {
  return {
    to: assertAddress(params.poolAddress, "poolAddress"),
    data: encodeCall(poolInterface, "shieldedWithdraw", [
      encodeProofCalldata(params.calldata),
    ]),
    label: "Shielded withdraw",
  };
}

export function buildShieldedSwapTx(params: {
  poolAddress: string;
  calldata: string[];
  sqrtPriceLimitX96: bigint;
}): EvmTransactionRequest {
  return {
    to: assertAddress(params.poolAddress, "poolAddress"),
    data: encodeCall(poolInterface, "shieldedSwap", [
      encodeProofCalldata(params.calldata),
      params.sqrtPriceLimitX96,
    ]),
    label: "Shielded swap",
  };
}

export function buildShieldedMintTx(params: {
  poolAddress: string;
  calldata: string[];
  liquidityDelta: bigint;
}): EvmTransactionRequest {
  return {
    to: assertAddress(params.poolAddress, "poolAddress"),
    data: encodeCall(poolInterface, "shieldedMint", [
      encodeProofCalldata(params.calldata),
      params.liquidityDelta,
    ]),
    label: "Shielded mint",
  };
}

export function buildShieldedBurnTx(params: {
  poolAddress: string;
  calldata: string[];
  positionCommitment: string;
  liquidityDelta: bigint;
}): EvmTransactionRequest {
  return {
    to: assertAddress(params.poolAddress, "poolAddress"),
    data: encodeCall(poolInterface, "shieldedBurn", [
      encodeProofCalldata(params.calldata),
      params.positionCommitment,
      params.liquidityDelta,
    ]),
    label: "Shielded burn",
  };
}

export function buildSubmitMerkleRootTx(params: {
  coordinatorAddress: string;
  root: string;
}): EvmTransactionRequest {
  return {
    to: assertAddress(params.coordinatorAddress, "coordinatorAddress"),
    data: encodeCall(coordinatorInterface, "submitMerkleRoot", [params.root]),
    label: "Submit Merkle root",
  };
}

export function buildPoolBurnTx(params: {
  poolAddress: string;
  liquidityDelta: bigint;
  recipient: string;
}): EvmTransactionRequest {
  return {
    to: assertAddress(params.poolAddress, "poolAddress"),
    data: encodeCall(poolInterface, "burn", [
      params.liquidityDelta,
      assertAddress(params.recipient, "recipient"),
    ]),
    label: "Remove liquidity",
  };
}
