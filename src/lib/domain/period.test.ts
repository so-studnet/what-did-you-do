import { describe, expect, it } from "vitest";
import { clip, periodRange, unionMs } from "./period";

const d = (y: number, m: number, day: number, h = 0, mi = 0) => new Date(y, m - 1, day, h, mi);

describe("periodRange", () => {
  const anchor = d(2026, 11, 4, 15); // 水曜
  it("日", () => {
    expect(periodRange("day", anchor)).toEqual({ start: d(2026, 11, 4), end: d(2026, 11, 5) });
    expect(periodRange("day", anchor, -4)).toEqual({ start: d(2026, 10, 31), end: d(2026, 11, 1) });
  });
  it("週は月曜始まり", () => {
    expect(periodRange("week", anchor)).toEqual({ start: d(2026, 11, 2), end: d(2026, 11, 9) });
    expect(periodRange("week", d(2026, 11, 8, 23))).toEqual({ start: d(2026, 11, 2), end: d(2026, 11, 9) }); // 日曜
    expect(periodRange("week", d(2026, 11, 9))).toEqual({ start: d(2026, 11, 9), end: d(2026, 11, 16) }); // 月曜
    expect(periodRange("week", anchor, -1)).toEqual({ start: d(2026, 10, 26), end: d(2026, 11, 2) });
  });
  it("月（年をまたぐ）", () => {
    expect(periodRange("month", anchor)).toEqual({ start: d(2026, 11, 1), end: d(2026, 12, 1) });
    expect(periodRange("month", anchor, 2)).toEqual({ start: d(2027, 1, 1), end: d(2027, 2, 1) });
    expect(periodRange("month", d(2026, 3, 31), -1)).toEqual({ start: d(2026, 2, 1), end: d(2026, 3, 1) });
  });
});

describe("clip", () => {
  const range = { start: d(2026, 11, 2), end: d(2026, 11, 3) };
  it("日をまたぐ作業は日の境界で切る", () => {
    expect(clip(d(2026, 11, 1, 23), d(2026, 11, 2, 1), range)).toEqual({ start: d(2026, 11, 2), end: d(2026, 11, 2, 1) });
    expect(clip(d(2026, 11, 2, 23), d(2026, 11, 3, 2), range)).toEqual({ start: d(2026, 11, 2, 23), end: d(2026, 11, 3) });
  });
  it("重ならなければ null（境界で接するだけも null）", () => {
    expect(clip(d(2026, 11, 1, 22), d(2026, 11, 2), range)).toBeNull();
    expect(clip(d(2026, 11, 3), d(2026, 11, 3, 1), range)).toBeNull();
  });
});

describe("unionMs", () => {
  const h = 3600_000;
  const r = (s: number, e: number) => ({ start: d(2026, 11, 2, s), end: d(2026, 11, 2, e) });
  it("重なりは1回だけ数える", () => {
    expect(unionMs([r(9, 11), r(10, 12), r(13, 14)])).toBe(4 * h);
  });
  it("包含・接している区間", () => {
    expect(unionMs([r(9, 17), r(10, 11)])).toBe(8 * h);
    expect(unionMs([r(9, 10), r(10, 11)])).toBe(2 * h);
  });
  it("空なら0", () => {
    expect(unionMs([])).toBe(0);
  });
});
