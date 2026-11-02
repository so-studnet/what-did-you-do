import { describe, expect, it } from "vitest";
import type { Activity } from "./activity";
import type { Tag } from "./tag";
import { summarize } from "./summary";

const d = (h: number, mi = 0, day = 2) => new Date(2026, 10, day, h, mi);
const MIN = 60_000;
const act = (
  id: string,
  title: string,
  s: Date,
  e: Date | null,
  tagIds: string[] = [],
  plannedMin: number | null = null,
): Activity => ({ id, title, startedAt: s.toISOString(), endedAt: e?.toISOString() ?? null, plannedMin, tagIds });

const c = "#000";
const tags: Tag[] = [
  { id: "work", name: "仕事", parentId: null, color: c },
  { id: "mtg", name: "会議", parentId: "work", color: c },
  { id: "dev", name: "開発", parentId: "work", color: c },
  { id: "hobby", name: "趣味", parentId: null, color: c },
];
const day = { start: d(0), end: d(0, 0, 3) };
const now = d(20);

describe("summarize", () => {
  const activities = [
    act("1", "定例", d(9), d(10), ["mtg"]), // 60分
    act("2", "実装", d(10), d(12), ["dev"], 90), // 120分、超過30分
    act("3", "実装", d(11), d(11, 30), ["dev", "work"]), // 30分（並行）。仕事は1回だけ数える
    act("4", "散歩", d(19), null), // 実行中、60分、タグなし
    act("5", "昨日", d(9, 0, 1), d(10, 0, 1), ["hobby"]), // 範囲外
  ];
  const s = summarize(activities, tags, day, now);

  it("合計は並行作業を重ねて数え、実時間は重なりを除く", () => {
    expect(s.totalMs).toBe(270 * MIN);
    expect(s.coveredMs).toBe(240 * MIN);
    expect(s.activityCount).toBe(4);
  });
  it("タグ別は子孫を親に合算し、1つの作業は1回だけ数える。0のタグは出さない", () => {
    expect(s.byTag.map((r) => [r.tag.name, r.depth, r.totalMs / MIN])).toEqual([
      ["仕事", 0, 210],
      ["会議", 1, 60],
      ["開発", 1, 150],
    ]);
    expect(s.untaggedMs).toBe(60 * MIN);
  });
  it("作業タイトル別は長い順", () => {
    expect(s.byTitle.map((r) => [r.title, r.totalMs / MIN, r.count])).toEqual([
      ["実装", 150, 2],
      ["散歩", 60, 1], // 同じ時間なら名前順
      ["定例", 60, 1],
    ]);
  });
  it("超過", () => {
    expect(s.overruns.map((o) => [o.activity.id, o.overrunMs / MIN])).toEqual([["2", 30]]);
    expect(s.overrunTotalMs).toBe(30 * MIN);
  });
  it("日をまたぐ作業は期間内の部分だけ数え、超過も期間内の部分だけ数える", () => {
    // 前日 23:00 開始、予定30分、当日 01:00 終了 → 当日分 60分、超過は当日分 60分
    const r = summarize([act("n", "夜更かし", d(23, 0, 1), d(1), [], 30)], tags, day, now);
    expect(r.totalMs).toBe(60 * MIN);
    expect(r.overrunTotalMs).toBe(60 * MIN);
    // 前日の集計では 60分、超過 30分
    const prev = summarize([act("n", "夜更かし", d(23, 0, 1), d(1), [], 30)], tags, { start: d(0, 0, 1), end: d(0) }, now);
    expect(prev.totalMs).toBe(60 * MIN);
    expect(prev.overrunTotalMs).toBe(30 * MIN);
  });
  it("存在しないタグだけが付いた作業はタグなし扱い", () => {
    const r = summarize([act("x", "x", d(9), d(10), ["deleted"])], tags, day, now);
    expect(r.untaggedMs).toBe(60 * MIN);
    expect(r.byTag).toEqual([]);
  });
});
