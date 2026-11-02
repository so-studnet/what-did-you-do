import type { Activity } from "./activity";

/**
 * 予定時間に達した時点の通知を一度だけ出すためのキー。
 * 開始時刻や予定時間を編集すると到達時刻が変わるので、キーも変わり、改めて通知される。
 */
export function notificationKey(a: Activity): string | null {
  if (a.plannedMin === null) return null;
  const dueAt = Date.parse(a.startedAt) + a.plannedMin * 60_000;
  return `${a.id}@${dueAt}`;
}

/** 予定時間に達した時刻 */
export function dueAt(a: Activity): Date | null {
  return a.plannedMin === null ? null : new Date(Date.parse(a.startedAt) + a.plannedMin * 60_000);
}

/** 今通知すべき作業（実行中・予定あり・予定時間に達した・まだ通知していない） */
export function dueActivities(
  activities: readonly Activity[],
  now: Date,
  notified: ReadonlySet<string>,
): Activity[] {
  return activities.filter((a) => {
    if (a.endedAt !== null) return false;
    const key = notificationKey(a);
    const due = dueAt(a);
    return key !== null && due !== null && due.getTime() <= now.getTime() && !notified.has(key);
  });
}

/** 実行中の作業のキーだけを残す（終了・削除された作業の記録を捨てる） */
export function pruneNotified(activities: readonly Activity[], notified: ReadonlySet<string>): Set<string> {
  const alive = new Set(
    activities.filter((a) => a.endedAt === null).flatMap((a) => notificationKey(a) ?? []),
  );
  return new Set([...notified].filter((k) => alive.has(k)));
}
