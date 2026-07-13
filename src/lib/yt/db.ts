import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

declare global {
  var __ytPrisma: PrismaClient | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const db = globalThis.__ytPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__ytPrisma = db;
}
