import { type PushPayload, buildDuePushPayload, buildIdlePushPayload } from "@/lib/domain/push";

/** claim_due_push_notifications() が返す1行（予定時間に達した作業） */
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

/** claim_idle_push_notifications() が返す1行（何も作業していない時間） */
export type IdlePushRow = {
  user_id: string;
  slot_at: string;
  base_at: string;
  last_title: string | null;
  last_ended_at: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  time_zone: string;
};

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

export type PushMessage = { target: PushTarget; payload: PushPayload };

export type DispatchDeps = {
  /** 予定時間に達した通知を、送信済みにしつつ取り出す */
  claimDue: () => Promise<DuePushRow[]>;
  /** 空き時間の通知を、送信済みにしつつ取り出す */
  claimIdle: () => Promise<IdlePushRow[]>;
  /** 通知を送る。失敗したら statusCode 付きの例外を投げる */
  send: (target: PushTarget, payload: PushPayload) => Promise<void>;
  /** 無効になった宛先を消す */
  removeSubscription: (endpoint: string) => Promise<void>;
  now: () => Date;
};

export type DispatchResult = { sent: number; failed: number; removed: number };

/** 宛先がもう存在しないことを表すステータス（購読の解除・期限切れ） */
const GONE = new Set([404, 410]);

const targetOf = (r: { endpoint: string; p256dh: string; auth: string }): PushTarget => ({
  endpoint: r.endpoint,
  keys: { p256dh: r.p256dh, auth: r.auth },
});

export function dueMessages(rows: readonly DuePushRow[], now: Date): PushMessage[] {
  return rows.map((row) => ({
    target: targetOf(row),
    payload: buildDuePushPayload(
      {
        activityId: row.activity_id,
        title: row.title,
        startedAt: new Date(row.started_at),
        plannedMin: row.planned_min,
        dueAt: new Date(row.due_at),
      },
      now,
      row.time_zone,
    ),
  }));
}

export function idleMessages(rows: readonly IdlePushRow[], now: Date): PushMessage[] {
  return rows.map((row) => ({
    target: targetOf(row),
    payload: buildIdlePushPayload(
      {
        lastTitle: row.last_title,
        lastEndedAt: row.last_ended_at === null ? null : new Date(row.last_ended_at),
        baseAt: new Date(row.base_at),
      },
      now,
    ),
  }));
}

/** 送るべき通知（予定時間・空き時間）を取り出して送る */
export async function dispatchPush(deps: DispatchDeps): Promise<DispatchResult> {
  const [due, idle] = await Promise.all([deps.claimDue(), deps.claimIdle()]);
  const now = deps.now();
  const messages = [...dueMessages(due, now), ...idleMessages(idle, now)];
  const result: DispatchResult = { sent: 0, failed: 0, removed: 0 };
  const removed = new Set<string>();
  await Promise.all(
    messages.map(async ({ target, payload }) => {
      try {
        await deps.send(target, payload);
        result.sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status !== undefined && GONE.has(status)) {
          // 同じ宛先に複数の通知を送って両方 410 でも、削除は1回だけ
          if (!removed.has(target.endpoint)) {
            removed.add(target.endpoint);
            await deps.removeSubscription(target.endpoint);
            result.removed += 1;
          }
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
