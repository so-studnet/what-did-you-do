"use client";

import { useState } from "react";
import { endedOnSameDay, runningActivities } from "@/lib/domain/activity";
import { addDays, startOfLocalDay, truncateToMinute } from "@/lib/domain/datetime-local";
import { templateToStartInput } from "@/lib/domain/template";
import { useAppData } from "@/lib/hooks/use-app-data";
import { useNow } from "@/lib/hooks/use-now";
import { formatDay } from "@/lib/format";
import { PeriodNav } from "./period-nav";
import { EditDialog, type EditTarget } from "./edit-dialog";
import { EndedList } from "./ended-list";
import { RunningCard } from "./running-card";
import { StartForm } from "./start-form";
import { TemplateBar } from "./template-bar";

export function Dashboard() {
  const { data, actions } = useAppData();
  const { activities, tags, templates } = data;
  const now = useNow();
  // 0 = 今日、-1 = 昨日 …（日付をまたいでも「今日」が追従するように日数の差で持つ）
  const [dayOffset, setDayOffset] = useState(0);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const running = runningActivities(activities);
  const day = now ? addDays(startOfLocalDay(now), dayOffset) : null;
  const endedOnDay = day ? endedOnSameDay(activities, day) : [];

  const openAdd = () => {
    if (!now || !day) return;
    // 今日なら「直前の30分」、過去の日なら「その日の12:00〜12:30」を初期値にする
    const end = dayOffset === 0 ? truncateToMinute(now) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 30);
    setEditTarget({ kind: "add", startedAt: new Date(end.getTime() - 30 * 60_000), endedAt: end });
  };

  return (
    <div className="flex flex-col gap-6">
      <TemplateBar
        templates={templates}
        tags={tags}
        onStart={(t) => actions.start(templateToStartInput(t))}
      />

      <StartForm tags={tags} onStart={actions.start} />

      <section aria-labelledby="running-heading" className="flex flex-col gap-3">
        <h2 id="running-heading" className="text-sm font-bold text-zinc-500">
          実行中 {running.length > 0 && `(${running.length})`}
        </h2>
        {running.length === 0 ? (
          <p className="text-sm text-zinc-500">実行中の作業はありません</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {running.map((a) => (
              <RunningCard
                key={a.id}
                activity={a}
                tags={tags}
                now={now}
                onStop={actions.stop}
                onEdit={(activity) => setEditTarget({ kind: "edit", activity })}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ended-heading" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="ended-heading" className="text-sm font-bold text-zinc-500">
            終了した作業
          </h2>
          <PeriodNav
            label={day ? (dayOffset === 0 ? `今日 ${formatDay(day)}` : formatDay(day)) : ""}
            offset={dayOffset}
            onChange={setDayOffset}
            prevLabel="前の日"
            nextLabel="次の日"
          />
        </div>
        <EndedList
          activities={endedOnDay}
          tags={tags}
          onEdit={(activity) => setEditTarget({ kind: "edit", activity })}
        />
        <button
          type="button"
          onClick={openAdd}
          className="self-start rounded-xl border border-dashed border-zinc-400 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400"
        >
          ＋ 記録を追加
        </button>
      </section>

      {editTarget && (
        <EditDialog
          key={editTarget.kind === "edit" ? editTarget.activity.id : "add"}
          target={editTarget}
          tags={tags}
          onClose={() => setEditTarget(null)}
          onSave={(draft) =>
            editTarget.kind === "edit"
              ? actions.updateActivity(editTarget.activity.id, draft)
              : actions.addActivity(draft)
          }
          onDelete={
            editTarget.kind === "edit" ? () => actions.deleteActivity(editTarget.activity.id) : undefined
          }
          onSaveAsTemplate={editTarget.kind === "edit" ? actions.createTemplate : undefined}
        />
      )}
    </div>
  );
}
