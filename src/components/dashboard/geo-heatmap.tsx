"use client";

import { Topic, MarketId } from "@/lib/types";
import { MARKETS } from "@/lib/mock-data";
import { scoreColor, scoreBg } from "@/components/ui/score-pill";
import { cn } from "@/lib/utils";

interface GeoHeatmapProps {
  topic: Topic | null;
  selectedMarket: MarketId;
}

export function GeoHeatmap({ topic, selectedMarket }: GeoHeatmapProps) {
  const markets = MARKETS.filter((m) => m.id !== "global_es");

  if (!topic) {
    return (
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Geo Heatmap</h2>
        </div>
        <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          Select a topic to see geo distribution
        </div>
      </div>
    );
  }

  const sorted = [...markets]
    .filter((m) => topic.market_scores[m.id])
    .sort((a, b) => topic.market_scores[b.id].master_score - topic.market_scores[a.id].master_score);

  const max = sorted[0] ? topic.market_scores[sorted[0].id].master_score : 100;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Geo Heatmap</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{topic.title}</p>
      </div>
      <div className="p-4 space-y-2.5">
        {sorted.map((market) => {
          const ms = topic.market_scores[market.id];
          const isSelected = market.id === selectedMarket;
          const pct = Math.round((ms.master_score / max) * 100);
          return (
            <div key={market.id} className={cn("flex items-center gap-3", isSelected && "")}>
              <div className="flex items-center gap-1.5 w-28 shrink-0">
                <span className="text-sm">{market.flag}</span>
                <span className={cn("text-xs", isSelected ? "text-[var(--accent)] font-semibold" : "text-[var(--text-secondary)]")}>
                  {market.name}
                </span>
              </div>
              <div className="flex-1 score-bar relative">
                <div
                  className="score-bar-fill transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: ms.master_score >= 90
                      ? "var(--green)"
                      : ms.master_score >= 75
                      ? "var(--accent)"
                      : ms.master_score >= 60
                      ? "var(--yellow)"
                      : "var(--border)",
                    opacity: isSelected ? 1 : 0.6,
                  }}
                />
              </div>
              <span className={cn("text-xs font-mono font-bold w-7 text-right", scoreColor(ms.master_score))}>
                {ms.master_score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
