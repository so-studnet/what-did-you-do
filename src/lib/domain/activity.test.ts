import { describe, expect, it } from "vitest";
import {
  type Activity,
  addActivity,
  deleteActivity,
  endedOnSameDay,
  parseActivities,
  runningActivities,
  startActivity,
  stopActivity,
  updateActivity,
  validateDraft,
  validateStartInput,
} from "./activity";

const t = (iso: string) => new Date(iso);

describe("validateStartInput", () => {
  it("前後の空白を取り除く", () => {
    expect(validateStartInput({ title: "  読書 ", plannedMin: null, tagIds: [] })).toEqual({
      ok: true,
      value: { title: "読書", plannedMin: null, tagIds: [] },
    });
  });
  it("空のタイトルはエラー", () => {
    expect(validateStartInput({ title: "   ", plannedMin: null, tagIds: [] }).ok).toBe(false);
  });
  it("長すぎるタイトルはエラー", () => {
    expect(validateStartInput({ title: "あ".repeat(101), plannedMin: null, tagIds: [] }).ok).toBe(false);
  });
  it.each([0, -5, 1.5, 24 * 60 + 1, Number.NaN])("予定時間 %s はエラー", (m) => {
    expect(validateStartInput({ title: "x", plannedMin: m, tagIds: [] }).ok).toBe(false);
  });
  it.each([1, 25, 24 * 60])("予定時間 %s はOK", (m) => {
    expect(validateStartInput({ title: "x", plannedMin: m, tagIds: [] }).ok).toBe(true);
  });
});

describe("startActivity / stopActivity", () => {
  it("複数の作業を並行して開始でき、それぞれ独立に終了できる", () => {
    let list: Activity[] = [];
    list = startActivity(list, { title: "開発", plannedMin: null, tagIds: [] }, t("2026-11-02T09:00:00Z"), "a");
    list = startActivity(list, { title: "洗濯", plannedMin: 30, tagIds: [] }, t("2026-11-02T09:10:00Z"), "b");
    expect(runningActivities(list).map((a) => a.id)).toEqual(["a", "b"]);

    list = stopActivity(list, "b", t("2026-11-02T09:40:00Z"));
    expect(runningActivities(list).map((a) => a.id)).toEqual(["a"]);
    expect(list.find((a) => a.id === "b")).toMatchObject({
      endedAt: "2026-11-02T09:40:00.000Z",
      plannedMin: 30,
    });
  });

  it("不正な入力では開始できない", () => {
    expect(() => startActivity([], { title: "", plannedMin: null, tagIds: [] }, new Date(), "a")).toThrow();
  });

  it("終了済みの作業を再度終了しても終了時刻は変わらない", () => {
    let list = startActivity([], { title: "x", plannedMin: null, tagIds: [] }, t("2026-11-02T09:00:00Z"), "a");
    list = stopActivity(list, "a", t("2026-11-02T10:00:00Z"));
    list = stopActivity(list, "a", t("2026-11-02T11:00:00Z"));
    expect(list[0].endedAt).toBe("2026-11-02T10:00:00.000Z");
  });

  it("元の配列を変更しない", () => {
    const list: Activity[] = [];
    startActivity(list, { title: "x", plannedMin: null, tagIds: [] }, new Date(), "a");
    expect(list).toEqual([]);
  });
});

describe("endedOnSameDay", () => {
  it("同じ日に終了したものを新しい順に返す", () => {
    const day = new Date(2026, 10, 2, 12);
    const list: Activity[] = [
      { id: "1", title: "a", startedAt: new Date(2026, 10, 2, 8).toISOString(), endedAt: new Date(2026, 10, 2, 9).toISOString(), plannedMin: null, tagIds: [] },
      { id: "2", title: "b", startedAt: new Date(2026, 10, 2, 9).toISOString(), endedAt: new Date(2026, 10, 2, 10).toISOString(), plannedMin: null, tagIds: [] },
      { id: "3", title: "c", startedAt: new Date(2026, 10, 1, 9).toISOString(), endedAt: new Date(2026, 10, 1, 10).toISOString(), plannedMin: null, tagIds: [] },
      { id: "4", title: "d", startedAt: new Date(2026, 10, 2, 9).toISOString(), endedAt: null, plannedMin: null, tagIds: [] },
    ];
    expect(endedOnSameDay(list, day).map((a) => a.id)).toEqual(["2", "1"]);
  });
});

describe("parseActivities", () => {
  it("配列でなければ空", () => {
    expect(parseActivities(null)).toEqual([]);
    expect(parseActivities({})).toEqual([]);
  });
  it("tagIds がない古いデータは空のタグとして読む", () => {
    const old = { id: "a", title: "x", startedAt: "2026-11-02T09:00:00.000Z", endedAt: null, plannedMin: null };
    expect(parseActivities([old])).toEqual([{ ...old, tagIds: [] }]);
  });
  it("壊れた要素だけ捨てる", () => {
    const ok = { id: "a", title: "x", startedAt: "2026-11-02T09:00:00.000Z", endedAt: null, plannedMin: null, tagIds: [] };
    expect(parseActivities([ok, { id: 1 }, { ...ok, startedAt: "bad" }])).toEqual([ok]);
  });
});

