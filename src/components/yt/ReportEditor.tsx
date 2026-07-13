"use client";

import React from "react";
import { Card, Button, Input, Textarea, Badge } from "@/components/wemul";

interface ConclusionBlock {
  id: string;
  text: string;
  source: "auto" | "manual";
}

let manualIdSeq = 0;
function nextManualId() {
  manualIdSeq += 1;
  return `manual:${Date.now()}:${manualIdSeq}`;
}

export function ReportEditor({
  periodId,
  defaultName,
  initialConclusions,
}: {
  periodId: string;
  defaultName: string;
  initialConclusions: ConclusionBlock[];
}) {
  const [name, setName] = React.useState(defaultName);
  const [conclusions, setConclusions] = React.useState<ConclusionBlock[]>(initialConclusions);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function updateText(id: string, text: string) {
    setConclusions((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
  }

  function remove(id: string) {
    setConclusions((prev) => prev.filter((c) => c.id !== id));
  }

  function move(id: string, direction: -1 | 1) {
    setConclusions((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const swapWith = idx + direction;
      if (idx < 0 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  function addManual() {
    setConclusions((prev) => [...prev, { id: nextManualId(), text: "", source: "manual" }]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/yt/periods/${periodId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, conclusions: conclusions.filter((c) => c.text.trim() !== "") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el reporte.");
        return;
      }
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px" }}>
            <Input label="Nombre del reporte" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {savedAt && (
              <span style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-faint)" }}>
                Guardado {savedAt.toLocaleTimeString("es-CL")}
              </span>
            )}
            <Button variant="coral" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>

        {error && <span style={{ color: "var(--error)", fontSize: "0.875rem" }}>{error}</span>}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {conclusions.length === 0 && (
            <span style={{ color: "var(--text-muted)", fontSize: "0.9375rem" }}>
              No hay suficientes datos todavía para generar conclusiones automáticas. Agrega una observación manual.
            </span>
          )}
          {conclusions.map((c, i) => (
            <div key={c.id} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 8 }}>
                <button
                  onClick={() => move(c.id, -1)}
                  disabled={i === 0}
                  aria-label="Subir"
                  style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", color: "var(--text-faint)", opacity: i === 0 ? 0.3 : 1 }}
                >
                  ▲
                </button>
                <button
                  onClick={() => move(c.id, 1)}
                  disabled={i === conclusions.length - 1}
                  aria-label="Bajar"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: i === conclusions.length - 1 ? "default" : "pointer",
                    color: "var(--text-faint)",
                    opacity: i === conclusions.length - 1 ? 0.3 : 1,
                  }}
                >
                  ▼
                </button>
              </div>
              <div style={{ flex: 1 }}>
                <Textarea value={c.text} onChange={(e) => updateText(c.id, e.target.value)} rows={2} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", paddingTop: 6 }}>
                <Badge tone={c.source === "auto" ? "blue" : "navy"}>{c.source === "auto" ? "Automática" : "Manual"}</Badge>
                <button onClick={() => remove(c.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--error)", fontSize: "0.8125rem" }}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <Button variant="outline" size="sm" onClick={addManual}>
            + Agregar observación manual
          </Button>
        </div>
      </div>
    </Card>
  );
}
