import type { ReactNode } from "react";
import "@/styles/wemul-tokens.css";

export const metadata = {
  title: "Reporte Compartido — Wemul",
  description: "Reporte de rendimiento de YouTube compartido públicamente.",
};

export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-subtle)",
        fontFamily: "var(--font-text)",
        color: "var(--text-body)",
      }}
    >
      {children}
    </div>
  );
}
