import { Interface } from "ethers";
import type { PoolKey, PoolState, Position } from "../types/index.js";
import { ConfluxRpcClient } from "./rpc.js";

const POOL_READER_ABI = [
  "function sqrtPriceX96() view returns (uint160)",
  "function totalLiquidity() view returns (uint128)",
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
  "function protocolFees0() view returns (uint128)",
  "function protocolFees1() view returns (uint128)",
  "function getPosition(address owner) view returns (tuple(uint128 liquidity, uint256 feeGrowth0LastX128, uint256 feeGrowth1LastX128, uint128 tokensOwed0, uint128 tokensOwed1))",
] as const;

const poolReaderInterface = new Interface(POOL_READER_ABI);
const Q128 = 2 ** 128;

function approximateTickFromSqrtPriceX96(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 <= 0n) {
    return 0;
  }

  const ratio = Number(sqrtPriceX96) / Q128;
  const price = ratio * ratio;
  if (!Number.isFinite(price) || price <= 0) {
    return 0;
  }

  return Math.round(Math.log(price) / Math.log(1.0001));
}

export class PoolReader {
  constructor(
    private readonly rpc: ConfluxRpcClient,
    private readonly poolAddress: string,
  ) {}

  async getPoolState(_poolKey: PoolKey): Promise<PoolState> {
    const [
      sqrtPrice,
      liquidity,
      feeGrowthGlobal0,
      feeGrowthGlobal1,
      protocolFees0,
      protocolFees1,
    ] = await Promise.all([
      this.rpc.call<bigint>(this.poolAddress, poolReaderInterface, "sqrtPriceX96"),
      this.rpc.call<bigint>(this.poolAddress, poolReaderInterface, "totalLiquidity"),
      this.rpc.call<bigint>(this.poolAddress, poolReaderInterface, "feeGrowthGlobal0X128"),
      this.rpc.call<bigint>(this.poolAddress, poolReaderInterface, "feeGrowthGlobal1X128"),
      this.rpc.call<bigint>(this.poolAddress, poolReaderInterface, "protocolFees0"),
      this.rpc.call<bigint>(this.poolAddress, poolReaderInterface, "protocolFees1"),
    ]);

    return {
      sqrtPrice,
      tick: approximateTickFromSqrtPriceX96(sqrtPrice),
      liquidity,
      feeGrowthGlobal0,
      feeGrowthGlobal1,
      protocolFees0,
      protocolFees1,
    };
  }

  async getPosition(
    _poolKey: PoolKey,
    owner: string,
    _tickLower: number,
    _tickUpper: number,
  ): Promise<Position> {
    const position = await this.rpc.call<{
      liquidity: bigint;
      feeGrowth0LastX128: bigint;
      feeGrowth1LastX128: bigint;
      tokensOwed0: bigint;
      tokensOwed1: bigint;
    }>(this.poolAddress, poolReaderInterface, "getPosition", [owner]);

    return {
      liquidity: position.liquidity,
      feeGrowthInside0Last: position.feeGrowth0LastX128,
      feeGrowthInside1Last: position.feeGrowth1LastX128,
      tokensOwed0: position.tokensOwed0,
      tokensOwed1: position.tokensOwed1,
    };
  }
}
