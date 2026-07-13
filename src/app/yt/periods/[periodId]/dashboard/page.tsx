import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/yt/auth/getSession";
import { db } from "@/lib/yt/db";
import { YtHeader } from "@/components/yt/YtHeader";
import { TimeSeriesChart } from "@/components/yt/TimeSeriesChart";
import { Card, Badge, Button } from "@/components/wemul";
import { aggregateGeneral, getDailyMetrics, getVideoMetrics, engagementRate, getActiveUpload } from "@/lib/yt/metrics/aggregate";
import { resolveComparisonPeriod } from "@/lib/yt/metrics/comparisonPeriod";
import { compareMetric } from "@/lib/yt/metrics/stats";
import { fmtCompact, fmtInt, fmtPercent, fmtTrend, fmtCurrencyUSD } from "@/lib/yt/format";
import { formatSecondsAsDuration } from "@/lib/yt/parsing/duration";
import { format } from "date-fns";

const AVATAR_COLORS = ["var(--coral-500)", "var(--blue-500)", "var(--navy-500)", "var(--coral-400)", "var(--blue-400)"];

function initials(title: string): string {
  return title.trim().charAt(0).toUpperCase() || "?";
}

export default async function DashboardPage({ params }: { params: Promise<{ periodId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/yt/login");

  const { periodId } = await params;
  const period = await db.period.findUnique({
    where: { id: periodId },
    include: { channel: { include: { client: true } } },
  });
  if (!period) notFound();

  const [dailyRows, videoRows, generalUpload, videoUpload, comparePeriod] = await Promise.all([
    getDailyMetrics(period.id),
    getVideoMetrics(period.id),
    getActiveUpload(period.id, "GENERAL"),
    getActiveUpload(period.id, "PER_VIDEO"),
    resolveComparisonPeriod(period),
  ]);

  const current = aggregateGeneral(dailyRows);
  const compareDailyRows = comparePeriod ? await getDailyMetrics(comparePeriod.id) : [];
  const previous = comparePeriod ? aggregateGeneral(compareDailyRows) : null;

  const kpi = {
    subs: compareMetric(current.subscribersNet, previous?.subscribersNet ?? null),
    views: compareMetric(current.views, previous?.views ?? null),
    watch: compareMetric(current.watchTimeHours, previous?.watchTimeHours ?? null),
    revenue: compareMetric(current.estimatedRevenue, previous?.estimatedRevenue ?? null),
  };

  const chartValues = dailyRows.map((r) => r.views ?? 0);
  const chartLabels = dailyRows.map((r) => format(r.date, "d MMM"));

  const topVideos = videoRows.slice(0, 5);

  const missingGeneralData = !generalUpload;
  const missingVideoData = !videoUpload;

  return (
    <div>
      <YtHeader
        userName={session.name}
        breadcrumb={[
          { label: period.channel.client.name, href: `/yt/clients/${period.channel.client.id}` },
          { label: period.channel.name, href: `/yt/channels/${period.channel.id}` },
          { label: period.name, href: `/yt/periods/${period.id}` },
          { label: "Dashboard" },
        ]}
      />

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "var(--coral-500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
                boxShadow: "var(--shadow-coral)",
              }}
            >
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, color: "#fff", letterSpacing: "-0.02em" }}>
                {initials(period.channel.name)}
              </span>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.875rem", color: "var(--text-strong)", letterSpacing: "-0.015em" }}>
                  {period.channel.name}
                </span>
                <Badge tone="navy">YouTube</Badge>
              </div>
              <span style={{ fontFamily: "var(--font-text)", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                {period.channel.client.name} · {period.name} · {format(period.startDate, "d MMM yyyy")} – {format(period.endDate, "d MMM yyyy")}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {previous && (
              <span style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>
                vs. {previous.daysWithData > 0 ? comparePeriod!.name : "—"}
              </span>
            )}
            <Link href={`/yt/periods/${period.id}/upload`}>
              <Button variant="outline" size="md">
                Cargar más datos
              </Button>
            </Link>
            <Button variant="coral" size="md" disabled title="La exportación a PDF llega en una fase siguiente">
              Exportar reporte
            </Button>
          </div>
        </div>

        {missingGeneralData && missingVideoData && (
          <Card accent="coral">
            <span style={{ color: "var(--text-strong)" }}>
              Todavía no hay datos confirmados para este período.{" "}
              <Link href={`/yt/periods/${period.id}/upload`} style={{ color: "var(--text-link)" }}>
                Carga un CSV
              </Link>{" "}
              para ver el dashboard.
            </span>
          </Card>
        )}

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "var(--space-5)" }}>
          <KpiCard label="Suscriptores netos" value={fmtCompact(current.subscribersNet)} trend={fmtTrend(kpi.subs.percentDiff, kpi.subs.noBase)} sub={current.subscribersGained !== null ? `+${fmtInt(current.subscribersGained)} ganados / -${fmtInt(current.subscribersLost ?? 0)} perdidos` : "Sin datos"} valueColor="var(--coral-500)" />
          <KpiCard label="Vistas" value={fmtCompact(current.views)} trend={fmtTrend(kpi.views.percentDiff, kpi.views.noBase)} sub="vs. período comparado" />
          <KpiCard label="Horas vistas" value={fmtCompact(current.watchTimeHours)} trend={fmtTrend(kpi.watch.percentDiff, kpi.watch.noBase)} sub="horas de reproducción" />
          <KpiCard label="Ingresos est." value={fmtCurrencyUSD(current.estimatedRevenue)} trend={fmtTrend(kpi.revenue.percentDiff, kpi.revenue.noBase)} sub="estimado, USD" valueColor="var(--blue-500)" />
        </div>

        {/* Chart + engagement */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: "var(--space-5)", alignItems: "stretch" }}>
          <Card style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.375rem", color: "var(--text-strong)" }}>
                  Vistas en el tiempo
                </span>
                <div style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {period.name}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--blue-500)", display: "inline-block" }} />
                <span style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-muted)" }}>Vistas diarias</span>
              </div>
            </div>
            <TimeSeriesChart values={chartValues} labels={chartLabels} />
          </Card>

          <Card style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.375rem", color: "var(--text-strong)" }}>
              Retención y engagement
            </span>
            <div style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-muted)", margin: "2px 0 16px" }}>
              Duración media: {formatSecondsAsDuration(current.averageViewDuration)}
              {current.averageViewPercentage !== null ? ` (${fmtPercent(current.averageViewPercentage)})` : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
              <StatRow label="CTR de miniatura" value={fmtPercent(current.impressionsCtr)} />
              <StatRow label="Impresiones" value={fmtCompact(current.impressions)} />
              <StatRow label="% medio visto" value={fmtPercent(current.averageViewPercentage)} />
            </div>
            <p style={{ fontFamily: "var(--font-text)", fontSize: "0.75rem", color: "var(--text-faint)", marginTop: 12 }}>
              La curva de retención por segundo de video no está disponible en los reportes CSV soportados (general / por video).
            </p>
          </Card>
        </div>

        {/* Top videos */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.375rem", color: "var(--text-strong)" }}>
              Videos con mejor rendimiento
            </span>
            <Link href={`/yt/periods/${period.id}`} style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-link)" }}>
              Ver todos ({videoRows.length})
            </Link>
          </div>
          {missingVideoData ? (
            <span style={{ color: "var(--text-muted)" }}>No se ha cargado un reporte por video para este período.</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {topVideos.map((v, i) => {
                const eng = engagementRate(v);
                return (
                  <div
                    key={v.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px 56px minmax(0,1fr) 130px 120px",
                      alignItems: "center",
                      gap: 16,
                      padding: "14px 8px",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.125rem", color: "var(--text-faint)" }}>{i + 1}</span>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "none",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.125rem", color: "#fff" }}>{initials(v.title)}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-text)",
                          fontWeight: 600,
                          fontSize: "0.9375rem",
                          color: "var(--text-strong)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {v.title}
                      </span>
                      <span style={{ fontFamily: "var(--font-text)", fontSize: "0.75rem", color: "var(--text-faint)" }}>
                        {v.publishedAt ? format(v.publishedAt, "d MMM yyyy") : "Fecha desconocida"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.0625rem", color: "var(--text-strong)" }}>
                        {fmtCompact(v.views)}
                      </span>
                      <span style={{ fontFamily: "var(--font-text)", fontSize: "0.75rem", color: "var(--text-faint)" }}>vistas</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.0625rem", color: "var(--blue-500)" }}>
                        {eng !== null ? fmtPercent(eng) : "—"}
                      </span>
                      <span style={{ fontFamily: "var(--font-text)", fontSize: "0.75rem", color: "var(--text-faint)" }}>interacción</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Demographics — honestly unavailable with the supported CSV types */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: "var(--space-5)" }}>
          <UnavailableCard title="Audiencia por edad" />
          <UnavailableCard title="Top geografía" />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, trend, sub, valueColor = "var(--text-strong)" }: { label: string; value: string; trend: string; sub: string; valueColor?: string }) {
  const isPositiveTrend = trend.startsWith("↑");
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={{ fontFamily: "var(--font-text)", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-faint)" }}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "2.75rem", letterSpacing: "-0.02em", color: valueColor, lineHeight: 1 }}>
            {value}
          </span>
          <span style={{ fontFamily: "var(--font-text)", fontWeight: 700, fontSize: "0.875rem", color: isPositiveTrend ? "var(--success)" : trend.startsWith("↓") ? "var(--error)" : "var(--text-faint)" }}>
            {trend}
          </span>
        </div>
        <span style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-muted)" }}>{sub}</span>
      </div>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontFamily: "var(--font-text)", fontSize: "0.875rem", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-text)", fontWeight: 700, fontSize: "0.875rem", color: "var(--text-strong)" }}>{value}</span>
    </div>
  );
}

function UnavailableCard({ title }: { title: string }) {
  return (
    <Card>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.375rem", color: "var(--text-strong)" }}>{title}</span>
      <div style={{ marginTop: 18, padding: "var(--space-5)", background: "var(--surface-subtle)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-text)", fontSize: "0.875rem", color: "var(--text-muted)" }}>
          No disponible: este dato no viene en los reportes CSV soportados (general / por video).
        </span>
      </div>
    </Card>
  );
}
