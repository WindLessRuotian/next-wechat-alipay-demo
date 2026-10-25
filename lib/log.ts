import "server-only";

type Fields = Record<string, unknown>;

/**
 * Minimal structured logger. Callers must pass already-redacted values
 * (see redact() in lib/crypto.ts) — never raw tokens, keys or signatures.
 */
function write(level: "info" | "warn" | "error", event: string, fields: Fields = {}): void {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(line);
}

export const log = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
