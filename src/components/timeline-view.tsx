"use client";

import { useEffect, useRef, useState } from "react";
import { type Activity, toTimed } from "@/lib/domain/activity";
import { periodRange } from "@/lib/domain/period";
import { overrunMs } from "@/lib/domain/time";
import { layoutTimeline } from "@/lib/domain/timeline";
import { useAppData } from "@/lib/hooks/use-app-data";
import { useNow } from "@/lib/hooks/use-now";
import { formatClock, formatDay, formatHm } from "@/lib/format";
import { EditDialog } from "./edit-dialog";
import { PeriodNav } from "./period-nav";

const HOUR_PX = 56;
const DAY_MS = 24 * 3600_000;
const NEUTRAL = "#64748b";

export function TimelineView() {
  const { data, actions } = useAppData();
  const { activities, tags } = data;
  const now = useNow();
  const [dayOffset, setDayOffset] = useState(0);
  const [editing, setEditing] = useState<Activity | null>(null);
  const scrollTarget = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  const range = now ? periodRange("day", now, dayOffset) : null;
  const items = range && now ? layoutTimeline(activities, range, now) : [];
  const tagById = new Map(tags.map((t) => [t.id, t]));

  // 初回表示時、今の時刻（過去の日なら最初の作業）の少し上までスクロールする
  const firstStart = items[0]?.start.getTime();
  useEffect(() => {
    if (scrolled.current || !range || !now) return;
    const el = scrollTarget.current;
    if (!el) return;
    scrolled.current = true;
    const focus = dayOffset === 0 ? now.getTime() : (firstStart ?? range.start.getTime() + 8 * 3600_000);
    const y = ((focus - range.start.getTime()) / 3600_000 - 1) * HOUR_PX;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY + y - 80) });
  }, [range, now, dayOffset, firstStart]);

  const toPx = (d: Date) => ((d.getTime() - (range?.start.getTime() ?? 0)) / 3600_000) * HOUR_PX;
  const totalCovered = items.reduce((s, i) => s + (i.end.getTime() - i.start.getTime()), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{range ? `記録 ${items.length}件・${formatHm(totalCovered)}` : ""}</p>
        <PeriodNav
          label={range ? (dayOffset === 0 ? `今日 ${formatDay(range.start)}` : formatDay(range.start)) : ""}
          offset={dayOffset}
          onChange={(o) => {
            scrolled.current = false;
            setDayOffset(o);
          }}
          prevLabel="前の日"
          nextLabel="次の日"
        />
      </div>

      <div ref={scrollTarget} className="relative" style={{ height: 24 * HOUR_PX }}>
        {/* 時刻の目盛り */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="absolute inset-x-0 flex border-t border-zinc-200 dark:border-zinc-800"
            style={{ top: h * HOUR_PX }}
          >
            <span className="-mt-2 w-10 bg-background pr-1 text-right text-xs tabular-nums text-zinc-500">
              {h}:00
            </span>
          </div>
        ))}

        {/* 作業 */}
        <ol className="absolute inset-y-0 right-0 left-11" aria-label="この日の作業">
          {items.map((item) => {
            const { activity } = item;
            const color = tagById.get(activity.tagIds.find((id) => tagById.has(id)) ?? "")?.color ?? NEUTRAL;
            const top = toPx(item.start);
            const height = Math.max(2, toPx(item.end) - top);
            const running = activity.endedAt === null;
            const over = now ? overrunMs(toTimed(activity), now) > 0 : false;
            const widthPct = 100 / item.laneCount;
            const label = `${activity.title} ${formatClock(activity.startedAt)}〜${
              running ? "実行中" : formatClock(activity.endedAt!)
            }`;
            return (
              <li
                key={activity.id}
                className="absolute"
                style={{ top, height, left: `${item.lane * widthPct}%`, width: `${widthPct}%` }}
              >
                <button
                  type="button"
                  onClick={() => setEditing(activity)}
                  aria-label={`${label}（編集）`}
                  title={label}
                  className="absolute inset-0 mr-0.5 overflow-hidden rounded-md border-l-4 px-1.5 text-left text-xs text-zinc-900 dark:text-zinc-100"
                  style={{
                    borderLeftColor: color,
                    backgroundColor: `${color}2e`,
                    ...(running ? { borderBottom: `2px dashed ${color}` } : {}),
                  }}
                >
                  {height >= 18 && (
                    <span className="block truncate font-bold leading-[18px]">
                      {over && <span className="mr-1 text-red-600 dark:text-red-400">超過</span>}
                      {activity.title}
                    </span>
                  )}
                  {height >= 34 && (
                    <span className="block truncate text-[11px] text-zinc-600 dark:text-zinc-400">
                      {formatClock(activity.startedAt)}〜{running ? "実行中" : formatClock(activity.endedAt!)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        {/* 現在時刻 */}
        {now && dayOffset === 0 && range && (
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 left-9 border-t-2 border-red-500"
            style={{ top: ((now.getTime() - range.start.getTime()) / DAY_MS) * 24 * HOUR_PX }}
          >
            <span className="absolute -top-1.5 -left-1.5 size-2.5 rounded-full bg-red-500" />
          </div>
        )}
      </div>

      {editing && (
        <EditDialog
          key={editing.id}
          target={{ kind: "edit", activity: editing }}
          tags={tags}
          onClose={() => setEditing(null)}
          onSave={(draft) => actions.updateActivity(editing.id, draft)}
          onDelete={() => actions.deleteActivity(editing.id)}
          onSaveAsTemplate={actions.createTemplate}
        />
      )}
    </div>
  );
}
