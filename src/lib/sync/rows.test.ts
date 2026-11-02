import { describe, expect, it } from "vitest";
import type { AppData } from "@/lib/domain/app-data";
import {
  activityToRow,
  diffAppData,
  diffRows,
  isEmptyDiff,
  mergeAppData,
  rowToActivity,
  rowToTag,
  rowsToTemplates,
  tagToRow,
  templateToRow,
} from "./rows";

const act = { id: "a", title: "開発", startedAt: "2026-11-02T09:00:00.000Z", endedAt: null, plannedMin: 30, tagIds: ["t"] };
const tag = { id: "t", name: "仕事", parentId: null, color: "#2563eb" };
const tpl = (id: string) => ({ id, title: id, plannedMin: null, tagIds: [] });
const data = (over: Partial<AppData> = {}): AppData => ({ activities: [act], tags: [tag], templates: [tpl("p"), tpl("q")], ...over });

describe("行との変換", () => {
  it("往復で元に戻る", () => {
    expect(rowToActivity(activityToRow(act))).toEqual(act);
    expect(rowToTag(tagToRow(tag))).toEqual(tag);
  });
  it("DB の日時形式（+00:00）をアプリの形式にそろえる", () => {
    const row = { ...activityToRow(act), started_at: "2026-11-02T09:00:00+00:00", ended_at: "2026-11-02T10:00:00.5+00:00" };
    expect(rowToActivity(row)).toMatchObject({ startedAt: "2026-11-02T09:00:00.000Z", endedAt: "2026-11-02T10:00:00.500Z" });
  });
  it("テンプレートは sort_order 順に並べる", () => {
    const rows = [templateToRow(tpl("x"), 2), templateToRow(tpl("y"), 0), templateToRow(tpl("z"), 1)];
    expect(rowsToTemplates(rows).map((t) => t.id)).toEqual(["y", "z", "x"]);
  });
});

describe("diffRows", () => {
  it("追加・変更・削除を見分け、変わっていない行は送らない", () => {
    const prev = [{ id: "1", v: 1 }, { id: "2", v: 2 }, { id: "3", v: 3 }];
    const next = [{ id: "1", v: 1 }, { id: "2", v: 20 }, { id: "4", v: 4 }];
    expect(diffRows(prev, next)).toEqual({ upserts: [{ id: "2", v: 20 }, { id: "4", v: 4 }], deletes: ["3"] });
  });
});

describe("diffAppData", () => {
  it("変化がなければ空", () => {
    expect(isEmptyDiff(diffAppData(data(), data()))).toBe(true);
  });
  it("作業の終了は1行の更新になる", () => {
    const d = diffAppData(data(), data({ activities: [{ ...act, endedAt: "2026-11-02T10:00:00.000Z" }] }));
    expect(d.activities.upserts.map((r) => r.ended_at)).toEqual(["2026-11-02T10:00:00.000Z"]);
    expect(d.tags.upserts).toEqual([]);
  });
  it("テンプレートの並べ替えは sort_order の更新になる", () => {
    const d = diffAppData(data(), data({ templates: [tpl("q"), tpl("p")] }));
    expect(d.templates.upserts.map((r) => [r.id, r.sort_order])).toEqual([["q", 0], ["p", 1]]);
  });
});

describe("mergeAppData", () => {
  it("ローカルの記録を足し、同じ id はサーバー側を残す", () => {
    const server = data({ activities: [{ ...act, title: "サーバー" }] });
    const local = data({ activities: [act, { ...act, id: "b" }], tags: [], templates: [tpl("r")] });
    const merged = mergeAppData(server, local);
    expect(merged.activities.map((a) => [a.id, a.title])).toEqual([["a", "サーバー"], ["b", "開発"]]);
    expect(merged.templates.map((t) => t.id)).toEqual(["p", "q", "r"]);
  });
});
