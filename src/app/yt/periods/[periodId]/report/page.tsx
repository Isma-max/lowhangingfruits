import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/yt/auth/getSession";
import { db } from "@/lib/yt/db";
import { YtHeader } from "@/components/yt/YtHeader";
import { ReportEditor } from "@/components/yt/ReportEditor";
import { Card, Badge } from "@/components/wemul";
import { buildPeriodInsights } from "@/lib/yt/insights/buildPeriodInsights";
import { fmtByUnit, fmtTrend } from "@/lib/yt/format";

export default async function ReportPage({ params }: { params: Promise<{ periodId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/yt/login");

  const { periodId } = await params;
  const period = await db.period.findUnique({
    where: { id: periodId },
    include: { channel: { include: { client: true } } },
  });
  if (!period) notFound();

  const [insights, draft] = await Promise.all([
    buildPeriodInsights(period),
    db.report.findFirst({ where: { periodId, pdfPath: null }, orderBy: { createdAt: "desc" } }),
  ]);

  const initialConclusions = draft ? JSON.parse(draft.conclusions) : insights.autoConclusions;
  const defaultName = draft?.name ?? `${period.channel.name} — ${period.name}`;

  return (
    <div>
      <YtHeader
        userName={session.name}
        breadcrumb={[
          { label: period.channel.client.name, href: `/yt/clients/${period.channel.client.id}` },
          { label: period.channel.name, href: `/yt/channels/${period.channel.id}` },
          { label: period.name, href: `/yt/periods/${period.id}` },
          { label: "Reporte" },
        ]}
      />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.875rem", color: "var(--text-strong)", margin: 0 }}>
            Reporte — {period.name}
          </h1>
          <p style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", marginTop: 4 }}>
            {insights.comparePeriod ? `Comparado contra ${insights.comparePeriod.name}` : "Sin período de comparación disponible"}
          </p>
        </div>

        {insights.comparison.dayCountMismatch && (
          <Card accent="coral">
            <span style={{ color: "var(--text-strong)" }}>
              Los períodos comparados tienen distinta cantidad de días ({insights.comparison.currentDays} vs. {insights.comparison.previousDays}). Los
              valores &quot;por día&quot; y &quot;por video&quot; son más representativos que los totales al comparar.
            </span>
          </Card>
        )}

        {/* Comparison table */}
        <Card>
          <h3 style={{ fontFamily: "var(--font-display)", margin: 0, marginBottom: "var(--space-4)" }}>Comparación de períodos</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.875rem", fontFamily: "var(--font-text)" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", color: "var(--text-strong)" }}>Métrica</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", color: "var(--text-strong)" }}>Actual</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", color: "var(--text-strong)" }}>Comparado</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", color: "var(--text-strong)" }}>Diferencia</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "2px solid var(--border-default)", color: "var(--text-strong)" }}>Variación</th>
                </tr>
              </thead>
              <tbody>
                {insights.comparison.rows.map((row) => (
                  <tr key={row.key}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-body)" }}>{row.label}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right", fontWeight: 600, color: "var(--text-strong)" }}>
                      {fmtByUnit(row.comparison.current, row.unit)}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right", color: "var(--text-muted)" }}>
                      {fmtByUnit(row.comparison.previous, row.unit)}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", textAlign: "right", color: "var(--text-muted)" }}>
                      {row.comparison.absoluteDiff === null
                        ? "—"
                        : row.isPercentagePoints
                          ? `${row.comparison.absoluteDiff >= 0 ? "+" : ""}${row.comparison.absoluteDiff.toFixed(1)} pp`
                          : fmtByUnit(row.comparison.absoluteDiff, row.unit)}
                    </td>
                    <td
                      style={{
                        padding: "8px 10px",
                        borderBottom: "1px solid var(--border-subtle)",
                        textAlign: "right",
                        fontWeight: 700,
                        color: row.comparison.noBase ? "var(--text-faint)" : row.comparison.percentDiff! >= 0 ? "var(--success)" : "var(--error)",
                      }}
                    >
                      {fmtTrend(row.comparison.percentDiff, row.comparison.noBase)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Milestones */}
        <Card>
          <h3 style={{ fontFamily: "var(--font-display)", margin: 0, marginBottom: "var(--space-4)" }}>Hitos detectados</h3>
          {insights.milestones.length === 0 ? (
            <span style={{ color: "var(--text-muted)" }}>No se detectaron hitos con los datos disponibles para este período.</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {insights.milestones.map((m) => (
                <div key={m.type} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Badge tone="coral">{m.label}</Badge>
                  <span style={{ fontFamily: "var(--font-text)", fontSize: "0.9375rem", color: "var(--text-body)" }}>{m.detail}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Editable conclusions */}
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", margin: "0 0 var(--space-3)" }}>Conclusiones</h3>
          <ReportEditor periodId={period.id} defaultName={defaultName} initialConclusions={initialConclusions} initialReportId={draft?.id ?? null} />
        </div>
      </div>
    </div>
  );
}
