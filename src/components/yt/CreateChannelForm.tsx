"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Input, Button } from "@/components/wemul";

export function CreateChannelForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [handle, setHandle] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/yt/clients/${clientId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, handle: handle || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el canal");
        return;
      }
      setName("");
      setHandle("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px" }}>
        <Input label="Nuevo canal" placeholder="Nombre del canal" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} required />
      </div>
      <div style={{ flex: "1 1 160px" }}>
        <Input label="Handle (opcional)" placeholder="@canal" value={handle} onChange={(e) => setHandle(e.target.value)} />
      </div>
      <Button type="submit" variant="coral" disabled={loading}>
        {loading ? "Creando…" : "Crear canal"}
      </Button>
    </form>
  );
}
