import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/yt/auth/getSession";
import { db } from "@/lib/yt/db";
import { YtHeader } from "@/components/yt/YtHeader";
import { Card, Badge, Button } from "@/components/wemul";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export default async function PeriodDetailPage({ params }: { params: Promise<{ periodId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/yt/login");

  const { periodId } = await params;
  const period = await db.period.findUnique({
    where: { id: periodId },
    include: {
      channel: { include: { client: true } },
      uploads: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!period) notFound();

  const hasConfirmedUpload = period.uploads.some((u) => u.status === "CONFIRMED");

  return (
    <div>
      <YtHeader
        userName={session.name}
        breadcrumb={[
          { label: period.channel.client.name, href: `/yt/clients/${period.channel.client.id}` },
          { label: period.channel.name, href: `/yt/channels/${period.channel.id}` },
          { label: period.name },
        ]}
      />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.875rem", color: "var(--text-strong)", margin: 0 }}>
              {period.name}
            </h1>
            <p style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", marginTop: 4 }}>
              {formatDate(period.startDate)} – {formatDate(period.endDate)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/yt/periods/${period.id}/upload`}>
              <Button variant="outline">Cargar CSV</Button>
            </Link>
            {hasConfirmedUpload && (
              <Link href={`/yt/periods/${period.id}/dashboard`}>
                <Button variant="coral">Ver dashboard</Button>
              </Link>
            )}
          </div>
        </div>

        <Card>
          <h3 style={{ fontFamily: "var(--font-display)", margin: 0, marginBottom: "var(--space-4)" }}>Historial de cargas</h3>
          {period.uploads.length === 0 && <span style={{ color: "var(--text-muted)" }}>Todavía no se ha cargado ningún archivo para este período.</span>}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {period.uploads.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-3) 0",
                  borderBottom: "1px solid var(--border-subtle)",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <span style={{ fontFamily: "var(--font-text)", fontWeight: 600, color: "var(--text-strong)" }}>{u.originalName}</span>
                  <span style={{ marginLeft: 10, fontSize: "0.8125rem", color: "var(--text-faint)" }}>
                    {u.fileType === "GENERAL" ? "Reporte general" : "Reporte por video"} · {u.validRowCount}/{u.rowCount} filas válidas ·{" "}
                    {formatDate(u.createdAt)}
                  </span>
                </div>
                <Badge tone={u.status === "CONFIRMED" ? "success" : u.status === "SUPERSEDED" ? "navy" : "warning"}>{u.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
