import { Interface } from "ethers";
import { ConfluxRpcClient } from "./rpc.js";

const COORDINATOR_READER_ABI = [
  "function isNullifierSpent(bytes32 nullifierHash) view returns (bool)",
  "function isKnownRoot(bytes32 root) view returns (bool)",
  "function getCurrentRoot() view returns (bytes32)",
  "function nextLeafIndex() view returns (uint32)",
  "function paused() view returns (bool)",
] as const;

const coordinatorReaderInterface = new Interface(COORDINATOR_READER_ABI);

function normalizeBytes32(value: string): string {
  if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return value.toLowerCase();
  }

  const normalized = BigInt(value).toString(16).padStart(64, "0");
  return `0x${normalized}`;
}

export class CoordinatorReader {
  constructor(
    private readonly rpc: ConfluxRpcClient,
    private readonly coordinatorAddress: string,
  ) {}

  async isNullifierSpent(nullifierHash: string): Promise<boolean> {
    return this.rpc.call<boolean>(
      this.coordinatorAddress,
      coordinatorReaderInterface,
      "isNullifierSpent",
      [normalizeBytes32(nullifierHash)],
    );
  }

  async isKnownRoot(root: string): Promise<boolean> {
    return this.rpc.call<boolean>(
      this.coordinatorAddress,
      coordinatorReaderInterface,
      "isKnownRoot",
      [normalizeBytes32(root)],
    );
  }

  async getMerkleRoot(): Promise<bigint> {
    const root = await this.rpc.call<string>(
      this.coordinatorAddress,
      coordinatorReaderInterface,
      "getCurrentRoot",
    );

    return BigInt(root);
  }

  async getNextLeafIndex(): Promise<number> {
    const nextLeafIndex = await this.rpc.call<bigint>(
      this.coordinatorAddress,
      coordinatorReaderInterface,
      "nextLeafIndex",
    );

    return Number(nextLeafIndex);
  }

  async isPaused(): Promise<boolean> {
    return this.rpc.call<boolean>(
      this.coordinatorAddress,
      coordinatorReaderInterface,
      "paused",
    );
  }
}
