/** 作業記録のうち、時間計算に必要な部分 */
export type TimedActivity = {
  startedAt: Date;
  /** null = 実行中 */
  endedAt: Date | null;
  /** null = 無制限 */
  plannedMin: number | null;
};

const MS_PER_MIN = 60_000;

/** 経過時間（ミリ秒）。実行中なら now までの時間。 */
export function elapsedMs(a: TimedActivity, now: Date): number {
  const end = a.endedAt ?? now;
  return Math.max(0, end.getTime() - a.startedAt.getTime());
}

/** 予定時間を超過した時間（ミリ秒）。予定なし・超過なしなら 0。 */
export function overrunMs(a: TimedActivity, now: Date): number {
  if (a.plannedMin == null) return 0;
  return Math.max(0, elapsedMs(a, now) - a.plannedMin * MS_PER_MIN);
}

export function isOverrun(a: TimedActivity, now: Date): boolean {
  return overrunMs(a, now) > 0;
}

/** ミリ秒を "H:MM:SS" 形式にする */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
