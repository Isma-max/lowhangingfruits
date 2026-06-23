"use client";

import { useState } from "react";
import { MarketSelector } from "@/components/dashboard/market-selector";
import { OpportunityBoard } from "@/components/dashboard/opportunity-board";
import { Top5Today } from "@/components/dashboard/top5-today";
import { GeoHeatmap } from "@/components/dashboard/geo-heatmap";
import { CrossBorderPanel } from "@/components/dashboard/cross-border-panel";
import { TopicDrawer } from "@/components/dashboard/topic-drawer";
import { MOCK_TOPICS, MARKETS } from "@/lib/mock-data";
import { Topic, MarketId } from "@/lib/types";
import { exportToJSON, exportToMarkdown } from "@/lib/export";
import { Download, RefreshCw, Zap } from "lucide-react";

export default function Dashboard() {
  const [selectedMarket, setSelectedMarket] = useState<MarketId>("mx");
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const market = MARKETS.find((m) => m.id === selectedMarket);
  const topicCount = MOCK_TOPICS.filter((t) => t.market_scores[selectedMarket]).length;
  const aCount = MOCK_TOPICS.filter(
    (t) => t.market_scores[selectedMarket]?.category === "A"
  ).length;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-[var(--background)] border-b border-[var(--border)]">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center">
                <Zap size={13} className="text-white" />
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">LowHangingFruits</span>
            </div>
            <span className="text-[var(--border)]">·</span>
            <span className="text-xs text-[var(--text-muted)]">Editorial Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 mr-2">
              <div className="text-right">
                <div className="text-xs font-mono text-[var(--green)] font-bold">{aCount} Cat A</div>
                <div className="text-xs text-[var(--text-muted)]">{topicCount} topics today</div>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all"
              >
                <Download size={12} />
                Export
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden z-50 w-44">
                    <button
                      onClick={() => { exportToJSON(MOCK_TOPICS, selectedMarket); setExportOpen(false); }}
                      className="w-full px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={() => { exportToMarkdown(MOCK_TOPICS, selectedMarket); setExportOpen(false); }}
                      className="w-full px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Export Markdown
                    </button>
                  </div>
                </>
              )}
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-5 space-y-5">
        {/* Market Selector */}
        <div className="space-y-2">
          <div className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Select Market</div>
          <MarketSelector selected={selectedMarket} onChange={setSelectedMarket} />
        </div>

        {/* Hero stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Cat A opportunities", value: aCount, color: "var(--green)" },
            {
              label: "Top score",
              value: Math.max(...MOCK_TOPICS.filter((t) => t.market_scores[selectedMarket]).map((t) => t.market_scores[selectedMarket].master_score)),
              color: "var(--accent)",
            },
            {
              label: "Cross-border",
              value: MOCK_TOPICS.filter((t) => t.is_cross_border && t.cross_border_to?.includes(selectedMarket) && t.cross_border_from !== selectedMarket).length,
              color: "var(--blue)",
            },
            { label: "Total topics", value: topicCount, color: "var(--text-secondary)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-2xl font-black font-mono" style={{ color }}>{value}</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
          {/* Left column */}
          <div className="space-y-5">
            <OpportunityBoard
              topics={MOCK_TOPICS}
              selectedMarket={selectedMarket}
              onSelectTopic={setSelectedTopic}
            />
            <CrossBorderPanel
              topics={MOCK_TOPICS}
              selectedMarket={selectedMarket}
              onSelectTopic={setSelectedTopic}
            />
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <Top5Today
              topics={MOCK_TOPICS}
              selectedMarket={selectedMarket}
              onSelectTopic={setSelectedTopic}
            />
            <GeoHeatmap
              topic={selectedTopic || MOCK_TOPICS[0]}
              selectedMarket={selectedMarket}
            />
          </div>
        </div>
      </main>

      {/* Topic Detail Drawer */}
      <TopicDrawer
        topic={selectedTopic}
        selectedMarket={selectedMarket}
        onClose={() => setSelectedTopic(null)}
      />
    </div>
  );
}
