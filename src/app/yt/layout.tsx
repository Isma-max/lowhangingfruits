import type { ReactNode } from "react";
import "@/styles/wemul-tokens.css";

export const metadata = {
  title: "YouTube Performance Reporter — Wemul",
  description: "Reportería interna de desempeño de canales de YouTube para Wemul.",
};

export default function YtLayout({ children }: { children: ReactNode }) {
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
