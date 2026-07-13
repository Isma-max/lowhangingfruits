import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/yt/db";
import { Card, Badge } from "@/components/wemul";
import { buildPeriodInsights } from "@/lib/yt/insights/buildPeriodInsights";
import { fmtByUnit, fmtTrend } from "@/lib/yt/format";

export const revalidate = 0; // Don't cache this public share page, always serve fresh data

interface ConclusionBlock {
  id: string;
  text: string;
  source: "auto" | "manual";
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export async function generateMetadata({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const report = await db.report.findUnique({
    where: { id: reportId },
    include: { period: { include: { channel: true } } },
  });
  if (!report) {
    return { title: "Reporte no encontrado — Wemul" };
  }
  return {
    title: `${report.name} — Reporte de YouTube`,
    description: `Reporte de rendimiento público para el canal ${report.period.channel.name} durante el período ${report.period.name}.`,
  };
}

export default async function PublicReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;

  const report = await db.report.findUnique({
    where: { id: reportId },
    include: {
      period: {
        include: {
          channel: {
            include: {
              client: true,
            },
          },
        },
      },
    },
  });

  if (!report) {
    notFound();
  }

  const period = report.period;
  const insights = await buildPeriodInsights(period);
  const conclusions: ConclusionBlock[] = JSON.parse(report.conclusions);

  return (
    <div>
      {/* Public Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          padding: "var(--space-4) var(--space-6)",
          background: "#fff",
          borderBottom: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Image src="/yt/wemul-logo-lockup.png" alt="Wemul Logo" width={40} height={33} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "var(--font-display)",
              fontSize: "0.8125rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ color: "var(--text-strong)", fontWeight: 800 }}>Wemul Intelligence</span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", fontWeight: 600 }}>Reporte de Rendimiento</span>
          </div>
        </div>
        <div>
          <Badge tone="success" seal>Reporte Compartido</Badge>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Title and details */}
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.875rem", color: "var(--text-strong)", margin: 0 }}>
            {report.name}
          </h1>
          <p style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", marginTop: 8, fontSize: "0.9375rem" }}>
            Canal: <strong>{period.channel.name}</strong> ({period.channel.handle}) · Cliente: <strong>{period.channel.client.name}</strong>
          </p>
          <p style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 4 }}>
            Período: {formatDate(period.startDate)} al {formatDate(period.endDate)} · {insights.comparePeriod ? `Comparado contra ${insights.comparePeriod.name}` : "Sin período de comparación disponible"}
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

        {/* Conclusions */}
        <Card>
          <h3 style={{ fontFamily: "var(--font-display)", margin: 0, marginBottom: "var(--space-4)" }}>Conclusiones</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {conclusions.length === 0 ? (
              <span style={{ color: "var(--text-muted)", fontSize: "0.9375rem" }}>
                No se registraron conclusiones en este reporte.
              </span>
            ) : (
              conclusions.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                    padding: "var(--space-3) var(--space-4)",
                    background: "var(--surface-subtle)",
                    borderRadius: "var(--radius-md)",
                    borderLeft: `4px solid ${c.source === "auto" ? "var(--blue-500)" : "var(--navy-500)"}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <Badge tone={c.source === "auto" ? "blue" : "navy"}>
                      {c.source === "auto" ? "Conclusión de Rendimiento" : "Observación Manual"}
                    </Badge>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-text)",
                      fontSize: "0.9375rem",
                      color: "var(--text-body)",
                      margin: 0,
                      lineHeight: "var(--lh-body)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {c.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--text-faint)", fontSize: "0.8125rem", fontFamily: "var(--font-text)" }}>
        Generado automáticamente por Wemul Intelligence en base a datos de YouTube Studio.
      </div>
    </div>
  );
}
