// <input type="datetime-local"> の値（"YYYY-MM-DDTHH:MM"、端末のローカル時刻）と Date の相互変換

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateTimeLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 不正な値なら Invalid Date を返す */
export function fromDateTimeLocal(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return new Date(Number.NaN);
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, Number.isNaN(s) ? 0 : s);
  // 2月30日などの繰り上がりを不正とみなす
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return new Date(Number.NaN);
  return date;
}

/** 秒以下を切り捨てる */
export function truncateToMinute(d: Date): Date {
  const r = new Date(d);
  r.setSeconds(0, 0);
  return r;
}

/** ローカル時刻の0時 */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}
