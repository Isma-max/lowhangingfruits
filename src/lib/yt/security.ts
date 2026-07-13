const CONTROL_CHARS = new RegExp("[\\x00-\\x1f\\x7f]", "g");
const ACCENTED_LETTERS = "áéíóúñÁÉÍÓÚÑ";
const UNSAFE_FILENAME_CHARS = new RegExp(`[^\\w.\\- ${ACCENTED_LETTERS}]`, "g");

/** Strips path separators/control chars so an uploaded filename is safe to store and display. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const cleaned = base
    .replace(CONTROL_CHARS, "")
    .replace(UNSAFE_FILENAME_CHARS, "_")
    .slice(0, 200)
    .trim();
  return cleaned || "archivo.csv";
}

/**
 * Neutralizes CSV/formula injection: if a cell value starts with a character
 * spreadsheet apps treat as a formula prefix (=, +, -, @, tab, CR), prepend
 * a leading apostrophe so it's rendered as literal text instead of executed.
 */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

export function isFileSizeAllowed(byteLength: number): boolean {
  return byteLength > 0 && byteLength <= MAX_UPLOAD_BYTES;
}
