import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { type DuePushRow, type IdlePushRow, dispatchPush, safeEqual } from "@/lib/server/push-dispatch";

/**
 * 予定時間に達した作業の通知と、何も作業していない時間の通知を送る。
 * Supabase の pg_cron から1分ごとに呼ばれる（docs/setup.md の「7. アプリを閉じていても通知する」）。
 * Authorization: Bearer <CRON_SECRET> が必要。
 */
export async function POST(request: Request) {
  const env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidSubject: process.env.VAPID_SUBJECT,
    cronSecret: process.env.CRON_SECRET,
  };
  const missing = Object.entries(env)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    return Response.json({ error: "not configured", missing }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(token, env.cronSecret!)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createClient(env.supabaseUrl!, env.secretKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const vapidDetails = {
    subject: env.vapidSubject!,
    publicKey: env.vapidPublicKey!,
    privateKey: env.vapidPrivateKey!,
  };

  try {
    const result = await dispatchPush({
      claimDue: async () => {
        const { data, error } = await admin.rpc("claim_due_push_notifications");
        if (error) throw error;
        return (data ?? []) as DuePushRow[];
      },
      claimIdle: async () => {
        const { data, error } = await admin.rpc("claim_idle_push_notifications");
        if (error) {
          // 空き時間の通知のマイグレーションが未適用でも、予定時間の通知は止めない
          console.error("空き時間の通知の取り出しに失敗しました", error);
          return [];
        }
        return (data ?? []) as IdlePushRow[];
      },
      send: async (target, payload) => {
        await webpush.sendNotification(target, JSON.stringify(payload), {
          vapidDetails,
          TTL: 60 * 60,
          urgency: "high",
        });
      },
      removeSubscription: async (endpoint) => {
        const { error } = await admin.rpc("delete_push_subscription", { target_endpoint: endpoint });
        if (error) console.error("宛先の削除に失敗しました", error);
      },
      now: () => new Date(),
    });
    // 古い送信記録の掃除（失敗しても通知には影響しない）
    await admin.rpc("prune_push_deliveries");
    return Response.json(result);
  } catch (e) {
    console.error("通知の処理に失敗しました", e);
    return Response.json({ error: "dispatch failed" }, { status: 500 });
  }
}
