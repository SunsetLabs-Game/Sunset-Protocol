import { Interface } from "ethers";

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

function isFailure<T>(response: JsonRpcResponse<T>): response is JsonRpcFailure {
  return "error" in response;
}

export class ConfluxRpcClient {
  private nextId = 1;

  constructor(private readonly rpcUrl: string) {
    if (!rpcUrl) {
      throw new Error("rpcUrl is required");
    }
  }

  async request<T>(method: string, params: unknown[] = []): Promise<T> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.nextId++,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as JsonRpcResponse<T>;
    if (isFailure(payload)) {
      throw new Error(`RPC ${method} failed: ${payload.error.message}`);
    }

    return payload.result;
  }

  async call<T = unknown>(
    address: string,
    abi: Interface | readonly string[],
    functionName: string,
    args: readonly unknown[] = [],
  ): Promise<T> {
    const iface = abi instanceof Interface ? abi : new Interface(abi);
    const data = iface.encodeFunctionData(functionName, [...args]);
    const result = await this.request<string>("eth_call", [{ to: address, data }, "latest"]);
    const decoded = iface.decodeFunctionResult(functionName, result);
    return decoded[0] as T;
  }

  async getBlockNumber(): Promise<number> {
    const blockNumberHex = await this.request<string>("eth_blockNumber");
    return Number.parseInt(blockNumberHex, 16);
  }
}
