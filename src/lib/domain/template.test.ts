import { describe, expect, it } from "vitest";
import {
  type Template,
  activityToTemplateInput,
  createTemplate,
  deleteTemplate,
  moveTemplate,
  parseTemplates,
  templateToStartInput,
  updateTemplate,
} from "./template";

const tpl = (id: string): Template => ({ id, title: id, plannedMin: null, tagIds: [] });
const list = [tpl("a"), tpl("b"), tpl("c")];

describe("template", () => {
  it("作成時に入力を検証・正規化する", () => {
    const next = createTemplate([], { title: " 筋トレ ", plannedMin: 30, tagIds: ["x", "x"] }, "t");
    expect(next).toEqual([{ id: "t", title: "筋トレ", plannedMin: 30, tagIds: ["x"] }]);
    expect(() => createTemplate([], { title: "", plannedMin: null, tagIds: [] }, "t")).toThrow();
  });
  it("更新・削除できる", () => {
    const next = updateTemplate(list, "b", { title: "B", plannedMin: 15, tagIds: [] });
    expect(next[1]).toEqual({ id: "b", title: "B", plannedMin: 15, tagIds: [] });
    expect(() => updateTemplate(list, "z", { title: "B", plannedMin: 15, tagIds: [] })).toThrow();
    expect(deleteTemplate(list, "b").map((t) => t.id)).toEqual(["a", "c"]);
  });
  it.each([
    ["b", -1, ["b", "a", "c"]],
    ["b", 1, ["a", "c", "b"]],
    ["a", -1, ["a", "b", "c"]],
    ["c", 5, ["a", "b", "c"]],
    ["z", 1, ["a", "b", "c"]],
  ])("moveTemplate(%s, %i)", (id, delta, expected) => {
    expect(moveTemplate(list, id as string, delta as number).map((t) => t.id)).toEqual(expected);
  });
  it("テンプレートと記録の相互変換（配列はコピーする）", () => {
    const t: Template = { id: "t", title: "読書", plannedMin: 30, tagIds: ["h"] };
    const input = templateToStartInput(t);
    expect(input).toEqual({ title: "読書", plannedMin: 30, tagIds: ["h"] });
    expect(input.tagIds).not.toBe(t.tagIds);
    expect(
      activityToTemplateInput({ id: "a", title: "x", startedAt: "", endedAt: null, plannedMin: null, tagIds: ["k"] }),
    ).toEqual({ title: "x", plannedMin: null, tagIds: ["k"] });
  });
  it("parseTemplates は壊れた要素を捨てる", () => {
    expect(parseTemplates([tpl("a"), { id: "b" }, null, { id: "c", title: "c", plannedMin: null }])).toEqual([
      tpl("a"),
      tpl("c"),
    ]);
  });
});
