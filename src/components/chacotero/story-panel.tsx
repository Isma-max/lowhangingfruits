"use client";

import { StoryAnalysis } from "@/lib/chacotero/types";
import { Badge } from "@/components/ui/badge";
import { Users, Heart, Lightbulb, Flame, AlertTriangle, Sparkles } from "lucide-react";

interface StoryPanelProps {
  storyAnalysis: StoryAnalysis;
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Beat({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border)] p-3">
      <div className="text-xs text-[var(--text-muted)] font-semibold mb-1">{label}</div>
      <div className="text-sm text-[var(--text-primary)] leading-relaxed">{text}</div>
    </div>
  );
}

export function StoryPanel({ storyAnalysis }: StoryPanelProps) {
  const sa = storyAnalysis;

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="purple">{sa.conflictType}</Badge>
          {sa.tone.map((t) => (
            <Badge key={t} variant="muted">
              {t}
            </Badge>
          ))}
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] leading-snug">{sa.suggestedTitle}</h1>
        <p className="text-sm text-[var(--text-secondary)] italic leading-relaxed">&ldquo;{sa.premise}&rdquo;</p>
      </div>

      <Section title="Personajes" icon={<Users size={12} />}>
        <ul className="space-y-1.5">
          {sa.identifiedCharacters.map((c) => (
            <li key={c} className="text-sm text-[var(--text-primary)] flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-1.5" />
              {c}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Relación entre personajes" icon={<Heart size={12} />}>
        <ul className="space-y-1.5">
          {sa.relationships.map((r) => (
            <li key={r} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)] shrink-0 mt-1.5" />
              {r}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Arco narrativo" icon={<Flame size={12} />}>
        <div className="space-y-2">
          <Beat label="Conflicto principal" text={sa.mainConflict} />
          <Beat label="Giro / revelación" text={sa.turningPoint} />
          <Beat label="Clímax" text={sa.climax} />
          <Beat label="Cierre" text={sa.ending} />
        </div>
      </Section>

      {sa.continuityWarnings.length > 0 && (
        <Section title="Riesgos de continuidad" icon={<AlertTriangle size={12} />}>
          <div className="space-y-1.5">
            {sa.continuityWarnings.map((w) => (
              <div
                key={w}
                className="text-xs text-[var(--yellow)] bg-[var(--yellow-soft)] border border-[rgba(234,179,8,0.2)] rounded-lg px-3 py-2 leading-relaxed"
              >
                {w}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Decisión editorial" icon={<Lightbulb size={12} />}>
        <div className="bg-[var(--accent-soft)] rounded-lg border border-[rgba(124,106,247,0.2)] p-3">
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">{sa.editorialSummary}</p>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
          <Sparkles size={11} className="shrink-0 mt-0.5" />
          <span>
            Los momentos de mayor interés (Most Replayed) se usan como señal complementaria. La selección final
            siempre prioriza que la historia se entienda completa.
          </span>
        </div>
      </Section>
    </div>
  );
}
