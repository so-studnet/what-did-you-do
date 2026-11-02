import { describe, expect, it } from "vitest";
import {
  type Activity,
  endedOnSameDay,
  parseActivities,
  runningActivities,
  startActivity,
  stopActivity,
  validateStartInput,
} from "./activity";

const t = (iso: string) => new Date(iso);

describe("validateStartInput", () => {
  it("前後の空白を取り除く", () => {
    expect(validateStartInput({ title: "  読書 ", plannedMin: null })).toEqual({
      ok: true,
      value: { title: "読書", plannedMin: null },
    });
  });
  it("空のタイトルはエラー", () => {
    expect(validateStartInput({ title: "   ", plannedMin: null }).ok).toBe(false);
  });
  it("長すぎるタイトルはエラー", () => {
    expect(validateStartInput({ title: "あ".repeat(101), plannedMin: null }).ok).toBe(false);
  });
  it.each([0, -5, 1.5, 24 * 60 + 1, Number.NaN])("予定時間 %s はエラー", (m) => {
    expect(validateStartInput({ title: "x", plannedMin: m }).ok).toBe(false);
  });
  it.each([1, 25, 24 * 60])("予定時間 %s はOK", (m) => {
    expect(validateStartInput({ title: "x", plannedMin: m }).ok).toBe(true);
  });
});

describe("startActivity / stopActivity", () => {
  it("複数の作業を並行して開始でき、それぞれ独立に終了できる", () => {
    let list: Activity[] = [];
    list = startActivity(list, { title: "開発", plannedMin: null }, t("2026-11-02T09:00:00Z"), "a");
    list = startActivity(list, { title: "洗濯", plannedMin: 30 }, t("2026-11-02T09:10:00Z"), "b");
    expect(runningActivities(list).map((a) => a.id)).toEqual(["a", "b"]);

    list = stopActivity(list, "b", t("2026-11-02T09:40:00Z"));
    expect(runningActivities(list).map((a) => a.id)).toEqual(["a"]);
    expect(list.find((a) => a.id === "b")).toMatchObject({
      endedAt: "2026-11-02T09:40:00.000Z",
      plannedMin: 30,
    });
  });

  it("不正な入力では開始できない", () => {
    expect(() => startActivity([], { title: "", plannedMin: null }, new Date(), "a")).toThrow();
  });

  it("終了済みの作業を再度終了しても終了時刻は変わらない", () => {
    let list = startActivity([], { title: "x", plannedMin: null }, t("2026-11-02T09:00:00Z"), "a");
    list = stopActivity(list, "a", t("2026-11-02T10:00:00Z"));
    list = stopActivity(list, "a", t("2026-11-02T11:00:00Z"));
    expect(list[0].endedAt).toBe("2026-11-02T10:00:00.000Z");
  });

  it("元の配列を変更しない", () => {
    const list: Activity[] = [];
    startActivity(list, { title: "x", plannedMin: null }, new Date(), "a");
    expect(list).toEqual([]);
  });
});

describe("endedOnSameDay", () => {
  it("同じ日に終了したものを新しい順に返す", () => {
    const day = new Date(2026, 10, 2, 12);
    const list: Activity[] = [
      { id: "1", title: "a", startedAt: new Date(2026, 10, 2, 8).toISOString(), endedAt: new Date(2026, 10, 2, 9).toISOString(), plannedMin: null },
      { id: "2", title: "b", startedAt: new Date(2026, 10, 2, 9).toISOString(), endedAt: new Date(2026, 10, 2, 10).toISOString(), plannedMin: null },
      { id: "3", title: "c", startedAt: new Date(2026, 10, 1, 9).toISOString(), endedAt: new Date(2026, 10, 1, 10).toISOString(), plannedMin: null },
      { id: "4", title: "d", startedAt: new Date(2026, 10, 2, 9).toISOString(), endedAt: null, plannedMin: null },
    ];
    expect(endedOnSameDay(list, day).map((a) => a.id)).toEqual(["2", "1"]);
  });
});

describe("parseActivities", () => {
  it("配列でなければ空", () => {
    expect(parseActivities(null)).toEqual([]);
    expect(parseActivities({})).toEqual([]);
  });
  it("壊れた要素だけ捨てる", () => {
    const ok = { id: "a", title: "x", startedAt: "2026-11-02T09:00:00.000Z", endedAt: null, plannedMin: null };
    expect(parseActivities([ok, { id: 1 }, { ...ok, startedAt: "bad" }])).toEqual([ok]);
  });
});
