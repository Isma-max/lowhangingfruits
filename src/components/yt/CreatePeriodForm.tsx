"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Button } from "@/components/wemul";

const COMPARISON_OPTIONS = [
  { value: "PREVIOUS_PERIOD", label: "Período anterior" },
  { value: "YEAR_OVER_YEAR", label: "Mismo período del año anterior" },
  { value: "CUSTOM", label: "Período personalizado" },
  { value: "NONE", label: "Sin comparación" },
];

export function CreatePeriodForm({
  channelId,
  existingPeriods,
}: {
  channelId: string;
  existingPeriods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [comparisonMode, setComparisonMode] = React.useState("PREVIOUS_PERIOD");
  const [comparePeriodId, setComparePeriodId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/yt/channels/${channelId}/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startDate,
          endDate,
          comparisonMode,
          comparePeriodId: comparisonMode === "CUSTOM" ? comparePeriodId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el período");
        return;
      }
      setName("");
      setStartDate("");
      setEndDate("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px" }}>
          <Input label="Nombre del período" placeholder="Junio 2026" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <Input label="Fecha inicial" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <Input label="Fecha final" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 260px" }}>
          <Select label="Comparación" options={COMPARISON_OPTIONS} value={comparisonMode} onChange={(e) => setComparisonMode(e.target.value)} />
        </div>
        {comparisonMode === "CUSTOM" && (
          <div style={{ flex: "1 1 260px" }}>
            <Select
              label="Período a comparar"
              value={comparePeriodId}
              onChange={(e) => setComparePeriodId(e.target.value)}
              options={[{ value: "", label: "Selecciona un período" }, ...existingPeriods.map((p) => ({ value: p.id, label: p.name }))]}
              required
            />
          </div>
        )}
        <Button type="submit" variant="coral" disabled={loading}>
          {loading ? "Creando…" : "Crear período"}
        </Button>
      </div>
      {error && <span style={{ color: "var(--error)", fontSize: "0.875rem", fontFamily: "var(--font-text)" }}>{error}</span>}
    </form>
  );
}
