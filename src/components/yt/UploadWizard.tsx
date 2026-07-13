"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Select, Badge, Checkbox } from "@/components/wemul";
import { GENERAL_FIELDS, PER_VIDEO_FIELDS, CanonicalField } from "@/lib/yt/parsing/columnMap";

type FileType = "GENERAL" | "PER_VIDEO";
type Step = "preview" | "mapping" | "validation" | "confirm" | "done";

interface QueuedFile {
  id: string;
  file: File;
  text: string;
  fileType: FileType;
  step: Step;
  preview?: {
    headers: string[];
    rows: Record<string, string>[];
    totalRows: number;
    delimiter: string;
    fileTypeGuess: string;
    suggestedMapping: Record<string, CanonicalField | null>;
  };
  mapping: Record<string, CanonicalField | null>;
  savePreset: boolean;
  report?: {
    rowCount: number;
    validRowCount: number;
    invalidRowCount: number;
    videosDetected: number;
    dateRange: { min: string | null; max: string | null };
    metricsAvailable: CanonicalField[];
    metricsMissing: CanonicalField[];
    errors: { code: string; message: string }[];
    warnings: { code: string; message: string }[];
  };
  duplicate?: { existingUploadId: string; existingUploadName: string; sameContent: boolean } | null;
  duplicateAction?: "cancel" | "replace" | "new_version";
  error?: string;
}

const FIELD_LABEL: Record<CanonicalField, string> = {
  date: "Fecha",
  views: "Visualizaciones",
  watch_time_hours: "Tiempo de reproducción (h)",
  subscribers_gained: "Suscriptores ganados",
  subscribers_lost: "Suscriptores perdidos",
  impressions: "Impresiones",
  impressions_ctr: "CTR de impresiones",
  average_view_duration: "Duración media",
  average_view_percentage: "Porcentaje medio visto",
  estimated_revenue: "Ingresos estimados",
  video_id: "ID del video",
  title: "Título",
  url: "URL",
  published_at: "Fecha de publicación",
  duration: "Duración del video",
  likes: "Me gusta",
  comments: "Comentarios",
  shares: "Compartidos",
};

let uid = 0;
function nextId() {
  uid += 1;
  return `f${uid}`;
}

