/** Both providers expect Beijing time (UTC+8) in their wire formats. */
const BJ_OFFSET_MS = 8 * 60 * 60 * 1000;

function bjParts(d: Date) {
  const s = new Date(d.getTime() + BJ_OFFSET_MS).toISOString(); // shifted, then read as "UTC"
  return { date: s.slice(0, 10), time: s.slice(11, 19) };
}

/** WeChat Pay time_expire: RFC 3339, e.g. 2026-10-25T18:30:00+08:00 */
export function toBeijingRfc3339(d: Date): string {
  const { date, time } = bjParts(d);
  return `${date}T${time}+08:00`;
}

/** Alipay timestamp / time_expire: "yyyy-MM-dd HH:mm:ss" in Beijing time. */
export function toBeijingDateTime(d: Date): string {
  const { date, time } = bjParts(d);
  return `${date} ${time}`;
}

/** Parse Alipay "yyyy-MM-dd HH:mm:ss" (Beijing) back to a Date. */
export function fromBeijingDateTime(s: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
