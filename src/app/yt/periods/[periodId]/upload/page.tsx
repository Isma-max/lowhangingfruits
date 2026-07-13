import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/yt/auth/getSession";
import { db } from "@/lib/yt/db";
import { YtHeader } from "@/components/yt/YtHeader";
import { UploadWizard } from "@/components/yt/UploadWizard";

export default async function UploadPage({ params }: { params: Promise<{ periodId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/yt/login");

  const { periodId } = await params;
  const period = await db.period.findUnique({
    where: { id: periodId },
    include: { channel: { include: { client: true } } },
  });
  if (!period) notFound();

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
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.875rem", color: "var(--text-strong)", margin: 0 }}>
            Cargar CSV — {period.name}
          </h1>
          <p style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", marginTop: 4 }}>
            {period.channel.name} · {period.channel.client.name}
          </p>
        </div>
        <UploadWizard periodId={period.id} channelId={period.channelId} />
      </div>
    </div>
  );
}
