import { useSdkStore } from "@/stores/sdkStore";
import { TOKEN_0, TOKEN_1 } from "@/config/tokens";
import { formatTokenAmount } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function BalanceDisplay() {
  const isInitialized = useSdkStore((s) => s.isInitialized);
  const balances = useSdkStore((s) => s.balances);

  if (!isInitialized) {
    return null;
  }

  const token0Balance = TOKEN_0
    ? balances[TOKEN_0.address.toLowerCase()] ?? 0n
    : 0n;
  const token1Balance = TOKEN_1
    ? balances[TOKEN_1.address.toLowerCase()] ?? 0n
    : 0n;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        
        <h3 className="text-sm font-medium text-text-heading">Shielded Balances</h3>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-caption">{TOKEN_0?.symbol ?? "Token 0"}</span>
          <span className="text-base font-mono text-text-display">
            {TOKEN_0 ? formatTokenAmount(token0Balance, TOKEN_0.decimals) : "0"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-text-caption">{TOKEN_1?.symbol ?? "Token 1"}</span>
          <span className="text-base font-mono text-text-display">
            {TOKEN_1 ? formatTokenAmount(token1Balance, TOKEN_1.decimals) : "0"}
          </span>
        </div>
      </div>
    </Card>
  );
}
