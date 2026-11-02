"use client";

import { useSyncExternalStore } from "react";
import {
  type NotificationStatus,
  getNotificationStatus,
  requestNotificationPermission,
  subscribeNotificationStatus,
} from "@/lib/notify";

const DISMISS_KEY = "wdyd:notify-banner-dismissed";
const DISMISS_EVENT = "wdyd:notify-banner-dismissed";

function subscribeDismissed(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => window.removeEventListener(DISMISS_EVENT, onChange);
}
function getDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}
function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {}
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

/** 通知の案内。許可を求めるか、iPhone ならホーム画面への追加を案内する。 */
export function NotificationBanner() {
  const status = useSyncExternalStore<NotificationStatus>(
    subscribeNotificationStatus,
    getNotificationStatus,
    () => "unknown",
  );
  const dismissed = useSyncExternalStore(subscribeDismissed, getDismissed, () => true);

  if (dismissed || (status !== "default" && status !== "needs-install")) return null;

  return (
    <aside
      aria-label="通知の案内"
      className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/40"
    >
      <div className="flex-1">
        {status === "default" ? (
          <>
            <p className="font-bold">予定時間になったら通知しますか？</p>
            <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">アプリを開いている間、予定時間に達した作業をお知らせします。</p>
            <button
              type="button"
              onClick={() => void requestNotificationPermission()}
              className="mt-2 rounded-xl bg-blue-600 px-4 py-1.5 font-bold text-white"
            >
              通知をオンにする
            </button>
          </>
        ) : (
          <>
            <p className="font-bold">通知を使うには、ホーム画面に追加してください</p>
            <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
              Safari の共有ボタン → 「ホーム画面に追加」から追加し、追加したアイコンから開くと通知をオンにできます。
            </p>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="案内を閉じる" className="px-1 text-zinc-500">
        ×
      </button>
    </aside>
  );
}
