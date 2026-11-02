"use client";

import { type Activity, toTimed } from "@/lib/domain/activity";
import { elapsedMs, formatDuration, overrunMs } from "@/lib/domain/time";
import { formatClock, formatMinutes } from "@/lib/format";

export function RunningCard({
  activity,
  now,
  onStop,
}: {
  activity: Activity;
  now: Date | null;
  onStop: (id: string) => void;
}) {
  const timed = toTimed(activity);
  const elapsed = now ? elapsedMs(timed, now) : 0;
  const overrun = now ? overrunMs(timed, now) : 0;
  const isOver = overrun > 0;
  const plannedMs = activity.plannedMin === null ? null : activity.plannedMin * 60_000;
  const progress = plannedMs === null ? null : Math.min(1, elapsed / plannedMs);

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
        </div>
        <button
          type="button"
          onClick={() => onStop(activity.id)}
          aria-label={`「${activity.title}」を終了`}
          className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white active:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          終了
        </button>
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
    </li>
  );
}
