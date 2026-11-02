// 通知まわりのブラウザ API のラッパー（クライアント専用）

import type { Activity } from "@/lib/domain/activity";
import { dueAt } from "@/lib/domain/notification";
import { dueNotificationTag } from "@/lib/domain/push";
import { formatClock, formatHm, formatMinutes } from "@/lib/format";

export type NotificationStatus =
  | "unknown" // サーバ描画中
  | "unsupported" // このブラウザでは使えない
  | "needs-install" // iPhone/iPad: ホーム画面に追加すれば使える
  | NotificationPermission; // "default" | "granted" | "denied"

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getNotificationStatus(): NotificationStatus {
  if (typeof window === "undefined") return "unknown";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  }
  return Notification.permission;
}

const PERMISSION_EVENT = "wdyd:notification-permission";

/** 通知の許可状態の変化を購読する */
export function subscribeNotificationStatus(onChange: () => void): () => void {
  window.addEventListener(PERMISSION_EVENT, onChange);
  let status: PermissionStatus | undefined;
  navigator.permissions
    ?.query({ name: "notifications" })
    .then((s) => {
      status = s;
      s.addEventListener("change", onChange);
    })
    .catch(() => {});
  return () => {
    window.removeEventListener(PERMISSION_EVENT, onChange);
    status?.removeEventListener("change", onChange);
  };
}

export async function requestNotificationPermission(): Promise<void> {
  if (!("Notification" in window)) return;
  await Notification.requestPermission();
  window.dispatchEvent(new Event(PERMISSION_EVENT));
}

/** 予定時間に達した作業の通知を出す */
export async function showDueNotification(activity: Activity, now: Date): Promise<void> {
  if (getNotificationStatus() !== "granted") return;
  const due = dueAt(activity);
  if (!due || activity.plannedMin === null) return;
  const overMs = now.getTime() - due.getTime();
  const body =
    overMs >= 60_000
      ? `予定の${formatMinutes(activity.plannedMin)}を${formatHm(overMs)}超過しています（${formatClock(activity.startedAt)}開始）`
      : `予定の${formatMinutes(activity.plannedMin)}になりました（${formatClock(activity.startedAt)}開始）`;
  const options: NotificationOptions = {
    body,
    // 同じ作業の通知は複数タブから出しても1つにまとまる
    tag: dueNotificationTag(activity.id),
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  };
  const title = `「${activity.title}」の予定時間です`;
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) {
    await registration.showNotification(title, options);
  } else {
    new Notification(title, options);
  }
}

const NOTIFIED_KEY = "wdyd:notified:v1";

export function loadNotified(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveNotified(keys: ReadonlySet<string>): void {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...keys]));
  } catch {
    // 保存できなくても動作は続ける（重複通知の可能性があるだけ）
  }
}