export function UploadWizard({ periodId, channelId }: { periodId: string; channelId: string }) {
  const router = useRouter();
  const [files, setFiles] = React.useState<QueuedFile[]>([]);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const active = activeIndex !== null ? files[activeIndex] : null;

  function updateActive(patch: Partial<QueuedFile>) {
    setFiles((prev) => prev.map((f, i) => (i === activeIndex ? { ...f, ...patch } : f)));
  }

  async function addFiles(fileList: FileList | File[]) {
    const list = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith(".csv") || f.type.includes("csv"));
    const newItems: QueuedFile[] = [];
    for (const file of list) {
      const text = await file.text();
      newItems.push({
        id: nextId(),
        file,
        text,
        fileType: "GENERAL",
        step: "preview",
        mapping: {},
        savePreset: false,
      });
    }
    setFiles((prev) => {
      const merged = [...prev, ...newItems];
      if (activeIndex === null && merged.length > 0) setActiveIndex(prev.length);
      return merged;
    });
  }

  // Fetch preview + suggested mapping (and any saved preset) as soon as a file becomes active.
  React.useEffect(() => {
    if (!active || active.preview) return;
    (async () => {
      const res = await fetch("/api/yt/uploads/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: active.text }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateActive({ error: data.error ?? "No se pudo previsualizar el archivo." });
        return;
      }
      const guessedType: FileType = data.preview.fileTypeGuess === "PER_VIDEO" ? "PER_VIDEO" : "GENERAL";

      let mapping: Record<string, CanonicalField | null> = data.preview.suggestedMapping;
      try {
        const presetRes = await fetch(`/api/yt/channels/${channelId}/mapping-presets?fileType=${guessedType}`);
        const presetData = await presetRes.json();
        if (presetData.mapping) {
          // Preset overrides the auto-suggestion for headers it recognizes; unseen headers keep their suggestion.
          mapping = { ...mapping, ...presetData.mapping };
        }
      } catch {
        // Preset lookup is best-effort; fall back to the auto-suggested mapping.
      }

      updateActive({ preview: data.preview, fileType: guessedType, mapping });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  async function runValidate() {
    if (!active) return;
    const res = await fetch(`/api/yt/periods/${periodId}/uploads/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileType: active.fileType, text: active.text, mapping: active.mapping }),
    });
    const data = await res.json();
    if (!res.ok) {
      updateActive({ error: data.error ?? "No se pudo validar el archivo." });
      return;
    }
    updateActive({ report: data.report, duplicate: data.duplicate, step: "validation", error: undefined });
  }

  async function confirmUpload() {
    if (!active) return;
    const res = await fetch(`/api/yt/periods/${periodId}/uploads/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: active.file.name,
        fileType: active.fileType,
        text: active.text,
        mapping: active.mapping,
        duplicateAction: active.duplicateAction,
        savePreset: active.savePreset,
      }),
    });
    const data = await res.json();
    if (res.status === 409) {
      updateActive({ duplicate: data, error: undefined });
      return;
    }
    if (!res.ok) {
      updateActive({ error: data.error ?? "No se pudo confirmar la carga." });
      return;
    }
    updateActive({ step: "done", error: undefined });
  }

  function goToNextFileOrFinish() {
    const nextPending = files.findIndex((f, i) => i !== activeIndex && f.step !== "done");
    if (nextPending >= 0) {
      setActiveIndex(nextPending);
    } else {
      router.push(`/yt/periods/${periodId}/dashboard`);
    }
  }

  const fieldOptions = active?.fileType === "GENERAL" ? GENERAL_FIELDS : PER_VIDEO_FIELDS;
  const allDone = files.length > 0 && files.every((f) => f.step === "done");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {files.map((f, i) => (
            <Badge key={f.id} tone={f.step === "done" ? "success" : i === activeIndex ? "blue" : "navy"}>
              {f.file.name} · {f.step === "done" ? "confirmado" : f.step}
            </Badge>
          ))}
        </div>
      )}

      {!active && (
        <Card>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--blue-500)" : "var(--border-default)"}`,
              borderRadius: "var(--radius-md)",
              padding: "var(--space-8)",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "var(--blue-50)" : "transparent",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              hidden
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-strong)", margin: 0 }}>
              Arrastra tus archivos CSV aquí
            </p>
            <p style={{ fontFamily: "var(--font-text)", color: "var(--text-muted)", marginTop: 6 }}>
              O haz clic para seleccionarlos. Puedes cargar el reporte general y el reporte por video.
            </p>
          </div>
          {allDone && (
            <div style={{ marginTop: "var(--space-5)", display: "flex", justifyContent: "flex-end" }}>
              <Button variant="coral" onClick={() => router.push(`/yt/periods/${periodId}/dashboard`)}>
                Ir al dashboard
              </Button>
            </div>
          )}
        </Card>
      )}

      {active?.error && (
        <Card accent="coral">
          <span style={{ color: "var(--error)" }}>{active.error}</span>
        </Card>
      )}

      {active && active.preview && active.step === "preview" && (
        <Card>
          <h3 style={{ fontFamily: "var(--font-display)", margin: 0, marginBottom: "var(--space-4)" }}>Previsualización — {active.file.name}</h3>
          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
            <div style={{ flex: "1 1 220px" }}>
              <Select
                label="Tipo de archivo"
                value={active.fileType}
                onChange={(e) => updateActive({ fileType: e.target.value as FileType })}
                options={[
                  { value: "GENERAL", label: "Reporte general (por fecha)" },
                  { value: "PER_VIDEO", label: "Reporte por video" },
                ]}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, fontSize: "0.875rem", color: "var(--text-muted)" }}>
              <span>{active.preview.totalRows} filas · delimitador &quot;{active.preview.delimiter === "\t" ? "tab" : active.preview.delimiter}&quot;</span>
              <span>{active.preview.headers.length} columnas detectadas</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8125rem", fontFamily: "var(--font-text)" }}>
              <thead>
                <tr>
                  {active.preview.headers.map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid var(--border-default)", color: "var(--text-strong)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.preview.rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {active.preview!.headers.map((h) => (
                      <td key={h} style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-body)", whiteSpace: "nowrap" }}>
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "var(--space-5)", display: "flex", justifyContent: "flex-end" }}>
            <Button variant="coral" onClick={() => updateActive({ step: "mapping" })}>
              Continuar a mapeo
            </Button>
          </div>
        </Card>
      )}

      {active && active.preview && active.step === "mapping" && (
        <Card>
          <h3 style={{ fontFamily: "var(--font-display)", margin: 0, marginBottom: 4 }}>Mapeo de columnas</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 0, marginBottom: "var(--space-4)" }}>
            Corrige el campo interno sugerido para cada columna si es necesario.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {active.preview.headers.map((header) => (
              <div key={header} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ flex: "1 1 260px", fontFamily: "var(--font-text)", fontSize: "0.9375rem", color: "var(--text-strong)" }}>{header}</span>
                <div style={{ flex: "1 1 260px" }}>
                  <Select
                    value={active.mapping[header] ?? ""}
                    onChange={(e) =>
                      updateActive({
                        mapping: { ...active.mapping, [header]: (e.target.value || null) as CanonicalField | null },
                      })
                    }
                    options={[{ value: "", label: "— No mapear —" }, ...fieldOptions.map((f) => ({ value: f, label: FIELD_LABEL[f] }))]}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "var(--space-5)" }}>
            <Checkbox
              label="Guardar este mapeo para futuras cargas de este canal y tipo de reporte"
              checked={active.savePreset}
              onChange={(checked) => updateActive({ savePreset: checked })}
            />
          </div>
          <div style={{ marginTop: "var(--space-5)", display: "flex", justifyContent: "space-between" }}>
            <Button variant="outline" onClick={() => updateActive({ step: "preview" })}>
              Volver
            </Button>
            <Button variant="coral" onClick={runValidate}>
              Validar
            </Button>
          </div>
        </Card>
      )}

      {active && active.report && active.step === "validation" && (
        <ValidationStep active={active} onBack={() => updateActive({ step: "mapping" })} onContinue={() => updateActive({ step: "confirm" })} />
      )}

      {active && active.report && active.step === "confirm" && (
        <ConfirmStep
          active={active}
          onBack={() => updateActive({ step: "validation" })}
          onDuplicateAction={(action) => updateActive({ duplicateAction: action })}
          onConfirm={confirmUpload}
        />
      )}

      {active && active.step === "done" && (
        <Card accent="blue">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-text)", color: "var(--text-strong)" }}>
              &quot;{active.file.name}&quot; se guardó correctamente en el histórico de cargas.
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="outline" onClick={() => setActiveIndex(null)}>
                Cargar otro archivo
              </Button>
              <Button variant="coral" onClick={goToNextFileOrFinish}>
                Continuar
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function ValidationStep({ active, onBack, onContinue }: { active: QueuedFile; onBack: () => void; onContinue: () => void }) {
  const r = active.report!;
  const blocked = r.errors.length > 0;
  return (
    <Card>
      <h3 style={{ fontFamily: "var(--font-display)", margin: 0, marginBottom: "var(--space-4)" }}>Validación</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <Stat label="Filas válidas" value={r.validRowCount} />
        <Stat label="Filas inválidas" value={r.invalidRowCount} />
        {active.fileType === "PER_VIDEO" && <Stat label="Videos detectados" value={r.videosDetected} />}
        <Stat label="Rango de fechas" value={r.dateRange.min ? `${r.dateRange.min} → ${r.dateRange.max}` : "—"} />
      </div>

      {r.metricsMissing.length > 0 && (
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
          Métricas no disponibles en este archivo: {r.metricsMissing.join(", ")}
        </p>
      )}

      {r.errors.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <h4 style={{ color: "var(--error)", fontFamily: "var(--font-text)", fontSize: "0.9375rem" }}>Errores bloqueantes</h4>
          {r.errors.map((e, i) => (
            <div key={i} style={{ color: "var(--error)", fontSize: "0.875rem" }}>
              • {e.message}
            </div>
          ))}
        </div>
      )}

      {r.warnings.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <h4 style={{ color: "#9A6300", fontFamily: "var(--font-text)", fontSize: "0.9375rem" }}>Advertencias</h4>
          {r.warnings.map((w, i) => (
            <div key={i} style={{ color: "#9A6300", fontSize: "0.875rem" }}>
              • {w.message}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "var(--space-5)", display: "flex", justifyContent: "space-between" }}>
        <Button variant="outline" onClick={onBack}>
          Volver al mapeo
        </Button>
        <Button variant="coral" onClick={onContinue} disabled={blocked}>
          Continuar
        </Button>
      </div>
    </Card>
  );
}

function ConfirmStep({
  active,
  onBack,
  onConfirm,
  onDuplicateAction,
}: {
  active: QueuedFile;
  onBack: () => void;
  onConfirm: () => void;
  onDuplicateAction: (action: "cancel" | "replace" | "new_version") => void;
}) {
  const r = active.report!;
  const needsDuplicateChoice = !!active.duplicate && !active.duplicateAction;

  return (
    <Card>
      <h3 style={{ fontFamily: "var(--font-display)", margin: 0, marginBottom: "var(--space-4)" }}>Confirmar importación</h3>
      <ul style={{ fontFamily: "var(--font-text)", fontSize: "0.9375rem", color: "var(--text-body)", lineHeight: 1.8 }}>
        <li>Archivo: {active.file.name}</li>
        <li>Tipo: {active.fileType === "GENERAL" ? "Reporte general" : "Reporte por video"}</li>
        <li>Filas válidas: {r.validRowCount} de {r.rowCount}</li>
        <li>Advertencias: {r.warnings.length}</li>
      </ul>

      {active.duplicate && (
        <div style={{ marginTop: "var(--space-4)", padding: "var(--space-4)", background: "var(--warning-bg)", borderRadius: "var(--radius-md)" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-text)", color: "#9A6300", fontWeight: 600 }}>
            Ya existe una carga confirmada para este período y tipo de reporte ({active.duplicate.existingUploadName})
            {active.duplicate.sameContent ? " con el mismo contenido" : ""}.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: "var(--space-3)", flexWrap: "wrap" }}>
            <Button size="sm" variant={active.duplicateAction === "cancel" ? "navy" : "outline"} onClick={() => onDuplicateAction("cancel")}>
              Cancelar carga
            </Button>
            <Button size="sm" variant={active.duplicateAction === "replace" ? "navy" : "outline"} onClick={() => onDuplicateAction("replace")}>
              Reemplazar
            </Button>
            <Button size="sm" variant={active.duplicateAction === "new_version" ? "navy" : "outline"} onClick={() => onDuplicateAction("new_version")}>
              Crear nueva versión
            </Button>
          </div>
        </div>
      )}

      <div style={{ marginTop: "var(--space-5)", display: "flex", justifyContent: "space-between" }}>
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button variant="coral" onClick={onConfirm} disabled={needsDuplicateChoice || active.duplicateAction === "cancel"}>
          Confirmar carga
        </Button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", color: "var(--text-strong)" }}>{value}</div>
      <div style={{ fontFamily: "var(--font-text)", fontSize: "0.8125rem", color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}
