import { useMemo } from "react";
import { motion } from "motion/react";
import { createLiquidityScale, formatChartNumber } from "@/lib/charts";
import type { PoolState } from "@sunset/sdk";

interface LiquidityDepthChartProps {
  poolState: PoolState;
  className?: string;
}

/**
 * Visualizes current pool liquidity as a horizontal bar.
 * Shows real-time snapshot of total liquidity in the pool.
 */
export function LiquidityDepthChart({
  poolState,
  className = "",
}: LiquidityDepthChartProps) {
  const chartWidth = 400;
  const chartHeight = 120;
  const padding = 20;

  const scale = useMemo(
    () =>
      createLiquidityScale(poolState.liquidity, chartHeight, padding),
    [poolState.liquidity]
  );

  const barWidth = scale(Number(poolState.liquidity));
  const displayValue = formatChartNumber(poolState.liquidity);

  return (
    <div
      className={`rounded-xl border border-border/45 bg-gradient-to-br from-surface-elevated/90 to-surface/45 p-5 ${className}`}
    >
      <div className="mb-4">
        <p className="text-xs font-semibold tracking-widest uppercase text-text-caption mb-1">
          Total Liquidity
        </p>
        <p className="text-2xl font-bold text-text-display font-mono">
          {displayValue}
        </p>
      </div>

      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="overflow-visible"
      >
        {/* Background track */}
        <rect
          x={padding}
          y={padding}
          width={chartWidth - padding * 2}
          height={chartHeight - padding * 2}
          rx={8}
          fill="rgba(17, 17, 17, 0.05)"
          stroke="rgba(17, 17, 17, 0.12)"
          strokeWidth={1}
        />

        {/* Animated liquidity bar */}
        <motion.rect
          initial={{ width: 0 }}
          animate={{ width: barWidth }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          x={padding}
          y={padding}
          height={chartHeight - padding * 2}
          rx={8}
          fill="url(#liquidityGradient)"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="liquidityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#111111" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#111111" stopOpacity={0.78} />
          </linearGradient>
        </defs>

        {/* Value label */}
        <motion.text
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          x={padding + 12}
          y={chartHeight / 2 + 6}
          fill="rgba(17, 17, 17, 0.85)"
          fontSize={14}
          fontWeight="600"
          fontFamily="monospace"
        >
          Active
        </motion.text>
      </svg>

      <p className="text-xs text-text-caption mt-3 italic">
        Current snapshot of pool liquidity (updates every 12s)
      </p>
    </div>
  );
}
