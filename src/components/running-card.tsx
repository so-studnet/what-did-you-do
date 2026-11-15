"use client";

import { type Activity, canExtend, toTimed } from "@/lib/domain/activity";
import type { Tag } from "@/lib/domain/tag";
import { elapsedMs, formatDuration, overrunMs } from "@/lib/domain/time";
import { formatClock, formatMinutes } from "@/lib/format";
import { TagChips } from "./tag-chips";

export function RunningCard({
  activity,
  tags,
  now,
  onStop,
  onStopAtPlanned,
  onExtend,
  onEdit,
}: {
  activity: Activity;
  tags: readonly Tag[];
  now: Date | null;
  onStop: (id: string) => void;
  /** 予定時刻で終了したことにする */
  onStopAtPlanned: (id: string) => void;
  /** 予定を今から minutes 分後まで延ばす */
  onExtend: (id: string, minutes: number) => void;
  onEdit: (activity: Activity) => void;
}) {
  const timed = toTimed(activity);
  const elapsed = now ? elapsedMs(timed, now) : 0;
  const overrun = now ? overrunMs(timed, now) : 0;
  const isOver = overrun > 0;
  const plannedMs = activity.plannedMin === null ? null : activity.plannedMin * 60_000;
  const progress = plannedMs === null ? null : Math.min(1, elapsed / plannedMs);
  const plannedEnd =
    activity.plannedMin === null
      ? null
      : new Date(Date.parse(activity.startedAt) + activity.plannedMin * 60_000).toISOString();

  return (
    <li
      className={`flex flex-col gap-2 rounded-2xl border p-4 ${
        isOver
          ? "border-red-500 bg-red-50 dark:bg-red-950/40"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{activity.title}</p>
          <p className="text-xs text-zinc-500">
            {formatClock(activity.startedAt)} 開始
            {activity.plannedMin !== null && ` ・ 予定 ${formatMinutes(activity.plannedMin)}`}
          </p>
          <div className="mt-1">
            <TagChips tags={tags} tagIds={activity.tagIds} />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onEdit(activity)}
            aria-label={`「${activity.title}」を編集`}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            編集
          </button>
          <button
            type="button"
            onClick={() => onStop(activity.id)}
            aria-label={`「${activity.title}」を終了`}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white active:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            終了
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-3xl tabular-nums" aria-label="経過時間">
          {now ? formatDuration(elapsed) : "-:--:--"}
        </span>
        {isOver && (
          <span className="font-mono text-sm font-bold text-red-600 tabular-nums">
            +{formatDuration(overrun)} 超過
          </span>
        )}
      </div>

      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className={`h-full ${isOver ? "bg-red-500" : "bg-blue-600"}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {isOver && now && plannedEnd && (
        <div className="flex flex-col gap-2 border-t border-red-200 pt-3 dark:border-red-900">
          <p className="text-sm font-bold text-red-700 dark:text-red-300">終了し忘れていませんか？</p>
          <div className="flex flex-wrap gap-2">
            {EXTEND_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onExtend(activity.id, m)}
                disabled={!canExtend(activity, now, m)}
                aria-label={`「${activity.title}」をあと${m}分続ける`}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
              >
                あと{m}分
              </button>
            ))}
            <button
              type="button"
              onClick={() => onStopAtPlanned(activity.id)}
              aria-label={`「${activity.title}」を予定時刻で終了`}
              className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300"
            >
              予定時刻（{formatClock(plannedEnd)}）で終了
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** 超過中に予定を延ばすときの選択肢（今から何分後まで続けるか） */
const EXTEND_OPTIONS = [15, 30] as const;
