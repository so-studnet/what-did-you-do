import { addDays, startOfLocalDay } from "./datetime-local";

/** 半開区間 [start, end) */
export type Range = { start: Date; end: Date };

export type PeriodKind = "day" | "week" | "month";

/**
 * anchor を含む期間を、offset 個ずらして返す（ローカル時刻基準）。
 * 週は月曜始まり。
 */
export function periodRange(kind: PeriodKind, anchor: Date, offset = 0): Range {
  const day = startOfLocalDay(anchor);
  switch (kind) {
    case "day": {
      const start = addDays(day, offset);
      return { start, end: addDays(start, 1) };
    }
    case "week": {
      const sinceMonday = (day.getDay() + 6) % 7;
      const start = addDays(day, -sinceMonday + offset * 7);
      return { start, end: addDays(start, 7) };
    }
    case "month": {
      const start = new Date(day.getFullYear(), day.getMonth() + offset, 1);
      return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
    }
  }
}

/** 区間 [start, end) を range で切り取る。重ならなければ null。 */
export function clip(start: Date, end: Date, range: Range): Range | null {
  const s = Math.max(start.getTime(), range.start.getTime());
  const e = Math.min(end.getTime(), range.end.getTime());
  return e > s ? { start: new Date(s), end: new Date(e) } : null;
}

/** 区間の和集合の長さ（ミリ秒）。重なっている部分は1回だけ数える。 */
export function unionMs(ranges: readonly Range[]): number {
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  let total = 0;
  let curStart = -Infinity;
  let curEnd = -Infinity;
  for (const r of sorted) {
    const s = r.start.getTime();
    const e = r.end.getTime();
    if (s > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else if (e > curEnd) {
      curEnd = e;
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}
