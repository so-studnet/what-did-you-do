// Web Push の購読（この端末の通知の宛先）を Supabase に登録・削除する。クライアント専用。

import type { SupabaseClient } from "@supabase/supabase-js";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** アプリを閉じていても通知する設定（Web Push）が有効か */
export const isPushConfigured = Boolean(vapidPublicKey);

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const av = new Uint8Array(a);
  return av.every((x, i) => x === b[i]);
}

/** この端末を通知の宛先として登録する（何度呼んでもよい） */
export async function ensurePushSubscription(supabase: SupabaseClient): Promise<void> {
  if (!vapidPublicKey || !isPushSupported() || Notification.permission !== "granted") return;
  const key = base64UrlToBytes(vapidPublicKey);
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  // 鍵を作り直した場合は、古い購読を解除して登録し直す
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo",
  });
  if (error) throw error;
}

/** この端末の通知の宛先を削除する（ログアウト時） */
export async function removePushSubscription(supabase: SupabaseClient): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}
