import { type Tag, formatTagPath } from "@/lib/domain/tag";

/** タグをパス付きの小さなチップで表示する */
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
          className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
          style={{ borderColor: tag.color, color: tag.color }}
        >
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
