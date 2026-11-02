"use client";

import { useCallback, useSyncExternalStore } from "react";
import { type StartInput, startActivity, stopActivity } from "@/lib/domain/activity";
import { activityStore } from "@/lib/store/activity-store";
import { newId } from "@/lib/id";

export function useActivities() {
  const activities = useSyncExternalStore(
    activityStore.subscribe,
    activityStore.getSnapshot,
    activityStore.getServerSnapshot,
  );

  const start = useCallback((input: StartInput) => {
    activityStore.update((prev) => startActivity(prev, input, new Date(), newId()));
  }, []);

  const stop = useCallback((id: string) => {
    activityStore.update((prev) => stopActivity(prev, id, new Date()));
  }, []);

  return { activities, start, stop };
}
