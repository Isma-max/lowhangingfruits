"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Input, Button } from "@/components/wemul";

export function CreateClientForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/yt/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el cliente");
        return;
      }
      setName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px" }}>
        <Input label="Nuevo cliente" placeholder="Nombre del cliente" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} required />
      </div>
      <Button type="submit" variant="coral" disabled={loading}>
        {loading ? "Creando…" : "Crear cliente"}
      </Button>
    </form>
  );
}
