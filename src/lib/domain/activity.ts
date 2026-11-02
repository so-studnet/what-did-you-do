import type { TimedActivity } from "./time";

/** 作業記録（保存形式）。日時は ISO 8601 (UTC) 文字列で持つ。 */
export type Activity = {
  id: string;
  title: string;
  startedAt: string;
  /** null = 実行中 */
  endedAt: string | null;
  /** null = 無制限 */
  plannedMin: number | null;
  tagIds: string[];
};

export type StartInput = {
  title: string;
  plannedMin: number | null;
  tagIds: string[];
};

export const MAX_TITLE_LENGTH = 100;
export const MAX_PLANNED_MIN = 24 * 60;

export type ValidationResult =
  | { ok: true; value: StartInput }
  | { ok: false; error: string };

/** 開始フォームの入力を検証・正規化する */
export function validateStartInput(input: StartInput): ValidationResult {
  const title = input.title.trim();
  if (title === "") return { ok: false, error: "作業内容を入力してください" };
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `作業内容は${MAX_TITLE_LENGTH}文字以内にしてください` };
  }
  const { plannedMin } = input;
  if (plannedMin != null) {
    if (!Number.isInteger(plannedMin) || plannedMin < 1 || plannedMin > MAX_PLANNED_MIN) {
      return { ok: false, error: `予定時間は1〜${MAX_PLANNED_MIN}分の整数で指定してください` };
    }
  }
  return { ok: true, value: { title, plannedMin, tagIds: [...new Set(input.tagIds)] } };
}

/** 新しい作業を開始した一覧を返す。既に実行中の作業はそのまま（並行実行）。 */
export function startActivity(
  activities: readonly Activity[],
  input: StartInput,
  now: Date,
  id: string,
): Activity[] {
  const result = validateStartInput(input);
  if (!result.ok) throw new Error(result.error);
  return [
    ...activities,
    {
      id,
      title: result.value.title,
      startedAt: now.toISOString(),
      endedAt: null,
      plannedMin: result.value.plannedMin,
      tagIds: result.value.tagIds,
    },
  ];
}

/** 指定した作業を終了した一覧を返す。存在しない・終了済みなら何もしない。 */
export function stopActivity(
  activities: readonly Activity[],
  id: string,
  now: Date,
): Activity[] {
  return activities.map((a) =>
    a.id === id && a.endedAt === null ? { ...a, endedAt: now.toISOString() } : a,
  );
}

/** 実行中の作業（開始が古い順） */
export function runningActivities(activities: readonly Activity[]): Activity[] {
  return activities
    .filter((a) => a.endedAt === null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** 指定時刻と同じ日（ローカル時刻）に終了した作業（終了が新しい順） */
export function endedOnSameDay(activities: readonly Activity[], day: Date): Activity[] {
  return activities
    .filter((a) => a.endedAt !== null && isSameLocalDay(new Date(a.endedAt), day))
    .sort((a, b) => b.endedAt!.localeCompare(a.endedAt!));
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 時間計算用の形に変換する */
export function toTimed(a: Activity): TimedActivity {
  return {
    startedAt: new Date(a.startedAt),
    endedAt: a.endedAt === null ? null : new Date(a.endedAt),
    plannedMin: a.plannedMin,
  };
}

/** 保存データを読み込む。壊れた要素は捨てる。tagIds がない古いデータは空のタグとして読む。 */
export function parseActivities(raw: unknown): Activity[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isActivityLike).map((a) => ({
    id: a.id,
    title: a.title,
    startedAt: a.startedAt,
    endedAt: a.endedAt,
    plannedMin: a.plannedMin,
    tagIds: Array.isArray(a.tagIds) ? a.tagIds.filter((x): x is string => typeof x === "string") : [],
  }));
}

function isActivityLike(v: unknown): v is Omit<Activity, "tagIds"> & { tagIds?: unknown[] } {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.title === "string" &&
    typeof a.startedAt === "string" &&
    !Number.isNaN(Date.parse(a.startedAt)) &&
    (a.endedAt === null ||
      (typeof a.endedAt === "string" && !Number.isNaN(Date.parse(a.endedAt)))) &&
    (a.plannedMin === null || typeof a.plannedMin === "number")
  );
}

/** 編集・手動追加フォームの入力 */
export type ActivityDraft = {
  title: string;
  startedAt: Date;
  /** null = 実行中のまま */
  endedAt: Date | null;
  plannedMin: number | null;
  tagIds: string[];
};

export type DraftValidationResult =
  | { ok: true; value: ActivityDraft }
  | { ok: false; error: string };

/**
 * 編集・手動追加の入力を検証する。
 * - requireEnd: 終了時刻を必須にする（終了済みの記録の編集、手動追加）
 */
export function validateDraft(
  draft: ActivityDraft,
  now: Date,
  { requireEnd }: { requireEnd: boolean },
): DraftValidationResult {
  const base = validateStartInput(draft);
  if (!base.ok) return base;
  const { startedAt, endedAt } = draft;
  if (Number.isNaN(startedAt.getTime())) return { ok: false, error: "開始時刻を入力してください" };
  if (startedAt.getTime() > now.getTime()) {
    return { ok: false, error: "開始時刻を未来にはできません" };
  }
  if (endedAt === null) {
    if (requireEnd) return { ok: false, error: "終了時刻を入力してください" };
  } else {
    if (Number.isNaN(endedAt.getTime())) return { ok: false, error: "終了時刻を入力してください" };
    if (endedAt.getTime() > now.getTime()) {
      return { ok: false, error: "終了時刻を未来にはできません" };
    }
    if (endedAt.getTime() < startedAt.getTime()) {
      return { ok: false, error: "終了時刻は開始時刻より後にしてください" };
    }
  }
  return { ok: true, value: { ...draft, title: base.value.title, tagIds: base.value.tagIds } };
}

/** 既存の記録を更新した一覧を返す。終了済みの記録を実行中に戻すことはできない。 */
export function updateActivity(
  activities: readonly Activity[],
  id: string,
  draft: ActivityDraft,
  now: Date,
): Activity[] {
  const target = activities.find((a) => a.id === id);
  if (!target) throw new Error("記録が見つかりません");
  const result = validateDraft(draft, now, { requireEnd: target.endedAt !== null });
  if (!result.ok) throw new Error(result.error);
  const v = result.value;
  return activities.map((a) =>
    a.id === id
      ? {
          ...a,
          title: v.title,
          startedAt: v.startedAt.toISOString(),
          endedAt: v.endedAt === null ? null : v.endedAt.toISOString(),
          plannedMin: v.plannedMin,
          tagIds: v.tagIds,
        }
      : a,
  );
}

/** 記録し忘れた作業を後から追加した一覧を返す（終了時刻は必須）。 */
export function addActivity(
  activities: readonly Activity[],
  draft: ActivityDraft,
  now: Date,
  id: string,
): Activity[] {
  const result = validateDraft(draft, now, { requireEnd: true });
  if (!result.ok) throw new Error(result.error);
  const v = result.value;
  return [
    ...activities,
    {
      id,
      title: v.title,
      startedAt: v.startedAt.toISOString(),
      endedAt: v.endedAt!.toISOString(),
      plannedMin: v.plannedMin,
      tagIds: v.tagIds,
    },
  ];
}

export function deleteActivity(activities: readonly Activity[], id: string): Activity[] {
  return activities.filter((a) => a.id !== id);
}
