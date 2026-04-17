import { useSdkStore } from "@/stores/sdkStore";
import { TESTNET_TOKENS } from "@/config/tokens";
import { formatTokenAmount } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function BalanceDisplay() {
  const isInitialized = useSdkStore((s) => s.isInitialized);
  const balances = useSdkStore((s) => s.balances);

  if (!isInitialized) {
    return null;
  }

  const ethToken = TESTNET_TOKENS.find((t) => t.symbol === "ETH");
  const sunToken = TESTNET_TOKENS.find((t) => t.symbol === "SUN");

  const ethBalance = ethToken
    ? balances[ethToken.address.toLowerCase()] ?? 0n
    : 0n;
  const sunBalance = sunToken
    ? balances[sunToken.address.toLowerCase()] ?? 0n
    : 0n;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        
        <h3 className="text-sm font-medium text-text-heading">Shielded Balances</h3>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-caption">ETH</span>
          <span className="text-base font-mono text-text-display">
            {ethToken ? formatTokenAmount(ethBalance, ethToken.decimals) : "0"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-text-caption">SUN</span>
          <span className="text-base font-mono text-text-display">
            {sunToken ? formatTokenAmount(sunBalance, sunToken.decimals) : "0"}
          </span>
        </div>
      </div>
    </Card>
  );
}
