import { type Activity, toTimed } from "./activity";
import { type Range, clip } from "./period";

export type TimelineItem = {
  activity: Activity;
  /** range 内に切り取った表示区間 */
  start: Date;
  end: Date;
  /** 0 始まりの列番号 */
  lane: number;
  /** この項目と重なり合うグループ内の列数 */
  laneCount: number;
};

/**
 * 1日（range）のタイムラインの配置を決める。
 * 並行作業は横に並べる。重なり合う作業のグループごとに、空いている最も左の列に置く。
 * 実行中の作業は now までとして扱う。
 */
export function layoutTimeline(activities: readonly Activity[], range: Range, now: Date): TimelineItem[] {
  const items = activities
    .flatMap((activity) => {
      const t = toTimed(activity);
      const c = clip(t.startedAt, t.endedAt ?? now, range);
      return c ? [{ activity, ...c }] : [];
    })
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        b.end.getTime() - a.end.getTime() ||
        a.activity.id.localeCompare(b.activity.id),
    );

  const result: TimelineItem[] = [];
  let group: TimelineItem[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  const flush = () => {
    for (const item of group) item.laneCount = laneEnds.length;
    result.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const it of items) {
    const s = it.start.getTime();
    const e = it.end.getTime();
    if (s >= groupEnd) {
      flush();
      groupEnd = e;
    } else {
      groupEnd = Math.max(groupEnd, e);
    }
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else {
      laneEnds[lane] = e;
    }
    group.push({ ...it, lane, laneCount: 0 });
  }
  flush();
  return result;
}
