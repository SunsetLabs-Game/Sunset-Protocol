import { cn } from "@/lib/cn";
import { motion } from "motion/react";

interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div className={cn("relative flex gap-2 p-1 bg-surface/45 backdrop-blur-md rounded-2xl border border-border/60 shadow-[0_10px_30px_rgba(17,17,17,0.06)]", className)}>
      {items.map((item) => {
        const isActive = value === item.value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative px-6 py-3 text-sm font-bold tracking-widest uppercase transition-colors duration-300 z-10 w-full rounded-xl",
              isActive ? "text-text-display" : "text-text-caption hover:text-text-body"
            )}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {isActive && (
              <motion.span
                layoutId="bubble"
                className="absolute inset-0 z-[-1] bg-surface-elevated border border-border/60 shadow-[0_10px_24px_rgba(17,17,17,0.08)] rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
