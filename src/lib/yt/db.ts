import { PrismaClient } from "@prisma/client";

declare global {
  var __ytPrisma: PrismaClient | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL ?? "";

  // If using PostgreSQL or executing on Vercel, instantiate standard PrismaClient
  if (
    url.startsWith("postgres://") ||
    url.startsWith("postgresql://") ||
    process.env.VERCEL
  ) {
    return new PrismaClient();
  }

  // Fallback to SQLite locally
  try {
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const adapter = new PrismaBetterSqlite3({ url: url || "file:./prisma/dev.db" });
    return new PrismaClient({ adapter });
  } catch {
    // Return standard client if adapter fails to load (e.g. during build pipeline)
    return new PrismaClient();
  }
}

export const db = globalThis.__ytPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__ytPrisma = db;
}
