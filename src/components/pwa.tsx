"use client";

import { useEffect, useSyncExternalStore } from "react";
import { dueActivities, notificationKey, pruneNotified } from "@/lib/domain/notification";
import { useAppData } from "@/lib/hooks/use-app-data";
import { useNow } from "@/lib/hooks/use-now";
import {
  getNotificationStatus,
  loadNotified,
  saveNotified,
  showDueNotification,
  subscribeNotificationStatus,
} from "@/lib/notify";
import { ensurePushSubscription } from "@/lib/push-subscription";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "./auth-gate";

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

/**
 * ログイン中で通知が許可されていれば、この端末を Web Push の宛先として登録する。
 * アプリを閉じていても、サーバーから予定時間の通知が届くようになる。
 */
export function PushSubscriptionSync() {
  const auth = useAuth();
  const permission = useSyncExternalStore(subscribeNotificationStatus, getNotificationStatus, () => "unknown" as const);
  const userId = auth.status === "signed-in" ? auth.userId : null;

  useEffect(() => {
    if (!userId || permission !== "granted") return;
    ensurePushSubscription(getSupabase()).catch((e) => console.error("通知の宛先の登録に失敗しました", e));
  }, [userId, permission]);

  return null;
}
