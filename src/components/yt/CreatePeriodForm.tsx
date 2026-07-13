"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Button, Tabs } from "@/components/wemul";

const COMPARISON_OPTIONS = [
  { value: "PREVIOUS_PERIOD", label: "Período anterior" },
  { value: "YEAR_OVER_YEAR", label: "Mismo período del año anterior" },
  { value: "CUSTOM", label: "Período personalizado" },
  { value: "NONE", label: "Sin comparación" },
];

function suggestPeriodName(minStr: string, maxStr: string): string {
  const minParts = minStr.split("-");
  const maxParts = maxStr.split("-");
  if (minParts.length === 3 && maxParts.length === 3) {
    const minYear = minParts[0];
    const minMonth = parseInt(minParts[1], 10);
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    if (minYear === maxParts[0] && minMonth === parseInt(maxParts[1], 10)) {
      return `${monthNames[minMonth - 1]} ${minYear}`;
    }
  }
  const formatDateRange = (s: string) => {
    const parts = s.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };
  return `${formatDateRange(minStr)} – ${formatDateRange(maxStr)}`;
}

function formatDateFriendly(s: string) {
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10);
  const year = parts[0];
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return `${day} de ${monthNames[month - 1]} de ${year}`;
}

interface FileSlot {
  file: File | null;
  text: string;
  detecting: boolean;
  error: string | null;
  ready: boolean;
  minDate?: string | null;
  maxDate?: string | null;
  fileTypeGuess?: "GENERAL" | "PER_VIDEO" | "UNKNOWN";
  suggestedMapping?: Record<string, string | null>;
}

