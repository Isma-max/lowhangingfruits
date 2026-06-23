import { Topic, MarketId } from "./types";
import { MARKETS } from "./mock-data";

export function exportToJSON(topics: Topic[], marketId: MarketId): void {
  const market = MARKETS.find((m) => m.id === marketId);
  const sorted = [...topics]
    .filter((t) => t.market_scores[marketId])
    .sort((a, b) => b.market_scores[marketId].master_score - a.market_scores[marketId].master_score);

  const report = {
    generated_at: new Date().toISOString(),
    market: market?.name,
    market_id: marketId,
    total_opportunities: sorted.length,
    topics: sorted.map((t) => ({
      title: t.title,
      origin: MARKETS.find((m) => m.id === t.origin_region_id)?.name,
      category: t.category_tag,
      market_score: t.market_scores[marketId].master_score,
      category_grade: t.market_scores[marketId].category,
      action: t.market_scores[marketId].master_score >= 90 ? "Produce Now" : t.market_scores[marketId].master_score >= 75 ? "Watch" : "Skip",
      angle: t.angles[marketId] || t.angles["latam"] || null,
      hook: t.hooks[marketId] || null,
      format: t.suggested_format,
      duration: t.suggested_duration,
      platform: t.platform,
      monetization_risk: t.monetization_risk,
      sources: t.sources.map((s) => s.name),
      is_cross_border: t.is_cross_border,
    })),
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `editorial-report-${marketId}-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToMarkdown(topics: Topic[], marketId: MarketId): void {
  const market = MARKETS.find((m) => m.id === marketId);
  const sorted = [...topics]
    .filter((t) => t.market_scores[marketId])
    .sort((a, b) => b.market_scores[marketId].master_score - a.market_scores[marketId].master_score);

  const date = new Date().toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });

  const lines = [
    `# Reporte Editorial — ${market?.flag} ${market?.name}`,
    `**Fecha:** ${date}  `,
    `**Oportunidades detectadas:** ${sorted.length}`,
    "",
    "---",
    "",
  ];

  sorted.forEach((t, i) => {
    const ms = t.market_scores[marketId];
    lines.push(`## ${i + 1}. ${t.title}`);
    lines.push(`**Score:** ${ms.master_score} (${ms.category}) · **Acción:** ${ms.master_score >= 90 ? "🟢 Produce Now" : ms.master_score >= 75 ? "🟡 Watch" : "⚪ Skip"}`);
    if (t.angles[marketId]) lines.push(`**Ángulo:** ${t.angles[marketId]}`);
    if (t.hooks[marketId]) lines.push(`**Hook:** "${t.hooks[marketId]}"`);
    lines.push(`**Formato:** ${t.suggested_format} · ${t.suggested_duration} · ${t.platform}`);
    lines.push(`**Riesgo monetización:** ${t.monetization_risk}`);
    lines.push(`**Fuentes:** ${t.sources.map((s) => s.name).join(", ")}`);
    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `editorial-report-${marketId}-${new Date().toISOString().split("T")[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
