"use client";

import { Topic, MarketId } from "@/lib/types";
import { ScorePill, scoreColor } from "@/components/ui/score-pill";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Globe, TrendingUp } from "lucide-react";

interface OpportunityBoardProps {
  topics: Topic[];
  selectedMarket: MarketId;
  onSelectTopic: (topic: Topic) => void;
}

function ActionBadge({ score }: { score: number }) {
  if (score >= 90) return <Badge variant="green">Produce Now</Badge>;
  if (score >= 75) return <Badge variant="purple">Watch</Badge>;
  if (score >= 60) return <Badge variant="yellow">Consider</Badge>;
  return <Badge variant="muted">Skip</Badge>;
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="score-bar w-16">
      <div className="score-bar-fill" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export function OpportunityBoard({ topics, selectedMarket, onSelectTopic }: OpportunityBoardProps) {
  const sorted = [...topics]
    .filter((t) => t.market_scores[selectedMarket])
    .sort((a, b) => b.market_scores[selectedMarket].master_score - a.market_scores[selectedMarket].master_score);

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Opportunity Board</h2>
        <span className="text-xs text-[var(--text-muted)]">{sorted.length} topics</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
            <th className="text-left px-4 py-2 text-xs text-[var(--text-muted)] font-medium w-full">Topic</th>
            <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)] font-medium whitespace-nowrap">Score</th>
            <th className="text-center px-3 py-2 text-xs text-[var(--text-muted)] font-medium whitespace-nowrap hidden md:table-cell">Cat</th>
            <th className="text-center px-3 py-2 text-xs text-[var(--text-muted)] font-medium whitespace-nowrap hidden lg:table-cell">Trend</th>
            <th className="text-center px-3 py-2 text-xs text-[var(--text-muted)] font-medium whitespace-nowrap hidden lg:table-cell">Revenue</th>
            <th className="text-center px-3 py-2 text-xs text-[var(--text-muted)] font-medium whitespace-nowrap hidden lg:table-cell">Geo</th>
            <th className="text-right px-4 py-2 text-xs text-[var(--text-muted)] font-medium whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((topic, i) => {
            const ms = topic.market_scores[selectedMarket];
            return (
              <tr
                key={topic.id}
                onClick={() => onSelectTopic(topic)}
                className={cn(
                  "border-b border-[var(--border)] cursor-pointer transition-colors hover:bg-[var(--surface-2)] group",
                  i === 0 && "bg-[rgba(124,106,247,0.04)]"
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-[var(--text-muted)] font-mono mt-0.5 w-4 shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-sm text-[var(--text-primary)] font-medium leading-snug group-hover:text-white line-clamp-1">
                        {topic.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="muted">{topic.category_tag}</Badge>
                        {topic.is_cross_border && (
                          <span className="flex items-center gap-1 text-xs text-[var(--accent)]">
                            <Globe size={10} />
                            Cross-border
                          </span>
                        )}
                        <span className="text-xs text-[var(--text-muted)]">{topic.sources.length} sources</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <ScorePill score={ms.master_score} size="sm" />
                </td>
                <td className="px-3 py-3 text-center hidden md:table-cell">
                  <span className={cn("text-xs font-bold font-mono", scoreColor(ms.master_score))}>
                    {ms.category}
                  </span>
                </td>
                <td className="px-3 py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-2 justify-center">
                    <span className="text-xs font-mono text-[var(--text-secondary)] w-6 text-right">{ms.trend_score}</span>
                    <ScoreBar value={ms.trend_score} color="var(--accent)" />
                  </div>
                </td>
                <td className="px-3 py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-2 justify-center">
                    <span className="text-xs font-mono text-[var(--text-secondary)] w-6 text-right">{ms.revenue_score}</span>
                    <ScoreBar value={ms.revenue_score} color="var(--green)" />
                  </div>
                </td>
                <td className="px-3 py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-2 justify-center">
                    <span className="text-xs font-mono text-[var(--text-secondary)] w-6 text-right">{ms.geo_score}</span>
                    <ScoreBar value={ms.geo_score} color="var(--blue)" />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionBadge score={ms.master_score} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
