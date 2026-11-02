"use client";

import { useEffect } from "react";
import { dueActivities, notificationKey, pruneNotified } from "@/lib/domain/notification";
import { useAppData } from "@/lib/hooks/use-app-data";
import { useNow } from "@/lib/hooks/use-now";
import { getNotificationStatus, loadNotified, saveNotified, showDueNotification } from "@/lib/notify";

/** Service Worker を登録する */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/**
 * 実行中の作業が予定時間に達したら通知する。どの画面を開いていても動く。
 * アプリ（ブラウザ）が動いている間だけ有効。
 */
export function DueNotifier() {
  const { data } = useAppData();
  const now = useNow();

  useEffect(() => {
    if (!now || getNotificationStatus() !== "granted") return;
    const notified = pruneNotified(data.activities, loadNotified());
    const due = dueActivities(data.activities, now, notified);
    if (due.length === 0) {
      saveNotified(notified);
      return;
    }
    for (const a of due) notified.add(notificationKey(a)!);
    saveNotified(notified);
    for (const a of due) void showDueNotification(a, now).catch(() => {});
  }, [now, data.activities]);

  return null;
}
