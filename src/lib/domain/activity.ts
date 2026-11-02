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
};

export type StartInput = {
  title: string;
  plannedMin: number | null;
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
  return { ok: true, value: { title, plannedMin } };
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

/** 保存データを読み込む。壊れた要素は捨てる。 */
export function parseActivities(raw: unknown): Activity[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isActivity);
}

function isActivity(v: unknown): v is Activity {
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
