"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  type ActivityDraft,
  type StartInput,
  addActivity,
  deleteActivity,
  startActivity,
  stopActivity,
  updateActivity,
} from "@/lib/domain/activity";
import { type AppData, deleteTagEverywhere } from "@/lib/domain/app-data";
import { type TagInput, createTag, normalizeTagIds, updateTag } from "@/lib/domain/tag";
import { createTemplate, deleteTemplate, moveTemplate, updateTemplate } from "@/lib/domain/template";
import { newId } from "@/lib/id";
import { appStore } from "@/lib/store/app-store";

/** 存在しないタグを入力から取り除く */
function withKnownTags<T extends { tagIds: string[] }>(data: AppData, input: T): T {
  return { ...input, tagIds: normalizeTagIds(data.tags, input.tagIds) };
}

const actions = {
  // 作業記録
  start: (input: StartInput) =>
    appStore.update((d) => ({
      ...d,
      activities: startActivity(d.activities, withKnownTags(d, input), new Date(), newId()),
    })),
  stop: (id: string) =>
    appStore.update((d) => ({ ...d, activities: stopActivity(d.activities, id, new Date()) })),
  updateActivity: (id: string, draft: ActivityDraft) =>
    appStore.update((d) => ({
      ...d,
      activities: updateActivity(d.activities, id, withKnownTags(d, draft), new Date()),
    })),
  addActivity: (draft: ActivityDraft) =>
    appStore.update((d) => ({
      ...d,
      activities: addActivity(d.activities, withKnownTags(d, draft), new Date(), newId()),
    })),
  deleteActivity: (id: string) =>
    appStore.update((d) => ({ ...d, activities: deleteActivity(d.activities, id) })),

  // タグ
  createTag: (input: TagInput) => {
    const id = newId();
    appStore.update((d) => ({ ...d, tags: createTag(d.tags, input, id) }));
    return id;
  },
  updateTag: (id: string, input: TagInput) =>
    appStore.update((d) => ({ ...d, tags: updateTag(d.tags, id, input) })),
  deleteTag: (id: string) => appStore.update((d) => deleteTagEverywhere(d, id)),

  // テンプレート
  createTemplate: (input: StartInput) =>
    appStore.update((d) => ({
      ...d,
      templates: createTemplate(d.templates, withKnownTags(d, input), newId()),
    })),
  updateTemplate: (id: string, input: StartInput) =>
    appStore.update((d) => ({
      ...d,
      templates: updateTemplate(d.templates, id, withKnownTags(d, input)),
    })),
  deleteTemplate: (id: string) =>
    appStore.update((d) => ({ ...d, templates: deleteTemplate(d.templates, id) })),
  moveTemplate: (id: string, delta: number) =>
    appStore.update((d) => ({ ...d, templates: moveTemplate(d.templates, id, delta) })),
};

export type AppActions = typeof actions;

export function useAppData() {
  const data = useSyncExternalStore(
    appStore.subscribe,
    appStore.getSnapshot,
    appStore.getServerSnapshot,
  );
  return useMemo(() => ({ data, actions }), [data]);
}
