import { type Activity, toTimed } from "@/lib/domain/activity";
import { elapsedMs, formatDuration, overrunMs } from "@/lib/domain/time";
import { formatClock } from "@/lib/format";

export function EndedList({
  activities,
  onEdit,
}: {
  activities: readonly Activity[];
  onEdit: (activity: Activity) => void;
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-zinc-500">この日に終了した作業はありません</p>;
  }
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {activities.map((a) => {
        const timed = toTimed(a);
        const end = timed.endedAt!;
        const elapsed = elapsedMs(timed, end);
        const overrun = overrunMs(timed, end);
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onEdit(a)}
              aria-label={`「${a.title}」を編集`}
              className="flex w-full items-center justify-between gap-3 py-2 text-left active:bg-zinc-100 dark:active:bg-zinc-800"
            >
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
            </button>
          </li>
        );
      })}
    </ul>
  );
}
