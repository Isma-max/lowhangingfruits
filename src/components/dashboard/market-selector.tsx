"use client";

import { MARKETS } from "@/lib/mock-data";
import { MarketId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MarketSelectorProps {
  selected: MarketId;
  onChange: (id: MarketId) => void;
}

export function MarketSelector({ selected, onChange }: MarketSelectorProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {MARKETS.map((market) => {
        const isActive = market.id === selected;
        return (
          <button
            key={market.id}
            onClick={() => onChange(market.id as MarketId)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-[var(--accent)] text-white shadow-[0_0_12px_rgba(124,106,247,0.3)]"
                : "bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
            )}
          >
            <span>{market.flag}</span>
            <span>{market.name}</span>
          </button>
        );
      })}
    </div>
  );
}
