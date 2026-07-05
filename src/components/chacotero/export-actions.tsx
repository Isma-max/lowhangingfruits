"use client";

import { useState } from "react";
import { EditProject } from "@/lib/chacotero/types";
import {
  copyEditorialSummary,
  downloadSegmentsJSON,
  downloadTranscript,
  downloadWav,
  duplicateProject,
  saveProjectLocally,
} from "@/lib/chacotero/export";
import { MoreHorizontal, RefreshCw, Download, Copy, Save, Copy as CopyIcon } from "lucide-react";

interface ExportActionsProps {
  project: EditProject;
  editedAudioUrl: string | null;
  activeSegmentId: string | null;
  onRegenerateAll: () => void;
  onRegenerateSegment: (id: string) => void;
  showToast: (text: string, variant?: "default" | "success") => void;
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

export function ExportActions({
  project,
  editedAudioUrl,
  activeSegmentId,
  onRegenerateAll,
  onRegenerateSegment,
  showToast,
}: ExportActionsProps) {
  const [open, setOpen] = useState(false);

  function close(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all"
      >
        <MoreHorizontal size={13} />
        Acciones
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden z-50 w-64 divide-y divide-[var(--border)]">
            <div className="py-1">
              <MenuItem icon={<RefreshCw size={12} />} label="Regenerar corte completo" onClick={() => close(onRegenerateAll)} />
              <MenuItem
                icon={<RefreshCw size={12} />}
                label="Regenerar bloque activo"
                onClick={() =>
                  close(() => {
                    if (activeSegmentId) onRegenerateSegment(activeSegmentId);
                    else showToast("Reproduce o selecciona un bloque primero.");
                  })
                }
              />
            </div>
            <div className="py-1">
              <MenuItem
                icon={<Download size={12} />}
                label="Descargar WAV"
                onClick={() =>
                  close(() => {
                    if (editedAudioUrl) {
                      downloadWav(editedAudioUrl, `${project.id}.wav`);
                    } else {
                      showToast("Aún no hay audio renderizado.");
                    }
                  })
                }
              />
              <MenuItem
                icon={<Download size={12} />}
                label="Descargar MP3"
                onClick={() =>
                  close(() =>
                    showToast("La exportación a MP3 se conecta al render final del backend (aún no disponible en el MVP).")
                  )
                }
              />
              <MenuItem icon={<Download size={12} />} label="Descargar transcript" onClick={() => close(() => downloadTranscript(project))} />
              <MenuItem icon={<Download size={12} />} label="Exportar cortes (JSON)" onClick={() => close(() => downloadSegmentsJSON(project))} />
            </div>
            <div className="py-1">
              <MenuItem
                icon={<Copy size={12} />}
                label="Copiar resumen editorial"
                onClick={() =>
                  close(async () => {
                    await copyEditorialSummary(project);
                    showToast("Resumen editorial copiado.", "success");
                  })
                }
              />
              <MenuItem
                icon={<Save size={12} />}
                label="Guardar proyecto"
                onClick={() =>
                  close(() => {
                    saveProjectLocally(project);
                    showToast("Proyecto guardado.", "success");
                  })
                }
              />
              <MenuItem
                icon={<CopyIcon size={12} />}
                label="Duplicar proyecto"
                onClick={() =>
                  close(() => {
                    duplicateProject(project);
                    showToast("Proyecto duplicado.", "success");
                  })
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
