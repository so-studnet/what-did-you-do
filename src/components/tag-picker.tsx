"use client";

import Link from "next/link";
import { useState } from "react";
import { type Tag, flattenTagTree } from "@/lib/domain/tag";
import { TagChips } from "./tag-chips";

/** 階層タグを複数選ぶ */
export function TagPicker({
  tags,
  value,
  onChange,
}: {
  tags: readonly Tag[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);

  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <TagChips tags={tags} tagIds={value} onRemove={toggle} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="rounded-full border border-dashed border-zinc-400 px-3 py-1 text-zinc-600 dark:text-zinc-400"
        >
          {open ? "閉じる" : "＋ タグ"}
        </button>
      </div>
      {open &&
        (tags.length === 0 ? (
          <p className="text-zinc-500">
            タグがまだありません。
            <Link href="/tags" className="text-blue-600 underline">
              タグを作成
            </Link>
          </p>
        ) : (
          <ul className="max-h-60 overflow-y-auto rounded-xl border border-zinc-200 p-1 dark:border-zinc-800">
            {flattenTagTree(tags).map(({ tag, depth }) => (
              <li key={tag.id}>
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-2 active:bg-zinc-100 dark:active:bg-zinc-800"
                  style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(tag.id)}
                    onChange={() => toggle(tag.id)}
                    className="size-4"
                  />
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span>{tag.name}</span>
                </label>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
