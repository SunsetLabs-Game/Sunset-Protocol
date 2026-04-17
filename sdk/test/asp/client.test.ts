import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AspClient } from "../../src/asp/client.js";

const baseUrl = "http://mock-asp.local";
let fetchSpy: ReturnType<typeof vi.spyOn>;

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("AspClient", () => {
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      const { pathname } = new URL(url);
      const method = init?.method ?? "GET";

      if (method === "POST" && pathname === "/deposit") {
        return jsonResponse({
          status: "prepared",
          leaf_index: 0,
          calldata: [],
          root: "0xroot",
        });
      }

      if (method === "POST" && pathname === "/withdraw") {
        return jsonResponse({
          status: "prepared",
          calldata: ["1", "2"],
          nullifier_hash: "0xnull123",
        });
      }

      if (method === "POST" && pathname === "/swap") {
        return jsonResponse({
          status: "prepared",
          calldata: ["3", "4"],
          final_root: "0xroot2",
          new_commitment: "0xnew",
          change_commitment: "0xchange",
        });
      }

      if (method === "GET" && pathname === "/tree/root") {
        return jsonResponse({ root: "0xroot", leaf_count: 5 });
      }

      if (method === "GET" && pathname.startsWith("/tree/path/")) {
        return jsonResponse({
          leaf_index: 0,
          commitment: "0xcomm",
          path_elements: ["0x1", "0x2"],
          path_indices: [0, 1],
          root: "0xroot",
        });
      }

      if (method === "GET" && pathname.startsWith("/nullifier/")) {
        return jsonResponse({
          nullifier_hash: "0xnull",
          spent: false,
          circuit_type: null,
          tx_hash: null,
        });
      }

      if (method === "GET" && pathname === "/status") {
        return jsonResponse({
          healthy: true,
          version: "0.1.0",
          tree: { leaf_count: 5, root: "0xroot" },
          sync: { last_synced_block: 100 },
          contracts: {
            coordinator: "0xcoord",
            pool: "0xpool",
          },
        });
      }

      return new Response("Not found", { status: 404 });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("deposit sends POST and returns response", async () => {
    const client = new AspClient(baseUrl);
    const res = await client.deposit({ commitment: "0xcommitment" });
    expect(res.calldata).toEqual([]);
    expect(res.leaf_index).toBe(0);
    expect(res.root).toBe("0xroot");
  });

  it("withdraw sends POST and returns response", async () => {
    const client = new AspClient(baseUrl);
    const res = await client.withdraw({
      secret: "1",
      nullifier: "2",
      amount_low: "100",
      amount_high: "0",
      token: "0x123",
      recipient: "0x456",
      leaf_index: 0,
    });
    expect(res.calldata).toEqual(["1", "2"]);
    expect(res.nullifier_hash).toBe("0xnull123");
  });

  it("swap sends POST and returns response", async () => {
    const client = new AspClient(baseUrl);
    const res = await client.swap({
      pool_key: { token_0: "0xa", token_1: "0xb", fee: 3000, tick_spacing: 60 },
      input_note: {
        secret: "1",
        nullifier: "2",
        balance_low: "100",
        balance_high: "0",
        token: "0xa",
        leaf_index: 0,
      },
      swap_params: {
        token_in: "0xa",
        token_out: "0xb",
        amount_in: "50",
        amount_out_min: "40",
        amount_out_low: "45",
        amount_out_high: "0",
      },
      output_note: { secret: "3", nullifier: "4" },
      change_note: { secret: "5", nullifier: "6" },
      sqrt_price_limit: "0x0",
    });
    expect(res.calldata).toEqual(["3", "4"]);
    expect(res.final_root).toBe("0xroot2");
    expect(res.new_commitment).toBe("0xnew");
    expect(res.change_commitment).toBe("0xchange");
  });

  it("getTreeRoot sends GET and returns response", async () => {
    const client = new AspClient(baseUrl);
    const res = await client.getTreeRoot();
    expect(res.root).toBe("0xroot");
    expect(res.leaf_count).toBe(5);
  });

  it("getTreePath sends GET and returns response", async () => {
    const client = new AspClient(baseUrl);
    const res = await client.getTreePath(0);
    expect(res.leaf_index).toBe(0);
    expect(res.path_elements).toHaveLength(2);
  });

  it("getNullifier sends GET and returns response", async () => {
    const client = new AspClient(baseUrl);
    const res = await client.getNullifier("0xnull");
    expect(res.spent).toBe(false);
  });

  it("getStatus sends GET and returns response", async () => {
    const client = new AspClient(baseUrl);
    const res = await client.getStatus();
    expect(res.healthy).toBe(true);
    expect(res.version).toBe("0.1.0");
  });

  it("handles trailing slash in baseUrl", async () => {
    const client = new AspClient(baseUrl + "/");
    const res = await client.getStatus();
    expect(res.healthy).toBe(true);
  });

  it("handles server errors", async () => {
    // Use a different base URL to hit a non-existent server path
    const client = new AspClient(baseUrl + "/nonexistent");
    await expect(client.getStatus()).rejects.toThrow("404");
  });
});
