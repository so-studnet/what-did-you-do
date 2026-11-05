import { formatMinutes } from "@/lib/format";

/** サーバーから送る通知の中身。Service Worker がこのまま表示する。 */
export type PushPayload = {
  title: string;
  body: string;
  /** 同じ作業の通知（アプリ内の通知を含む）を1つにまとめるためのタグ */
  tag: string;
  url: string;
};

export type DueNotice = {
  activityId: string;
  title: string;
  startedAt: Date;
  plannedMin: number;
  dueAt: Date;
};

/** 指定したタイムゾーンでの "HH:MM"。不明なタイムゾーンなら Asia/Tokyo を使う。 */
export function formatClockInZone(d: Date, timeZone: string): string {
  const format = (tz: string) =>
    new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(d);
  try {
    return format(timeZone);
  } catch {
    return format("Asia/Tokyo");
  }
}

/** 通知のタグ。アプリ内の通知（src/lib/notify.ts）と同じにして、重複表示を防ぐ */
export const dueNotificationTag = (activityId: string) => `wdyd-due-${activityId}`;

export function buildDuePushPayload(n: DueNotice, now: Date, timeZone: string): PushPayload {
  const overMs = now.getTime() - n.dueAt.getTime();
  const start = formatClockInZone(n.startedAt, timeZone);
  const planned = formatMinutes(n.plannedMin);
  const body =
    overMs >= 60_000
      ? `予定の${planned}を${formatMinutes(Math.floor(overMs / 60_000))}超過しています（${start}開始）`
      : `予定の${planned}になりました（${start}開始）`;
  return { title: `「${n.title}」の予定時間です`, body, tag: dueNotificationTag(n.activityId), url: "/" };
}

export type IdleNotice = {
  /** 最後に終わった作業（なければ null） */
  lastTitle: string | null;
  lastEndedAt: Date | null;
  /** 数え始め（最後の作業の終了時刻か、今日の通知時間帯の始まり） */
  baseAt: Date;
};

/** 空き時間の通知はまとめて1つにする（新しいものに置き換わる） */
export const IDLE_NOTIFICATION_TAG = "wdyd-idle";

export function buildIdlePushPayload(n: IdleNotice, now: Date): PushPayload {
  const idle = formatMinutes(Math.max(0, Math.floor((now.getTime() - n.baseAt.getTime()) / 60_000)));
  // 最後の作業が数え始めになっている = 今日の時間帯の中で作業が終わっている
  const body =
    n.lastTitle !== null && n.lastEndedAt !== null && n.lastEndedAt.getTime() >= n.baseAt.getTime()
      ? `「${n.lastTitle}」が終わってから${idle}、何も記録していません`
      : `今日はまだ何も記録していません（${idle}経過）`;
  return { title: "今、何をしていますか？", body, tag: IDLE_NOTIFICATION_TAG, url: "/" };
}
