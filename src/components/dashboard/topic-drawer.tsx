"use client";

import { Topic, MarketId } from "@/lib/types";
import { MARKETS } from "@/lib/mock-data";
import { ScorePill, scoreColor, categoryColor } from "@/components/ui/score-pill";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, Globe, MapPin, Tv, Clock, AlertTriangle, ExternalLink } from "lucide-react";

interface TopicDrawerProps {
  topic: Topic | null;
  selectedMarket: MarketId;
  onClose: () => void;
}

function RiskBadge({ risk }: { risk: Topic["monetization_risk"] }) {
  if (risk === "low") return <Badge variant="green">Low risk</Badge>;
  if (risk === "medium") return <Badge variant="yellow">Medium risk</Badge>;
  return <Badge variant="red">High risk</Badge>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

export function TopicDrawer({ topic, selectedMarket, onClose }: TopicDrawerProps) {
  if (!topic) return null;

  const getMarket = (id: string) => MARKETS.find((m) => m.id === id);
  const origin = getMarket(topic.origin_region_id);
  const currentMarket = getMarket(selectedMarket);
  const ms = topic.market_scores[selectedMarket];

  const allMarkets = MARKETS.filter((m) => topic.market_scores[m.id])
    .sort((a, b) => topic.market_scores[b.id].master_score - topic.market_scores[a.id].master_score);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[var(--surface)] border-l border-[var(--border)] z-50 overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] px-5 py-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="muted">{topic.category_tag}</Badge>
              <RiskBadge risk={topic.monetization_risk} />
            </div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] leading-snug">{topic.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Origin + Meta */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <MapPin size={13} className="text-[var(--text-muted)]" />
              <span>{origin?.flag} {origin?.name}</span>
              {topic.origin_city && <span className="text-[var(--text-muted)]">· {topic.origin_city}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <Tv size={13} className="text-[var(--text-muted)]" />
              <span>{topic.platform}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <Clock size={13} className="text-[var(--text-muted)]" />
              <span>{topic.suggested_duration}</span>
            </div>
          </div>

          {/* Summary */}
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{topic.summary}</p>

          {/* Score for current market */}
          {ms && (
            <Section title={`Score — ${currentMarket?.flag} ${currentMarket?.name}`}>
              <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-[var(--text-muted)]">Master Score</span>
                  <ScorePill score={ms.master_score} size="lg" showCategory category={ms.category} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Trend", value: ms.trend_score, color: "var(--accent)" },
                    { label: "Editorial", value: ms.editorial_score, color: "var(--blue)" },
                    { label: "Revenue", value: ms.revenue_score, color: "var(--green)" },
                    { label: "Geo", value: ms.geo_score, color: "var(--yellow)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)]">{label}</span>
                        <span className="text-xs font-mono font-bold" style={{ color }}>{value}</span>
                      </div>
                      <div className="score-bar">
                        <div className="score-bar-fill" style={{ width: `${value}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* Angle & Hook for current market */}
          {(topic.angles[selectedMarket] || topic.hooks[selectedMarket]) && (
            <Section title="Editorial Recommendation">
              <div className="space-y-3">
                {topic.angles[selectedMarket] && (
                  <div className="bg-[var(--accent-soft)] rounded-lg border border-[rgba(124,106,247,0.2)] p-3">
                    <div className="text-xs text-[var(--accent)] font-semibold mb-1">Angle</div>
                    <div className="text-sm text-[var(--text-primary)]">{topic.angles[selectedMarket]}</div>
                  </div>
                )}
                {topic.hooks[selectedMarket] && (
                  <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border)] p-3">
                    <div className="text-xs text-[var(--text-muted)] font-semibold mb-1">Hook</div>
                    <div className="text-sm text-[var(--text-primary)] italic">"{topic.hooks[selectedMarket]}"</div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Format */}
          <Section title="Production">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border)] p-3 text-center">
                <div className="text-xs text-[var(--text-muted)] mb-1">Format</div>
                <div className="text-xs text-[var(--text-primary)] font-medium">{topic.suggested_format}</div>
              </div>
              <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border)] p-3 text-center">
                <div className="text-xs text-[var(--text-muted)] mb-1">Duration</div>
                <div className="text-xs text-[var(--text-primary)] font-medium">{topic.suggested_duration}</div>
              </div>
              <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border)] p-3 text-center">
                <div className="text-xs text-[var(--text-muted)] mb-1">Platform</div>
                <div className="text-xs text-[var(--text-primary)] font-medium">{topic.platform}</div>
              </div>
            </div>
            {topic.thumbnail_concept && (
              <div className="mt-2 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] p-3">
                <div className="text-xs text-[var(--text-muted)] mb-1">Thumbnail concept</div>
                <div className="text-xs text-[var(--text-primary)]">{topic.thumbnail_concept}</div>
              </div>
            )}
          </Section>

          {/* Market scores table */}
          <Section title="All Market Scores">
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <th className="text-left px-3 py-2 text-xs text-[var(--text-muted)]">Market</th>
                    <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Score</th>
                    <th className="text-center px-3 py-2 text-xs text-[var(--text-muted)]">Cat</th>
                    <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allMarkets.map((market) => {
                    const score = topic.market_scores[market.id];
                    const isSelected = market.id === selectedMarket;
                    const angle = topic.angles[market.id];
                    return (
                      <tr
                        key={market.id}
                        className={cn(
                          "border-b border-[var(--border)] last:border-0",
                          isSelected && "bg-[var(--accent-soft)]"
                        )}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{market.flag}</span>
                            <span className={cn("text-xs", isSelected ? "text-[var(--accent)] font-semibold" : "text-[var(--text-secondary)]")}>
                              {market.name}
                            </span>
                          </div>
                          {angle && (
                            <div className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1 italic pl-5">
                              {angle}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ScorePill score={score.master_score} size="sm" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("text-xs font-bold font-mono", scoreColor(score.master_score))}>
                            {score.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {score.master_score >= 90
                            ? <Badge variant="green">Now</Badge>
                            : score.master_score >= 75
                            ? <Badge variant="purple">Watch</Badge>
                            : <Badge variant="muted">Skip</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Sources */}
          <Section title="Sources">
            <div className="space-y-1.5">
              {topic.sources.map((source, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                  <span className="text-xs text-[var(--text-primary)] flex-1">{source.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(source.published_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
