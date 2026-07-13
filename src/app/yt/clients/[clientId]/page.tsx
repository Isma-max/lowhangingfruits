import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/yt/auth/getSession";
import { db } from "@/lib/yt/db";
import { YtHeader } from "@/components/yt/YtHeader";
import { CreateChannelForm } from "@/components/yt/CreateChannelForm";
import { Card, Badge } from "@/components/wemul";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/yt/login");

  const { clientId } = await params;
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: { channels: { orderBy: { name: "asc" }, include: { _count: { select: { periods: true } } } } },
  });
  if (!client) notFound();

  return (
    <div>
      <YtHeader userName={session.name} breadcrumb={[{ label: client.name }]} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.875rem", color: "var(--text-strong)", margin: 0 }}>
            {client.name}
          </h1>
          <p style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", marginTop: 4 }}>Canales de YouTube gestionados para este cliente.</p>
        </div>

        <Card>
          <CreateChannelForm clientId={client.id} />
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {client.channels.length === 0 && (
            <Card>
              <span style={{ color: "var(--text-muted)" }}>Este cliente todavía no tiene canales.</span>
            </Card>
          )}
          {client.channels.map((channel) => (
            <Link key={channel.id} href={`/yt/channels/${channel.id}`} style={{ textDecoration: "none" }}>
              <Card interactive>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-strong)" }}>
                      {channel.name}
                    </span>
                    {channel.handle && (
                      <span style={{ marginLeft: 10, fontFamily: "var(--font-text)", color: "var(--text-faint)", fontSize: "0.875rem" }}>
                        {channel.handle}
                      </span>
                    )}
                  </div>
                  <Badge tone="blue">{channel._count.periods} período{channel._count.periods === 1 ? "" : "s"}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
