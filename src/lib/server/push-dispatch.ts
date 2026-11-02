import { type PushPayload, buildDuePushPayload } from "@/lib/domain/push";

/** claim_due_push_notifications() が返す1行 */
export type DuePushRow = {
  activity_id: string;
  title: string;
  started_at: string;
  planned_min: number;
  due_at: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  time_zone: string;
};

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

export type DispatchDeps = {
  /** 送るべき通知を送信済みにしつつ取り出す */
  claim: () => Promise<DuePushRow[]>;
  /** 通知を送る。失敗したら statusCode 付きの例外を投げる */
  send: (target: PushTarget, payload: PushPayload) => Promise<void>;
  /** 無効になった宛先を消す */
  removeSubscription: (endpoint: string) => Promise<void>;
  now: () => Date;
};

export type DispatchResult = { sent: number; failed: number; removed: number };

/** 宛先がもう存在しないことを表すステータス（購読の解除・期限切れ） */
const GONE = new Set([404, 410]);

export async function dispatchDuePush(deps: DispatchDeps): Promise<DispatchResult> {
  const rows = await deps.claim();
  const now = deps.now();
  const result: DispatchResult = { sent: 0, failed: 0, removed: 0 };
  await Promise.all(
    rows.map(async (row) => {
      const payload = buildDuePushPayload(
        {
          activityId: row.activity_id,
          title: row.title,
          startedAt: new Date(row.started_at),
          plannedMin: row.planned_min,
          dueAt: new Date(row.due_at),
        },
        now,
        row.time_zone,
      );
      try {
        await deps.send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
        result.sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status !== undefined && GONE.has(status)) {
          await deps.removeSubscription(row.endpoint);
          result.removed += 1;
        } else {
          console.error("通知の送信に失敗しました", status, e);
          result.failed += 1;
        }
      }
    }),
  );
  return result;
}

/** 定数時間で文字列を比べる（秘密の値の比較でタイミング攻撃を避ける） */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
