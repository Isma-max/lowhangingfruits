"use client";

import { Topic, MarketId } from "@/lib/types";
import { ScorePill } from "@/components/ui/score-pill";
import { Badge } from "@/components/ui/badge";
import { MARKETS } from "@/lib/mock-data";

interface Top5TodayProps {
  topics: Topic[];
  selectedMarket: MarketId;
  onSelectTopic: (topic: Topic) => void;
}

export function Top5Today({ topics, selectedMarket, onSelectTopic }: Top5TodayProps) {
  const market = MARKETS.find((m) => m.id === selectedMarket);
  const top5 = [...topics]
    .filter((t) => t.market_scores[selectedMarket])
    .sort((a, b) => b.market_scores[selectedMarket].master_score - a.market_scores[selectedMarket].master_score)
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Top 5 Today — {market?.flag} {market?.name}
        </h2>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {top5.map((topic, i) => {
          const ms = topic.market_scores[selectedMarket];
          const angle = topic.angles[selectedMarket] || topic.angles["latam"] || topic.title;
          return (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-2)] transition-colors text-left"
            >
              <span className="text-2xl font-black text-[var(--border)] font-mono w-6 shrink-0 leading-tight">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text-primary)] font-medium line-clamp-1 leading-snug">
                  {topic.title}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1 italic">
                  "{angle}"
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="muted">{topic.category_tag}</Badge>
                  <span className="text-xs text-[var(--text-muted)]">{topic.platform}</span>
                  <span className="text-xs text-[var(--text-muted)]">{topic.suggested_duration}</span>
                </div>
              </div>
              <ScorePill score={ms.master_score} size="sm" showCategory category={ms.category} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
