"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/wemul";

export function YtHeader({
  userName,
  breadcrumb,
}: {
  userName: string;
  breadcrumb?: { label: string; href?: string }[];
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/yt/auth/logout", { method: "POST" });
    router.push("/yt/login");
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
        padding: "var(--space-4) var(--space-6)",
        background: "#fff",
        borderBottom: "1px solid var(--border-subtle)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <Link href="/yt/clients" style={{ display: "flex", alignItems: "center" }}>
          <Image src="/yt/wemul-logo-lockup.png" alt="Wemul" width={40} height={33} />
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-text)", fontSize: "0.875rem" }}>
          <Link href="/yt/clients" style={{ color: "var(--text-muted)", fontWeight: 600, textDecoration: "none" }}>
            Clientes
          </Link>
          {breadcrumb?.map((b, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--text-faint)" }}>/</span>
              {b.href ? (
                <Link href={b.href} style={{ color: "var(--text-muted)", fontWeight: 600, textDecoration: "none" }}>
                  {b.label}
                </Link>
              ) : (
                <span style={{ color: "var(--text-strong)", fontWeight: 700 }}>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <span style={{ fontFamily: "var(--font-text)", fontSize: "0.875rem", color: "var(--text-muted)" }}>{userName}</span>
        <Button variant="ghost" size="sm" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
