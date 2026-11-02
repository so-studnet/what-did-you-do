"use client";

import Link from "next/link";
import type { Tag } from "@/lib/domain/tag";
import type { Template } from "@/lib/domain/template";
import { formatMinutes } from "@/lib/format";

/** ホームに並ぶテンプレート。タップで即開始。 */
export function TemplateBar({
  templates,
  tags,
  onStart,
}: {
  templates: readonly Template[];
  tags: readonly Tag[];
  onStart: (template: Template) => void;
}) {
  const colorOf = (t: Template) => tags.find((tag) => tag.id === t.tagIds[0])?.color;

  return (
    <section aria-labelledby="templates-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="templates-heading" className="text-sm font-bold text-zinc-500">
          テンプレートから開始
        </h2>
        <Link href="/templates" className="text-xs text-blue-600">
          管理
        </Link>
      </div>
      {templates.length === 0 ? (
        <p className="text-sm text-zinc-500">
          よく使う作業を
          <Link href="/templates" className="text-blue-600 underline">
            テンプレート
          </Link>
          にすると、ここからワンタップで開始できます
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onStart(t)}
                aria-label={`テンプレート「${t.title}」で開始`}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3 py-2 text-sm active:bg-zinc-100 dark:border-zinc-700 dark:active:bg-zinc-800"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full bg-zinc-300"
                  style={colorOf(t) ? { backgroundColor: colorOf(t) } : undefined}
                />
                <span>{t.title}</span>
                {t.plannedMin !== null && (
                  <span className="text-xs text-zinc-500">{formatMinutes(t.plannedMin)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
