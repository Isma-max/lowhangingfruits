import { createHash } from "node:crypto";

/** SHA-256 hash of raw file content, used for duplicate-upload detection. */
export function hashContent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
