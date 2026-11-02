import { type Activity, parseActivities } from "./activity";
import { type Tag, deleteTag, parseTags } from "./tag";
import { type Template, parseTemplates } from "./template";

/** アプリの全データ */
export type AppData = {
  activities: Activity[];
  tags: Tag[];
  templates: Template[];
};

export const EMPTY_APP_DATA: AppData = Object.freeze({
  activities: [],
  tags: [],
  templates: [],
}) as AppData;

export function parseAppData(raw: unknown): AppData {
  if (typeof raw !== "object" || raw === null) return EMPTY_APP_DATA;
  const r = raw as Record<string, unknown>;
  return {
    activities: parseActivities(r.activities),
    tags: parseTags(r.tags),
    templates: parseTemplates(r.templates),
  };
}

/** タグを削除し、作業記録・テンプレートからも取り外す */
export function deleteTagEverywhere(data: AppData, tagId: string): AppData {
  const strip = <T extends { tagIds: string[] }>(x: T): T =>
    x.tagIds.includes(tagId) ? { ...x, tagIds: x.tagIds.filter((id) => id !== tagId) } : x;
  return {
    activities: data.activities.map(strip),
    tags: deleteTag(data.tags, tagId),
    templates: data.templates.map(strip),
  };
}
