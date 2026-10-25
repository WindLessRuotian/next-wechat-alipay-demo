/** Money is stored and compared as integer fen. Conversion is string-based: no floats. */

export function fenToYuan(fen: number): string {
  if (!Number.isSafeInteger(fen) || fen < 0) throw new RangeError(`invalid fen amount: ${fen}`);
  return `${Math.floor(fen / 100)}.${String(fen % 100).padStart(2, "0")}`;
}

/** Parse an Alipay-style decimal amount ("0.01", "12.3", "5") into fen; null if malformed. */
export function yuanToFen(yuan: string): number | null {
  const m = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(yuan.trim());
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  return whole * 100 + frac;
}
