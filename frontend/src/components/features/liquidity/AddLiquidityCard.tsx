import { useState, useMemo } from "react";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProofProgress } from "@/components/features/shared/ProofProgress";
import { useMint } from "@/hooks/useMint";
import { useSdkStore } from "@/stores/sdkStore";
import { TOKEN_0, TOKEN_1 } from "@/config/tokens";
import { parseTokenAmount } from "@/lib/format";
import { FEE_TIERS } from "@sunset/sdk";
import type { PoolKey } from "@sunset/sdk";

export function AddLiquidityCard() {
  const isInitialized = useSdkStore((s) => s.isInitialized);
  const unspentNotes = useSdkStore((s) => s.unspentNotes);

  const token0 = TOKEN_0;
  const token1 = TOKEN_1;

  if (!token0 || !token1) {
    return (
      <div className="rounded-2xl border border-border/45 bg-surface/82 backdrop-blur-xl p-8 text-center">
        <p className="text-text-caption">Token pair not configured. Check VITE_TOKEN_0/1 env vars.</p>
      </div>
    );
  }

  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [tickLower, setTickLower] = useState("-69120");
  const [tickUpper, setTickUpper] = useState("600");

  const mint = useMint();

  // Find suitable notes
  const note0 = useMemo(() => {
    if (!amount0) return undefined;
    const parsed = parseTokenAmount(amount0, token0.decimals);
    return unspentNotes.find(
      n => n.token.toLowerCase() === token0.address.toLowerCase() && BigInt(n.amount) >= parsed
    );
  }, [unspentNotes, amount0, token0]);

  const note1 = useMemo(() => {
    if (!amount1) return undefined;
    const parsed = parseTokenAmount(amount1, token1.decimals);
    return unspentNotes.find(
      n => n.token.toLowerCase() === token1.address.toLowerCase() && BigInt(n.amount) >= parsed
    );
  }, [unspentNotes, amount1, token1]);

  const parsedAmount0 = amount0 ? parseTokenAmount(amount0, token0.decimals) : 0n;
  const parsedAmount1 = amount1 ? parseTokenAmount(amount1, token1.decimals) : 0n;

  const canAddLiquidity =
    isInitialized &&
    parsedAmount0 > 0n &&
    parsedAmount1 > 0n &&
    note0 &&
    note1 &&
    tickLower &&
    tickUpper &&
    parseInt(tickLower) < parseInt(tickUpper) &&
    !mint.isPending;

  const handleAddLiquidity = () => {
    if (!canAddLiquidity || !note0 || !note1) return;

    const [t0, t1] =
      BigInt(token0.address) < BigInt(token1.address)
        ? [token0.address, token1.address]
        : [token1.address, token0.address];

    const poolKey: PoolKey = {
      token0: t0,
      token1: t1,
      fee: FEE_TIERS.MEDIUM.fee,
      tickSpacing: FEE_TIERS.MEDIUM.tickSpacing,
    };

    const liquidity = parsedAmount0 > parsedAmount1 ? parsedAmount1 : parsedAmount0;

    mint.mutate({
      poolKey,
      inputNote0Commitment: note0.commitment,
      inputNote1Commitment: note1.commitment,
      tickLower: parseInt(tickLower),
      tickUpper: parseInt(tickUpper),
      liquidity,
      amount0: parsedAmount0,
      amount1: parsedAmount1,
    });
  };

  return (
    <>
      <div className="relative group overflow-hidden rounded-[24px] p-[1px] transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 w-full">
        <span className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,#c9a84c_100%)] pointer-events-none" />
        <span className="absolute inset-0 rounded-[24px] border border-border/45 transition-opacity duration-300 pointer-events-none group-hover:opacity-0" />

        <div className="relative z-10 bg-surface/82 backdrop-blur-xl p-6 sm:p-8 rounded-[23px] w-full h-full flex flex-col gap-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/40">
            <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center border border-border/50 shadow-[0_10px_20px_rgba(17,17,17,0.06)]">
              <svg className="w-5 h-5 text-text-display" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-text-display">
              Add Shielded Liquidity
            </h2>
          </div>

          <div className="rounded-xl border border-border/45 bg-surface-elevated/75 p-5 backdrop-blur-sm">
            <p className="text-sm font-bold tracking-widest uppercase text-text-display mb-2">Private Liquidity Provider</p>
            <p className="text-sm text-text-caption leading-relaxed">
              Add liquidity privately using your shielded notes. Your position will be encrypted and you'll earn fees without revealing your liquidity amount.
            </p>
          </div>

          <div className="space-y-5">
            <AmountInput label={`${token0.symbol} Amount`} placeholder="0.0" value={amount0} onChange={(e) => setAmount0(e.target.value)} tokenAddress={token0.address} />
            <AmountInput label={`${token1.symbol} Amount`} placeholder="0.0" value={amount1} onChange={(e) => setAmount1(e.target.value)} tokenAddress={token1.address} />

            <div className="space-y-3 p-5 rounded-xl border border-border/45 bg-gradient-to-br from-surface-elevated/90 to-surface/45">
              <p className="text-xs font-semibold tracking-widest uppercase text-text-caption">Price Range (ticks)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-text-disabled">Min Tick</label>
                  <Input type="text" inputMode="numeric" value={tickLower} onChange={(e) => {
                    if (e.target.value === "" || e.target.value === "-" || /^-?\d*$/.test(e.target.value)) setTickLower(e.target.value);
                  }} placeholder="-600" className="h-12 text-center font-mono text-lg bg-surface/55 border-border/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-text-disabled">Max Tick</label>
                  <Input type="text" inputMode="numeric" value={tickUpper} onChange={(e) => {
                    if (e.target.value === "" || e.target.value === "-" || /^-?\d*$/.test(e.target.value)) setTickUpper(e.target.value);
                  }} placeholder="600" className="h-12 text-center font-mono text-lg bg-surface/55 border-border/50" />
                </div>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-text-disabled pt-2 border-t border-border/40">Ticks must be multiples of 60. Current tick: -69082</p>
            </div>

            {parsedAmount0 > 0n && !note0 && (
              <div className="rounded-xl border border-signal-error/20 bg-signal-error/5 p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-signal-error/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-signal-error" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-signal-error">Insufficient {token0.symbol} shielding</p>
                  <p className="text-xs text-text-caption mt-1">Go to <a href="/app/shield" className="text-text-display hover:text-text-heading border-b border-text-display/30 hover:border-text-display transition-colors pb-0.5">Shield page</a> to deposit {token0.symbol} first.</p>
                </div>
              </div>
            )}
            {parsedAmount1 > 0n && !note1 && (
              <div className="rounded-xl border border-signal-error/20 bg-signal-error/5 p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-signal-error/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-signal-error" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-signal-error">Insufficient {token1.symbol} shielding</p>
                  <p className="text-xs text-text-caption mt-1">Go to <a href="/app/shield" className="text-text-display hover:text-text-heading border-b border-text-display/30 hover:border-text-display transition-colors pb-0.5">Shield page</a> to deposit {token1.symbol} first.</p>
                </div>
              </div>
            )}
          </div>

          <Button variant="primary" className="w-full text-base h-14" onClick={handleAddLiquidity} disabled={!canAddLiquidity} loading={mint.isPending}>
            {mint.isPending ? "Adding Liquidity..." : "Add Shielded Liquidity"}
          </Button>
        </div>
      </div>

      <ProofProgress open={mint.isPending} label="Adding Shielded Liquidity" />
    </>
  );
}
