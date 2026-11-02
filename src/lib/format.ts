/** ローカル時刻の "HH:MM" */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 分数を "1時間30分" のように表す */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "11/2(月)" */
export function formatDay(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

/** ミリ秒を "2時間30分" / "45分" のように表す（分未満は切り捨て） */
export function formatHm(ms: number): string {
  return formatMinutes(Math.floor(Math.max(0, ms) / 60_000));
}

/** "2026年11月" */
export function formatMonth(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