describe("validateDraft", () => {
  const now = t("2026-11-02T12:00:00Z");
  const base = {
    title: " 会議 ",
    startedAt: t("2026-11-02T09:00:00Z"),
    endedAt: t("2026-11-02T10:00:00Z"),
    plannedMin: null,
    tagIds: ["a", "a", "b"],
  };
  it("正しい入力はタイトルを正規化して通す", () => {
    const r = validateDraft(base, now, { requireEnd: true });
    expect(r).toEqual({ ok: true, value: { ...base, title: "会議", tagIds: ["a", "b"] } });
  });
  it("終了が開始より前ならエラー", () => {
    const r = validateDraft({ ...base, endedAt: t("2026-11-02T08:59:00Z") }, now, { requireEnd: true });
    expect(r).toEqual({ ok: false, error: "終了時刻は開始時刻より後にしてください" });
  });
  it("開始と終了が同じ時刻はOK", () => {
    expect(validateDraft({ ...base, endedAt: base.startedAt }, now, { requireEnd: true }).ok).toBe(true);
  });
  it("未来の開始・終了はエラー", () => {
    expect(validateDraft({ ...base, startedAt: t("2026-11-02T12:01:00Z"), endedAt: null }, now, { requireEnd: false }).ok).toBe(false);
    expect(validateDraft({ ...base, endedAt: t("2026-11-02T12:01:00Z") }, now, { requireEnd: true }).ok).toBe(false);
  });
  it("requireEnd のとき終了なしはエラー、そうでなければOK", () => {
    expect(validateDraft({ ...base, endedAt: null }, now, { requireEnd: true }).ok).toBe(false);
    expect(validateDraft({ ...base, endedAt: null }, now, { requireEnd: false }).ok).toBe(true);
  });
  it("不正な日時はエラー", () => {
    expect(validateDraft({ ...base, startedAt: new Date(Number.NaN) }, now, { requireEnd: true }).ok).toBe(false);
    expect(validateDraft({ ...base, endedAt: new Date(Number.NaN) }, now, { requireEnd: true }).ok).toBe(false);
  });
  it("タイトル・予定時間の検証も行う", () => {
    expect(validateDraft({ ...base, title: "" }, now, { requireEnd: true }).ok).toBe(false);
    expect(validateDraft({ ...base, plannedMin: 0, tagIds: [] }, now, { requireEnd: true }).ok).toBe(false);
  });
});

describe("updateActivity / addActivity / deleteActivity", () => {
  const now = t("2026-11-02T12:00:00Z");
  const running: Activity = { id: "r", title: "開発", startedAt: "2026-11-02T10:00:00.000Z", endedAt: null, plannedMin: null, tagIds: [] };
  const ended: Activity = { id: "e", title: "読書", startedAt: "2026-11-02T08:00:00.000Z", endedAt: "2026-11-02T09:00:00.000Z", plannedMin: 30, tagIds: [] };
  const list = [running, ended];

  it("実行中の記録の開始時刻を修正できる（実行中のまま）", () => {
    const next = updateActivity(list, "r", { title: "開発", startedAt: t("2026-11-02T09:30:00Z"), endedAt: null, plannedMin: 60, tagIds: [] }, now);
    expect(next[0]).toEqual({ ...running, startedAt: "2026-11-02T09:30:00.000Z", plannedMin: 60, tagIds: [] });
    expect(next[1]).toBe(ended);
  });
  it("実行中の記録に終了時刻を入れると終了扱いになる", () => {
    const next = updateActivity(list, "r", { title: "開発", startedAt: t("2026-11-02T10:00:00Z"), endedAt: t("2026-11-02T11:00:00Z"), plannedMin: null, tagIds: [] }, now);
    expect(runningActivities(next)).toEqual([]);
  });
  it("終了済みの記録を実行中に戻すことはできない", () => {
    expect(() => updateActivity(list, "e", { title: "読書", startedAt: t("2026-11-02T08:00:00Z"), endedAt: null, plannedMin: 30, tagIds: [] }, now)).toThrow();
  });
  it("存在しないIDはエラー", () => {
    expect(() => updateActivity(list, "x", { title: "a", startedAt: now, endedAt: now, plannedMin: null, tagIds: [] }, now)).toThrow();
  });
  it("後から記録を追加できる", () => {
    const next = addActivity(list, { title: "散歩", startedAt: t("2026-11-01T18:00:00Z"), endedAt: t("2026-11-01T18:30:00Z"), plannedMin: null, tagIds: [] }, now, "n");
    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({ id: "n", title: "散歩", startedAt: "2026-11-01T18:00:00.000Z", endedAt: "2026-11-01T18:30:00.000Z", plannedMin: null, tagIds: [] });
  });
  it("終了時刻なしでは追加できない", () => {
    expect(() => addActivity(list, { title: "散歩", startedAt: t("2026-11-01T18:00:00Z"), endedAt: null, plannedMin: null, tagIds: [] }, now, "n")).toThrow();
  });
  it("削除できる", () => {
    expect(deleteActivity(list, "e")).toEqual([running]);
  });
});
