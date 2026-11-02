import { describe, expect, it } from "vitest";
import type { Activity } from "./activity";
import { layoutTimeline } from "./timeline";

const d = (h: number, mi = 0, day = 2) => new Date(2026, 10, day, h, mi);
const act = (id: string, s: Date, e: Date | null): Activity => ({
  id,
  title: id,
  startedAt: s.toISOString(),
  endedAt: e?.toISOString() ?? null,
  plannedMin: null,
  tagIds: [],
});
const range = { start: d(0), end: d(0, 0, 3) };
const now = d(18);
const summary = (items: ReturnType<typeof layoutTimeline>) =>
  Object.fromEntries(items.map((i) => [i.activity.id, `${i.lane}/${i.laneCount}`]));

describe("layoutTimeline", () => {
  it("重ならない作業はすべて1列", () => {
    const items = layoutTimeline([act("a", d(9), d(10)), act("b", d(10), d(11))], range, now);
    expect(summary(items)).toEqual({ a: "0/1", b: "0/1" });
  });
  it("並行作業は横に並べ、グループごとに列数を決める", () => {
    const items = layoutTimeline(
      [
        act("long", d(9), d(12)),
        act("x", d(9, 30), d(10)),
        act("y", d(10, 30), d(11)), // x の列が空いたので再利用
        act("z", d(10, 45), d(11, 30)),
        act("later", d(13), d(14)), // 別グループ
      ],
      range,
      now,
    );
    expect(summary(items)).toEqual({ long: "0/3", x: "1/3", y: "1/3", z: "2/3", later: "0/1" });
  });
  it("日をまたぐ作業は切り取り、実行中は now まで", () => {
    const items = layoutTimeline([act("night", d(23, 0, 1), d(1)), act("run", d(17), null)], range, now);
    expect(items.map((i) => [i.activity.id, i.start.getHours(), i.end.getHours()])).toEqual([
      ["night", 0, 1],
      ["run", 17, 18],
    ]);
  });
  it("範囲外の作業は含めない", () => {
    expect(layoutTimeline([act("old", d(9, 0, 1), d(10, 0, 1))], range, now)).toEqual([]);
  });
});
