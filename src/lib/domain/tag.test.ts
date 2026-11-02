import { describe, expect, it } from "vitest";
import {
  type Tag,
  createTag,
  deleteTag,
  descendantIds,
  flattenTagTree,
  formatTagPath,
  normalizeTagIds,
  parseTags,
  updateTag,
  validateTagInput,
} from "./tag";

const c = "#2563eb";
// 仕事 > 会議, 仕事 > 開発 > レビュー, 趣味
const tags: Tag[] = [
  { id: "work", name: "仕事", parentId: null, color: c },
  { id: "mtg", name: "会議", parentId: "work", color: c },
  { id: "dev", name: "開発", parentId: "work", color: c },
  { id: "review", name: "レビュー", parentId: "dev", color: c },
  { id: "hobby", name: "趣味", parentId: null, color: c },
];

describe("validateTagInput", () => {
  it("名前の前後の空白を取り除く", () => {
    expect(validateTagInput(tags, { name: " 読書 ", parentId: "hobby", color: c })).toEqual({
      ok: true,
      value: { name: "読書", parentId: "hobby", color: c },
    });
  });
  it.each([
    ["空の名前", { name: " ", parentId: null }],
    ["「>」を含む名前", { name: "a>b", parentId: null }],
    ["長すぎる名前", { name: "あ".repeat(31), parentId: null }],
    ["存在しない親", { name: "x", parentId: "none" }],
    ["同じ階層の同名", { name: "会議", parentId: "work" }],
  ])("%s はエラー", (_, input) => {
    expect(validateTagInput(tags, { ...input, color: c }).ok).toBe(false);
  });
  it("違う階層なら同名でもOK", () => {
    expect(validateTagInput(tags, { name: "会議", parentId: "hobby", color: c }).ok).toBe(true);
  });
  it("編集時、自分自身の名前とは重複扱いしない", () => {
    expect(validateTagInput(tags, { name: "会議", parentId: "work", color: "#000" }, "mtg").ok).toBe(true);
  });
  it("自分自身や子孫を親にはできない（循環防止）", () => {
    expect(validateTagInput(tags, { name: "仕事", parentId: "work", color: c }, "work").ok).toBe(false);
    expect(validateTagInput(tags, { name: "仕事", parentId: "review", color: c }, "work").ok).toBe(false);
  });
});

describe("createTag / updateTag", () => {
  it("作成できる", () => {
    const next = createTag(tags, { name: "読書", parentId: "hobby", color: c }, "read");
    expect(next.at(-1)).toEqual({ id: "read", name: "読書", parentId: "hobby", color: c });
  });
  it("親を付け替えられる", () => {
    const next = updateTag(tags, "dev", { name: "開発", parentId: "hobby", color: c });
    expect(formatTagPath(next, "review")).toBe("趣味 > 開発 > レビュー");
  });
  it("不正な入力・存在しないIDはエラー", () => {
    expect(() => createTag(tags, { name: "", parentId: null, color: c }, "x")).toThrow();
    expect(() => updateTag(tags, "none", { name: "x", parentId: null, color: c })).toThrow();
  });
});

describe("deleteTag", () => {
  it("子タグは削除したタグの親に付け替える", () => {
    const next = deleteTag(tags, "dev");
    expect(next.find((t) => t.id === "dev")).toBeUndefined();
    expect(next.find((t) => t.id === "review")?.parentId).toBe("work");
  });
  it("ルートを削除すると子はルートになる", () => {
    const next = deleteTag(tags, "work");
    expect(next.filter((t) => t.parentId === null).map((t) => t.id).sort()).toEqual(["dev", "hobby", "mtg"]);
  });
});

describe("木の操作", () => {
  it("descendantIds は子孫をすべて返す", () => {
    expect([...descendantIds(tags, "work")].sort()).toEqual(["dev", "mtg", "review"]);
    expect(descendantIds(tags, "hobby").size).toBe(0);
  });
  it("formatTagPath はルートからのパス", () => {
    expect(formatTagPath(tags, "review")).toBe("仕事 > 開発 > レビュー");
    expect(formatTagPath(tags, "none")).toBe("");
  });
  it("flattenTagTree は深さ優先・兄弟は名前順", () => {
    expect(flattenTagTree(tags).map(({ tag, depth }) => `${depth}:${tag.name}`)).toEqual([
      "0:仕事",
      "1:会議",
      "1:開発",
      "2:レビュー",
      "0:趣味",
    ]);
  });
  it("壊れたデータ（循環・親なし）でも無限ループしない", () => {
    const broken: Tag[] = [
      { id: "a", name: "A", parentId: "b", color: c },
      { id: "b", name: "B", parentId: "a", color: c },
      { id: "o", name: "O", parentId: "missing", color: c },
    ];
    expect(formatTagPath(broken, "a")).toBe("B > A");
    expect(flattenTagTree(broken).map((x) => x.tag.id)).toEqual(["o"]);
    expect(descendantIds(broken, "a")).toEqual(new Set(["b"]));
  });
  it("normalizeTagIds は重複と不明なIDを除く", () => {
    expect(normalizeTagIds(tags, ["mtg", "none", "mtg", "work"])).toEqual(["mtg", "work"]);
  });
  it("parseTags は壊れた要素を捨てる", () => {
    expect(parseTags([tags[0], { id: 1 }, null])).toEqual([tags[0]]);
    expect(parseTags("x")).toEqual([]);
  });
});
