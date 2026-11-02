import type { Activity } from "@/lib/domain/activity";
import type { AppData } from "@/lib/domain/app-data";
import type { Tag } from "@/lib/domain/tag";
import type { Template } from "@/lib/domain/template";

// DB の行（Supabase の public スキーマ）。user_id はDB側で auth.uid() が入るので送らない。

export type TagRow = { id: string; name: string; parent_id: string | null; color: string };
export type ActivityRow = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  planned_min: number | null;
  tag_ids: string[];
};
export type TemplateRow = {
  id: string;
  title: string;
  planned_min: number | null;
  tag_ids: string[];
  sort_order: number;
};

export const tagToRow = (t: Tag): TagRow => ({ id: t.id, name: t.name, parent_id: t.parentId, color: t.color });
export const rowToTag = (r: TagRow): Tag => ({ id: r.id, name: r.name, parentId: r.parent_id, color: r.color });

export const activityToRow = (a: Activity): ActivityRow => ({
  id: a.id,
  title: a.title,
  started_at: a.startedAt,
  ended_at: a.endedAt,
  planned_min: a.plannedMin,
  tag_ids: a.tagIds,
});
/** DB は "+00:00" 形式で返すので、アプリの形式（toISOString）にそろえる */
export const rowToActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  title: r.title,
  startedAt: new Date(r.started_at).toISOString(),
  endedAt: r.ended_at === null ? null : new Date(r.ended_at).toISOString(),
  plannedMin: r.planned_min,
  tagIds: r.tag_ids ?? [],
});

export const templateToRow = (t: Template, index: number): TemplateRow => ({
  id: t.id,
  title: t.title,
  planned_min: t.plannedMin,
  tag_ids: t.tagIds,
  sort_order: index,
});
export const rowsToTemplates = (rows: readonly TemplateRow[]): Template[] =>
  [...rows]
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .map((r) => ({ id: r.id, title: r.title, plannedMin: r.planned_min, tagIds: r.tag_ids ?? [] }));

export type RowDiff<R> = { upserts: R[]; deletes: string[] };

/** id ごとに比べ、追加・変更された行と削除された id を返す */
export function diffRows<R extends { id: string }>(prev: readonly R[], next: readonly R[]): RowDiff<R> {
  const before = new Map(prev.map((r) => [r.id, JSON.stringify(r)]));
  const after = new Set(next.map((r) => r.id));
  return {
    upserts: next.filter((r) => before.get(r.id) !== JSON.stringify(r)),
    deletes: prev.filter((r) => !after.has(r.id)).map((r) => r.id),
  };
}

export type AppDataDiff = {
  tags: RowDiff<TagRow>;
  activities: RowDiff<ActivityRow>;
  templates: RowDiff<TemplateRow>;
};

export function diffAppData(prev: AppData, next: AppData): AppDataDiff {
  return {
    tags: diffRows(prev.tags.map(tagToRow), next.tags.map(tagToRow)),
    activities: diffRows(prev.activities.map(activityToRow), next.activities.map(activityToRow)),
    templates: diffRows(prev.templates.map(templateToRow), next.templates.map(templateToRow)),
  };
}

export function isEmptyDiff(d: AppDataDiff): boolean {
  return [d.tags, d.activities, d.templates].every((x) => x.upserts.length === 0 && x.deletes.length === 0);
}

export function isEmptyData(d: AppData): boolean {
  return d.activities.length === 0 && d.tags.length === 0 && d.templates.length === 0;
}

/** このブラウザのデータをサーバーのデータに取り込む。同じ id はサーバー側を優先する。 */
export function mergeAppData(server: AppData, local: AppData): AppData {
  const add = <T extends { id: string }>(base: readonly T[], extra: readonly T[]) => {
    const ids = new Set(base.map((x) => x.id));
    return [...base, ...extra.filter((x) => !ids.has(x.id))];
  };
  return {
    activities: add(server.activities, local.activities),
    tags: add(server.tags, local.tags),
    templates: add(server.templates, local.templates),
  };
}
