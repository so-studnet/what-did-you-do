"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  type ActivityDraft,
  type StartInput,
  addActivity,
  deleteActivity,
  startActivity,
  stopActivity,
  updateActivity,
} from "@/lib/domain/activity";
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

  const update = useCallback((id: string, draft: ActivityDraft) => {
    activityStore.update((prev) => updateActivity(prev, id, draft, new Date()));
  }, []);

  const add = useCallback((draft: ActivityDraft) => {
    activityStore.update((prev) => addActivity(prev, draft, new Date(), newId()));
  }, []);

  const remove = useCallback((id: string) => {
    activityStore.update((prev) => deleteActivity(prev, id));
  }, []);

  return { activities, start, stop, update, add, remove };
}
