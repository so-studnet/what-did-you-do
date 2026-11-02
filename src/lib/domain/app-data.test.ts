import { describe, expect, it } from "vitest";
import { type AppData, deleteTagEverywhere, parseAppData } from "./app-data";

describe("parseAppData", () => {
  it("オブジェクトでなければ空", () => {
    expect(parseAppData(null)).toEqual({ activities: [], tags: [], templates: [] });
  });
  it("欠けている項目は空配列", () => {
    expect(parseAppData({ tags: [{ id: "t", name: "x", parentId: null, color: "#000" }] })).toEqual({
      activities: [],
      tags: [{ id: "t", name: "x", parentId: null, color: "#000" }],
      templates: [],
    });
  });
});

describe("deleteTagEverywhere", () => {
  it("タグを削除し、記録・テンプレートから取り外す。子タグは親に付け替える", () => {
    const data: AppData = {
      tags: [
        { id: "work", name: "仕事", parentId: null, color: "#000" },
        { id: "mtg", name: "会議", parentId: "work", color: "#000" },
      ],
      activities: [
        { id: "a", title: "x", startedAt: "2026-11-02T00:00:00.000Z", endedAt: null, plannedMin: null, tagIds: ["work", "mtg"] },
        { id: "b", title: "y", startedAt: "2026-11-02T00:00:00.000Z", endedAt: null, plannedMin: null, tagIds: [] },
      ],
      templates: [{ id: "t", title: "z", plannedMin: null, tagIds: ["work"] }],
    };
    const next = deleteTagEverywhere(data, "work");
    expect(next.tags).toEqual([{ id: "mtg", name: "会議", parentId: null, color: "#000" }]);
    expect(next.activities.map((a) => a.tagIds)).toEqual([["mtg"], []]);
    expect(next.activities[1]).toBe(data.activities[1]);
    expect(next.templates[0].tagIds).toEqual([]);
  });
});
