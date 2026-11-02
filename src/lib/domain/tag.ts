/** 階層タグ */
export type Tag = {
  id: string;
  name: string;
  /** null = ルート */
  parentId: string | null;
  color: string;
};

export type TagInput = {
  name: string;
  parentId: string | null;
  color: string;
};

export const MAX_TAG_NAME_LENGTH = 30;

/** 選べるタグの色 */
export const TAG_COLORS = [
  "#2563eb", // 青
  "#16a34a", // 緑
  "#dc2626", // 赤
  "#ea580c", // 橙
  "#ca8a04", // 黄
  "#9333ea", // 紫
  "#db2777", // 桃
  "#0891b2", // 水
  "#64748b", // 灰
] as const;

export type TagValidationResult = { ok: true; value: TagInput } | { ok: false; error: string };

/**
 * タグの入力を検証する。
 * selfId: 既存タグの編集時に指定（自分自身・子孫を親にできないことの確認に使う）
 */
export function validateTagInput(
  tags: readonly Tag[],
  input: TagInput,
  selfId?: string,
): TagValidationResult {
  const name = input.name.trim();
  if (name === "") return { ok: false, error: "タグ名を入力してください" };
  if (name.includes(">")) return { ok: false, error: "タグ名に「>」は使えません" };
  if (name.length > MAX_TAG_NAME_LENGTH) {
    return { ok: false, error: `タグ名は${MAX_TAG_NAME_LENGTH}文字以内にしてください` };
  }
  const { parentId } = input;
  if (parentId !== null) {
    if (!tags.some((t) => t.id === parentId)) return { ok: false, error: "親タグが見つかりません" };
    if (selfId !== undefined && (parentId === selfId || descendantIds(tags, selfId).has(parentId))) {
      return { ok: false, error: "自分自身や子孫のタグを親にはできません" };
    }
  }
  const duplicate = tags.some(
    (t) => t.id !== selfId && t.parentId === parentId && t.name === name,
  );
  if (duplicate) return { ok: false, error: "同じ階層に同じ名前のタグがあります" };
  return { ok: true, value: { ...input, name } };
}

export function createTag(tags: readonly Tag[], input: TagInput, id: string): Tag[] {
  const r = validateTagInput(tags, input);
  if (!r.ok) throw new Error(r.error);
  return [...tags, { id, ...r.value }];
}

export function updateTag(tags: readonly Tag[], id: string, input: TagInput): Tag[] {
  if (!tags.some((t) => t.id === id)) throw new Error("タグが見つかりません");
  const r = validateTagInput(tags, input, id);
  if (!r.ok) throw new Error(r.error);
  return tags.map((t) => (t.id === id ? { id, ...r.value } : t));
}

/**
 * タグを削除する。子タグは削除したタグの親に付け替える（子は消さない）。
 * 作業記録・テンプレートからのタグの取り外しは app-data 側で行う。
 */
export function deleteTag(tags: readonly Tag[], id: string): Tag[] {
  const target = tags.find((t) => t.id === id);
  if (!target) return [...tags];
  return tags
    .filter((t) => t.id !== id)
    .map((t) => (t.parentId === id ? { ...t, parentId: target.parentId } : t));
}

/** 子孫タグのID（自分は含まない） */
export function descendantIds(tags: readonly Tag[], id: string): Set<string> {
  const result = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const t of tags) {
      if (t.parentId === current && !result.has(t.id) && t.id !== id) {
        result.add(t.id);
        stack.push(t.id);
      }
    }
  }
  return result;
}

/** ルートから自分までの名前の列（例: ["仕事", "会議"]） */
export function tagPath(tags: readonly Tag[], id: string): string[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.name);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return path;
}

export function formatTagPath(tags: readonly Tag[], id: string): string {
  return tagPath(tags, id).join(" > ");
}

/** 木を深さ優先でたどった順に、深さ付きで並べる。兄弟は名前順。親が見つからないタグはルート扱い。 */
export function flattenTagTree(tags: readonly Tag[]): { tag: Tag; depth: number }[] {
  const ids = new Set(tags.map((t) => t.id));
  const childrenOf = new Map<string | null, Tag[]>();
  for (const t of tags) {
    const key = t.parentId !== null && ids.has(t.parentId) ? t.parentId : null;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), t]);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const result: { tag: Tag; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const t of childrenOf.get(parentId) ?? []) {
      result.push({ tag: t, depth });
      visit(t.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

/** 重複と存在しないタグを取り除く */
export function normalizeTagIds(tags: readonly Tag[], ids: readonly string[]): string[] {
  const known = new Set(tags.map((t) => t.id));
  return [...new Set(ids)].filter((id) => known.has(id));
}

export function parseTags(raw: unknown): Tag[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is Tag => {
    if (typeof v !== "object" || v === null) return false;
    const t = v as Record<string, unknown>;
    return (
      typeof t.id === "string" &&
      typeof t.name === "string" &&
      (t.parentId === null || typeof t.parentId === "string") &&
      typeof t.color === "string"
    );
  });
}
