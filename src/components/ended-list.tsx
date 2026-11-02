import { type Activity, toTimed } from "@/lib/domain/activity";
import { elapsedMs, formatDuration, overrunMs } from "@/lib/domain/time";
import { formatClock } from "@/lib/format";

export function EndedList({ activities }: { activities: readonly Activity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-zinc-500">今日終了した作業はまだありません</p>;
  }
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {activities.map((a) => {
        const timed = toTimed(a);
        // 終了済みなので now は使われない
        const elapsed = elapsedMs(timed, timed.endedAt!);
        const overrun = overrunMs(timed, timed.endedAt!);
        return (
          <li key={a.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate">{a.title}</p>
              <p className="text-xs text-zinc-500">
                {formatClock(a.startedAt)} – {formatClock(a.endedAt!)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono tabular-nums">{formatDuration(elapsed)}</p>
              {overrun > 0 && (
                <p className="font-mono text-xs text-red-600 tabular-nums">
                  +{formatDuration(overrun)} 超過
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
