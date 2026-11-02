import { type Activity, toTimed } from "./activity";
import { type Range, clip, unionMs } from "./period";
import { type Tag, descendantIds, flattenTagTree } from "./tag";

export type TagSummaryRow = {
  tag: Tag;
  depth: number;
  /** このタグか子孫タグが付いた作業の時間（1つの作業は1回だけ数える） */
  totalMs: number;
};

export type TitleSummaryRow = { title: string; totalMs: number; count: number };

export type OverrunRow = { activity: Activity; overrunMs: number };

export type Summary = {
  /** 各作業の時間をそのまま足した合計（並行作業は重ねて数える） */
  totalMs: number;
  /** 何かしら記録がある実際の時間（重なりは1回だけ数える） */
  coveredMs: number;
  activityCount: number;
  /** 時間が0のタグは含めない。木の順（親→子） */
  byTag: TagSummaryRow[];
  untaggedMs: number;
  /** 時間の長い順 */
  byTitle: TitleSummaryRow[];
  /** 超過時間の長い順 */
  overruns: OverrunRow[];
  overrunTotalMs: number;
};

/**
 * 期間 range の集計。期間をまたぐ作業は期間内の部分だけ数える。
 * 超過は「開始 + 予定時間」から終了までの区間のうち、期間内の部分を数える。
 */
export function summarize(
  activities: readonly Activity[],
  tags: readonly Tag[],
  range: Range,
  now: Date,
): Summary {
  const parts = activities.flatMap((activity) => {
    const t = toTimed(activity);
    const end = t.endedAt ?? now;
    const c = clip(t.startedAt, end, range);
    if (!c) return [];
    const ms = c.end.getTime() - c.start.getTime();
    let overrunMs = 0;
    if (activity.plannedMin !== null) {
      const over = clip(new Date(t.startedAt.getTime() + activity.plannedMin * 60_000), end, range);
      if (over) overrunMs = over.end.getTime() - over.start.getTime();
    }
    return [{ activity, range: c, ms, overrunMs }];
  });

  const totalMs = parts.reduce((sum, p) => sum + p.ms, 0);

  // タグ別（子孫を合算）
  const knownTagIds = new Set(tags.map((t) => t.id));
  const byTag = flattenTagTree(tags)
    .map(({ tag, depth }) => {
      const covered = new Set([tag.id, ...descendantIds(tags, tag.id)]);
      const ms = parts
        .filter((p) => p.activity.tagIds.some((id) => covered.has(id)))
        .reduce((sum, p) => sum + p.ms, 0);
      return { tag, depth, totalMs: ms };
    })
    .filter((row) => row.totalMs > 0);
  const untaggedMs = parts
    .filter((p) => !p.activity.tagIds.some((id) => knownTagIds.has(id)))
    .reduce((sum, p) => sum + p.ms, 0);

  // 作業タイトル別
  const titles = new Map<string, TitleSummaryRow>();
  for (const p of parts) {
    const row = titles.get(p.activity.title) ?? { title: p.activity.title, totalMs: 0, count: 0 };
    row.totalMs += p.ms;
    row.count += 1;
    titles.set(p.activity.title, row);
  }
  const byTitle = [...titles.values()].sort(
    (a, b) => b.totalMs - a.totalMs || a.title.localeCompare(b.title, "ja"),
  );

  const overruns = parts
    .filter((p) => p.overrunMs > 0)
    .map((p) => ({ activity: p.activity, overrunMs: p.overrunMs }))
    .sort((a, b) => b.overrunMs - a.overrunMs);

  return {
    totalMs,
    coveredMs: unionMs(parts.map((p) => p.range)),
    activityCount: parts.length,
    byTag,
    untaggedMs,
    byTitle,
    overruns,
    overrunTotalMs: overruns.reduce((sum, o) => sum + o.overrunMs, 0),
  };
}
