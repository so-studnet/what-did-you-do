import { type Tag, formatTagPath } from "@/lib/domain/tag";

/** タグをパス付きの小さなチップで表示する（文字は本文色、色は丸で示す） */
export function TagChips({
  tags,
  tagIds,
  onRemove,
}: {
  tags: readonly Tag[];
  tagIds: readonly string[];
  onRemove?: (id: string) => void;
}) {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const items = tagIds.flatMap((id) => {
    const tag = byId.get(id);
    return tag ? [{ tag, path: formatTagPath(tags, id) }] : [];
  });
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map(({ tag, path }) => (
        <li
          key={tag.id}
          className="flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
          <span>{path}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(tag.id)}
              aria-label={`タグ「${path}」を外す`}
              className="-mr-1 px-1"
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
