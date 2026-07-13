import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/yt/auth/getSession";
import { db } from "@/lib/yt/db";
import { YtHeader } from "@/components/yt/YtHeader";
import { CreatePeriodForm } from "@/components/yt/CreatePeriodForm";
import { Card, Badge } from "@/components/wemul";

const COMPARISON_LABEL: Record<string, string> = {
  PREVIOUS_PERIOD: "vs. período anterior",
  YEAR_OVER_YEAR: "vs. mismo período año anterior",
  CUSTOM: "vs. período personalizado",
  NONE: "sin comparación",
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ channelId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/yt/login");

  const { channelId } = await params;
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    include: {
      client: true,
      periods: { orderBy: { startDate: "desc" }, include: { _count: { select: { uploads: true } } } },
    },
  });
  if (!channel) notFound();

  return (
    <div>
      <YtHeader
        userName={session.name}
        breadcrumb={[{ label: channel.client.name, href: `/yt/clients/${channel.client.id}` }, { label: channel.name }]}
      />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.875rem", color: "var(--text-strong)", margin: 0 }}>
            {channel.name}
          </h1>
          <p style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", marginTop: 4 }}>Períodos de análisis para este canal.</p>
        </div>

        <Card>
          <CreatePeriodForm channelId={channel.id} existingPeriods={channel.periods.map((p) => ({ id: p.id, name: p.name }))} />
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {channel.periods.length === 0 && (
            <Card>
              <span style={{ color: "var(--text-muted)" }}>Este canal todavía no tiene períodos. Crea uno arriba para empezar a cargar CSVs.</span>
            </Card>
          )}
          {channel.periods.map((period) => (
            <Link key={period.id} href={`/yt/periods/${period.id}`} style={{ textDecoration: "none" }}>
              <Card interactive>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-strong)" }}>
                      {period.name}
                    </span>
                    <div style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 2 }}>
                      {formatDate(period.startDate)} – {formatDate(period.endDate)} · {COMPARISON_LABEL[period.comparisonMode]}
                    </div>
                  </div>
                  <Badge tone={period._count.uploads > 0 ? "success" : "warning"}>
                    {period._count.uploads > 0 ? `${period._count.uploads} carga(s)` : "Sin cargas"}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
