import { PrismaClient } from "@prisma/client";

declare global {
  var __ytPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";

  // PostgreSQL path: required on Vercel and any postgres:// URL
  // Prisma v7 requires an explicit driver adapter — the bare PrismaClient()
  // constructor no longer has a built-in query engine.
  if (
    url.startsWith("postgres://") ||
    url.startsWith("postgresql://") ||
    process.env.VERCEL
  ) {
    const { Pool } = require("pg") as typeof import("pg");
    const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  // SQLite fallback for local development
  try {
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const adapter = new PrismaBetterSqlite3({
      url: url || "file:./prisma/dev.db",
    });
    return new PrismaClient({ adapter });
  } catch {
    // Last resort — should not happen in practice
    const { Pool } = require("pg") as typeof import("pg");
    const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }
}

export const db = globalThis.__ytPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__ytPrisma = db;
}
