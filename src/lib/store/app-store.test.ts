import { describe, expect, it } from "vitest";
import { decodeStoredData } from "./app-store";

const act = { id: "a", title: "x", startedAt: "2026-11-02T09:00:00.000Z", endedAt: null, plannedMin: null };

describe("decodeStoredData", () => {
  it("何もなければ空", () => {
    expect(decodeStoredData(null, null)).toEqual({ activities: [], tags: [], templates: [] });
  });
  it("v1（作業記録の配列）から移行する", () => {
    expect(decodeStoredData(null, JSON.stringify([act]))).toEqual({
      activities: [{ ...act, tagIds: [] }],
      tags: [],
      templates: [],
    });
  });
  it("v2 があれば v1 は無視する", () => {
    const v2 = { activities: [], tags: [], templates: [] };
    expect(decodeStoredData(JSON.stringify(v2), JSON.stringify([act]))).toEqual(v2);
  });
  it("壊れたJSONは空として扱う", () => {
    expect(decodeStoredData("{", null).activities).toEqual([]);
  });
});
