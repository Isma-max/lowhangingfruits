import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/yt/auth/getSession";
import { db } from "@/lib/yt/db";
import { YtHeader } from "@/components/yt/YtHeader";
import { CreateClientForm } from "@/components/yt/CreateClientForm";
import { Card, Badge } from "@/components/wemul";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/yt/login");

  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { channels: true } } },
  });

  return (
    <div>
      <YtHeader userName={session.name} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.875rem", color: "var(--text-strong)", margin: 0 }}>
            Clientes
          </h1>
          <p style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", marginTop: 4 }}>
            Selecciona un cliente para gestionar sus canales de YouTube.
          </p>
        </div>

        <Card>
          <CreateClientForm />
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {clients.length === 0 && (
            <Card>
              <span style={{ color: "var(--text-muted)" }}>Todavía no hay clientes. Crea el primero arriba.</span>
            </Card>
          )}
          {clients.map((client) => (
            <Link key={client.id} href={`/yt/clients/${client.id}`} style={{ textDecoration: "none" }}>
              <Card interactive>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-strong)" }}>
                    {client.name}
                  </span>
                  <Badge tone="navy">{client._count.channels} canal{client._count.channels === 1 ? "" : "es"}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
