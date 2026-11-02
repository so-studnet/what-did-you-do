import { type Activity, type StartInput, validateStartInput } from "./activity";

/** 作業のテンプレート。並び順は配列の順。 */
export type Template = {
  id: string;
  title: string;
  plannedMin: number | null;
  tagIds: string[];
};

export function createTemplate(templates: readonly Template[], input: StartInput, id: string): Template[] {
  const r = validateStartInput(input);
  if (!r.ok) throw new Error(r.error);
  return [...templates, { id, ...r.value }];
}

export function updateTemplate(templates: readonly Template[], id: string, input: StartInput): Template[] {
  if (!templates.some((t) => t.id === id)) throw new Error("テンプレートが見つかりません");
  const r = validateStartInput(input);
  if (!r.ok) throw new Error(r.error);
  return templates.map((t) => (t.id === id ? { id, ...r.value } : t));
}

export function deleteTemplate(templates: readonly Template[], id: string): Template[] {
  return templates.filter((t) => t.id !== id);
}

/** 並び順を delta だけ動かす（-1 = 1つ上へ）。端を越える場合は端で止める。 */
export function moveTemplate(templates: readonly Template[], id: string, delta: number): Template[] {
  const from = templates.findIndex((t) => t.id === id);
  if (from === -1) return [...templates];
  const to = Math.max(0, Math.min(templates.length - 1, from + delta));
  const next = [...templates];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** テンプレートから開始するときの入力 */
export function templateToStartInput(t: Template): StartInput {
  return { title: t.title, plannedMin: t.plannedMin, tagIds: [...t.tagIds] };
}

/** 記録からテンプレートの入力を作る */
export function activityToTemplateInput(a: Activity): StartInput {
  return { title: a.title, plannedMin: a.plannedMin, tagIds: [...a.tagIds] };
}

export function parseTemplates(raw: unknown): Template[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .filter(
      (t) =>
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        (t.plannedMin === null || typeof t.plannedMin === "number"),
    )
    .map((t) => ({
      id: t.id as string,
      title: t.title as string,
      plannedMin: t.plannedMin as number | null,
      tagIds: Array.isArray(t.tagIds) ? t.tagIds.filter((x): x is string => typeof x === "string") : [],
    }));
}
