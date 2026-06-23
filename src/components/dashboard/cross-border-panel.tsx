"use client";

import { Topic, MarketId } from "@/lib/types";
import { MARKETS } from "@/lib/mock-data";
import { ScorePill } from "@/components/ui/score-pill";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface CrossBorderPanelProps {
  topics: Topic[];
  selectedMarket: MarketId;
  onSelectTopic: (topic: Topic) => void;
}

export function CrossBorderPanel({ topics, selectedMarket, onSelectTopic }: CrossBorderPanelProps) {
  const crossBorder = topics.filter(
    (t) =>
      t.is_cross_border &&
      t.cross_border_to?.includes(selectedMarket) &&
      t.cross_border_from !== selectedMarket
  );

  const getMarket = (id: string) => MARKETS.find((m) => m.id === id);

  if (crossBorder.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cross-border Opportunities</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Local news with regional potential</p>
        </div>
        <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          No cross-border opportunities for this market today
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cross-border Opportunities</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Local news with regional potential</p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {crossBorder.map((topic) => {
          const from = getMarket(topic.cross_border_from!);
          const ms = topic.market_scores[selectedMarket];
          const angle = topic.angles[selectedMarket] || topic.angles["latam"] || topic.title;
          return (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-2)] transition-colors text-left"
            >
              <div className="flex items-center gap-1 mt-0.5 shrink-0">
                <span className="text-sm">{from?.flag}</span>
                <ArrowRight size={12} className="text-[var(--accent)]" />
                <span className="text-sm">{MARKETS.find((m) => m.id === selectedMarket)?.flag}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text-primary)] font-medium line-clamp-1">
                  {topic.title}
                </div>
                <div className="text-xs text-[var(--accent)] mt-0.5 italic line-clamp-1">
                  "{angle}"
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[var(--text-muted)]">Origin: {from?.name}</span>
                  <Badge variant="purple">Exportable</Badge>
                </div>
              </div>
              {ms && <ScorePill score={ms.master_score} size="sm" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