export function CreatePeriodForm({
  channelId,
  existingPeriods,
}: {
  channelId: string;
  existingPeriods: { id: string; name: string }[];
}) {
  const router = useRouter();

  // Shared form state
  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [comparisonMode, setComparisonMode] = React.useState("PREVIOUS_PERIOD");
  const [comparePeriodId, setComparePeriodId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Drag & drop state
  const [dragOver, setDragOver] = React.useState(false);

  // Multi-file slot state
  const [generalSlot, setGeneralSlot] = React.useState<FileSlot>({ file: null, text: "", detecting: false, error: null, ready: false });
  const [perVideoSlot, setPerVideoSlot] = React.useState<FileSlot>({ file: null, text: "", detecting: false, error: null, ready: false });
  const [totalsSlot, setTotalsSlot] = React.useState<FileSlot>({ file: null, text: "", detecting: false, error: null, ready: false });

  const resetState = () => {
    setName("");
    setStartDate("");
    setEndDate("");
    setComparisonMode("PREVIOUS_PERIOD");
    setComparePeriodId("");
    setError(null);
    setLoading(false);
    setDragOver(false);
    setGeneralSlot({ file: null, text: "", detecting: false, error: null, ready: false });
    setPerVideoSlot({ file: null, text: "", detecting: false, error: null, ready: false });
    setTotalsSlot({ file: null, text: "", detecting: false, error: null, ready: false });
  };

  function classifyFile(file: File): "GENERAL" | "PER_VIDEO" | "TOTALS" | "UNKNOWN" {
    const filename = file.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (filename.includes("grafico") || filename.includes("chart")) {
      return "GENERAL";
    }
    if (filename.includes("tabla") || filename.includes("table")) {
      return "PER_VIDEO";
    }
    if (filename.includes("totales") || filename.includes("totals")) {
      return "TOTALS";
    }
    return "UNKNOWN";
  }

  async function handleFilesSelected(fileList: File[] | FileList) {
    const list = Array.from(fileList);
    setError(null);

    for (const file of list) {
      const type = classifyFile(file);

      if (type === "TOTALS") {
        setTotalsSlot({
          file,
          text: "",
          detecting: false,
          error: null,
          ready: true,
        });
        continue;
      }

      if (type === "UNKNOWN") {
        setError(`El archivo "${file.name}" no fue reconocido. Asegúrate de subir "Datos del gráfico", "Datos de la tabla" o "Totales".`);
        continue;
      }

      const setSlot = type === "GENERAL" ? setGeneralSlot : setPerVideoSlot;

      setSlot({
        file,
        text: "",
        detecting: true,
        error: null,
        ready: false,
      });

      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        try {
          const res = await fetch("/api/yt/uploads/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          const data = await res.json();
          if (!res.ok) {
            setSlot({
              file,
              text,
              detecting: false,
              error: data.error ?? "Error al analizar el archivo CSV.",
              ready: false,
            });
            return;
          }

          const preview = data.preview;
          const minDate = preview.dateRange?.min ?? null;
          const maxDate = preview.dateRange?.max ?? null;
          const guessType = preview.fileTypeGuess;

          if (guessType !== type) {
            setSlot({
              file,
              text,
              detecting: false,
              error: `El contenido del archivo parece un reporte de tipo ${guessType === "GENERAL" ? "Gráfico" : "Tabla"}, pero se cargó como ${type === "GENERAL" ? "Gráfico" : "Tabla"}.`,
              ready: false,
            });
            return;
          }

          if (type === "GENERAL" && (!minDate || !maxDate)) {
            setSlot({
              file,
              text,
              detecting: false,
              error: "No se detectaron fechas en el reporte general.",
              ready: false,
            });
            return;
          }

          setSlot({
            file,
            text,
            detecting: false,
            error: null,
            ready: true,
            minDate,
            maxDate,
            fileTypeGuess: type,
            suggestedMapping: preview.suggestedMapping,
          });

          if (type === "GENERAL" && minDate && maxDate) {
            setName(suggestPeriodName(minDate, maxDate));
            setStartDate(minDate);
            setEndDate(maxDate);
          }
        } catch {
          setSlot({
            file,
            text,
            detecting: false,
            error: "Error de red al procesar el archivo.",
            ready: false,
          });
        }
      };
      reader.onerror = () => {
        setSlot({
          file,
          text: "",
          detecting: false,
          error: "Error al leer el archivo localmente.",
          ready: false,
        });
      };
      reader.readAsText(file);
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  async function handleManualSubmit(e: React.FormEvent) {
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
      resetState();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!generalSlot.ready || !perVideoSlot.ready) {
      setError("Debes cargar tanto el archivo de gráfico (General) como el de tabla (Por video) para continuar.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Create Period
      const periodRes = await fetch(`/api/yt/channels/${channelId}/periods`, {
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
      const periodData = await periodRes.json();
      if (!periodRes.ok) {
        setError(periodData.error ?? "No se pudo crear el período");
        setLoading(false);
        return;
      }

      const periodId = periodData.period.id;

      // 2. Upload General report
      const confirmGenRes = await fetch(`/api/yt/periods/${periodId}/uploads/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: generalSlot.file!.name,
          fileType: "GENERAL",
          text: generalSlot.text,
          mapping: generalSlot.suggestedMapping,
          savePreset: true,
        }),
      });
      if (!confirmGenRes.ok) {
        const confirmGenData = await confirmGenRes.json();
        setError(confirmGenData.error ?? "Período creado, pero falló la carga del reporte General.");
        setLoading(false);
        return;
      }

      // 3. Upload Per-Video report
      const confirmVidRes = await fetch(`/api/yt/periods/${periodId}/uploads/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: perVideoSlot.file!.name,
          fileType: "PER_VIDEO",
          text: perVideoSlot.text,
          mapping: perVideoSlot.suggestedMapping,
          savePreset: true,
        }),
      });
      if (!confirmVidRes.ok) {
        const confirmVidData = await confirmVidRes.json();
        setError(confirmVidData.error ?? "Período creado e importado reporte general, pero falló el reporte por Video.");
        setLoading(false);
        return;
      }

      // 4. Redirect to the period dashboard
      router.push(`/yt/periods/${periodId}/dashboard`);
      router.refresh();
    } catch {
      setError("Error al importar los archivos CSV.");
      setLoading(false);
    }
  }

  const bothFilesReady = generalSlot.ready && perVideoSlot.ready;

  const tabList = [
    {
      label: "Crear desde CSV (Recomendado)",
      content: (
        <form onSubmit={handleCsvSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("csv-file-input")?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--border-focus)" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-md)",
              padding: "var(--space-5) var(--space-4)",
              textAlign: "center",
              background: dragOver ? "var(--info-bg)" : "var(--surface-subtle)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={(e) => { if (e.target.files) handleFilesSelected(e.target.files); }}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-2)" }}>📁</div>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
              {dragOver ? "¡Suelta los archivos aquí!" : "Selecciona o arrastra los archivos exportados de YouTube"}
            </p>
            <p style={{ fontFamily: "var(--font-text)", fontSize: "0.875rem", color: "var(--text-muted)", marginTop: 4 }}>
              Puedes arrastrar los 3 archivos juntos (`Datos del gráfico`, `Datos de la tabla` y `Totales`).
            </p>
          </div>

          {/* Slots Checklist */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", margin: "8px 0" }}>
            
            {/* Slot 1: General */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-3)",
                background: generalSlot.ready ? "var(--success-bg)" : "var(--surface-subtle)",
                border: `1px solid ${generalSlot.error ? "var(--error)" : generalSlot.ready ? "var(--success)" : "var(--border-subtle)"}`,
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-strong)" }}>
                  📊 Datos del gráfico.csv (Métricas diarias)
                </span>
                <div style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {generalSlot.detecting ? (
                    "Analizando archivo..."
                  ) : generalSlot.error ? (
                    <span style={{ color: "var(--error)" }}>{generalSlot.error}</span>
                  ) : generalSlot.ready ? (
                    <>
                      ✓ Cargado: <strong>{generalSlot.file?.name}</strong> · Rango: {formatDateFriendly(generalSlot.minDate!)} a {formatDateFriendly(generalSlot.maxDate!)}
                    </>
                  ) : (
                    "Pendiente — Selecciona o arrastra el reporte del gráfico"
                  )}
                </div>
              </div>
              {generalSlot.ready && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setGeneralSlot({ file: null, text: "", detecting: false, error: null, ready: false }); }}
                >
                  Quitar
                </Button>
              )}
            </div>

            {/* Slot 2: Per Video */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-3)",
                background: perVideoSlot.ready ? "var(--success-bg)" : "var(--surface-subtle)",
                border: `1px solid ${perVideoSlot.error ? "var(--error)" : perVideoSlot.ready ? "var(--success)" : "var(--border-subtle)"}`,
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-strong)" }}>
                  🎬 Datos de la tabla.csv (Detalle de videos)
                </span>
                <div style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {perVideoSlot.detecting ? (
                    "Analizando archivo..."
                  ) : perVideoSlot.error ? (
                    <span style={{ color: "var(--error)" }}>{perVideoSlot.error}</span>
                  ) : perVideoSlot.ready ? (
                    <>
                      ✓ Cargado: <strong>{perVideoSlot.file?.name}</strong>
                    </>
                  ) : (
                    "Pendiente — Selecciona o arrastra el reporte de la tabla"
                  )}
                </div>
              </div>
              {perVideoSlot.ready && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPerVideoSlot({ file: null, text: "", detecting: false, error: null, ready: false }); }}
                >
                  Quitar
                </Button>
              )}
            </div>

            {/* Slot 3: Totales */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-3)",
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                opacity: totalsSlot.ready ? 1 : 0.6,
              }}
            >
              <div>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-muted)" }}>
                  📝 Totales.csv (Resumen global)
                </span>
                <div style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {totalsSlot.ready ? (
                    <>
                      ✓ Detectado y omitido automáticamente: <strong>{totalsSlot.file?.name}</strong>
                    </>
                  ) : (
                    "Opcional — Se omitirá automáticamente de forma segura al cargarse"
                  )}
                </div>
              </div>
              {totalsSlot.ready && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setTotalsSlot({ file: null, text: "", detecting: false, error: null, ready: false }); }}
                >
                  Quitar
                </Button>
              )}
            </div>
          </div>

          {/* Period creation details (shown only when required files are loaded) */}
          {bothFilesReady ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px" }}>
                  <Input
                    label="Nombre del período"
                    placeholder="Junio 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <Select
                    label="Comparación"
                    options={COMPARISON_OPTIONS}
                    value={comparisonMode}
                    onChange={(e) => setComparisonMode(e.target.value)}
                  />
                </div>
              </div>

              {comparisonMode === "CUSTOM" && (
                <div style={{ width: "100%" }}>
                  <Select
                    label="Período a comparar"
                    value={comparePeriodId}
                    onChange={(e) => setComparePeriodId(e.target.value)}
                    options={[{ value: "", label: "Selecciona un período" }, ...existingPeriods.map((p) => ({ value: p.id, label: p.name }))]}
                    required
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button type="submit" variant="coral" disabled={loading}>
                  {loading ? "Creando e importando todo..." : "Crear período e importar todo"}
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "var(--space-2)", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              💡 Por favor carga los archivos requeridos de gráfico y tabla para definir el período.
            </div>
          )}

          {error && <span style={{ color: "var(--error)", fontSize: "0.875rem", fontFamily: "var(--font-text)" }}>{error}</span>}
        </form>
      ),
    },
    {
      label: "Crear manualmente",
      content: (
        <form onSubmit={handleManualSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
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
            <div style={{ flex: "1 0 auto", display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" variant="coral" disabled={loading}>
                {loading ? "Creando…" : "Crear período"}
              </Button>
            </div>
          </div>
          {error && <span style={{ color: "var(--error)", fontSize: "0.875rem", fontFamily: "var(--font-text)" }}>{error}</span>}
        </form>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-strong)", margin: 0 }}>
        Crear nuevo período
      </h3>
      <Tabs tabs={tabList} onChange={resetState} />
    </div>
  );
}
