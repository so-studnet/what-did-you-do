"use client";

import { endedOnSameDay, runningActivities } from "@/lib/domain/activity";
import { useActivities } from "@/lib/hooks/use-activities";
import { useNow } from "@/lib/hooks/use-now";
import { EndedList } from "./ended-list";
import { RunningCard } from "./running-card";
import { StartForm } from "./start-form";

export function Dashboard() {
  const { activities, start, stop } = useActivities();
  const now = useNow();
  const running = runningActivities(activities);
  const endedToday = now ? endedOnSameDay(activities, now) : [];

  return (
    <div className="flex flex-col gap-6">
      <StartForm onStart={start} />

      <section aria-labelledby="running-heading" className="flex flex-col gap-3">
        <h2 id="running-heading" className="text-sm font-bold text-zinc-500">
          実行中 {running.length > 0 && `(${running.length})`}
        </h2>
        {running.length === 0 ? (
          <p className="text-sm text-zinc-500">実行中の作業はありません</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {running.map((a) => (
              <RunningCard key={a.id} activity={a} now={now} onStop={stop} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ended-heading" className="flex flex-col gap-2">
        <h2 id="ended-heading" className="text-sm font-bold text-zinc-500">
          今日終了した作業
        </h2>
        <EndedList activities={endedToday} />
      </section>
    </div>
  );
}
