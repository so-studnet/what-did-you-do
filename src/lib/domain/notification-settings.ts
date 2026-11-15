/** 通知の設定（DB の user_settings と対応） */
export type NotificationSettings = {
  /** 何も作業していない時間の通知 */
  enabled: boolean;
  intervalMin: number;
  /** 空き時間の通知を送る時間帯の始まり（0〜23時） */
  startHour: number;
  /** 空き時間の通知を送る時間帯の終わり（1〜24時。この時刻になったら送らない） */
  endHour: number;
  /** 予定時間を過ぎても続いている作業の定期通知（時間帯の制限なし） */
  overrunEnabled: boolean;
  overrunIntervalMin: number;
};

/** DB の既定値と同じ。設定の行がないときもこの値で動く */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  intervalMin: 15,
  startHour: 8,
  endHour: 23,
  overrunEnabled: true,
  overrunIntervalMin: 15,
};

export const INTERVAL_OPTIONS = [15, 30, 60] as const;

export type NotificationSettingsResult =
  | { ok: true; value: NotificationSettings }
  | { ok: false; error: string };

const validInterval = (m: number) => Number.isInteger(m) && m >= 5 && m <= 240;

export function validateNotificationSettings(s: NotificationSettings): NotificationSettingsResult {
  if (!validInterval(s.intervalMin) || !validInterval(s.overrunIntervalMin)) {
    return { ok: false, error: "通知の間隔は5〜240分にしてください" };
  }
  if (!Number.isInteger(s.startHour) || s.startHour < 0 || s.startHour > 23) {
    return { ok: false, error: "始まりの時刻が正しくありません" };
  }
  if (!Number.isInteger(s.endHour) || s.endHour < 1 || s.endHour > 24) {
    return { ok: false, error: "終わりの時刻が正しくありません" };
  }
  if (s.startHour >= s.endHour) {
    return { ok: false, error: "終わりの時刻は始まりより後にしてください" };
  }
  return { ok: true, value: s };
}

export type UserSettingsRow = {
  idle_reminder_enabled: boolean;
  idle_interval_min: number;
  active_start_hour: number;
  active_end_hour: number;
  overrun_reminder_enabled: boolean;
  overrun_interval_min: number;
};

export const rowToNotificationSettings = (r: Partial<UserSettingsRow> | null): NotificationSettings => {
  const d = DEFAULT_NOTIFICATION_SETTINGS;
  if (r === null) return d;
  return {
    enabled: r.idle_reminder_enabled ?? d.enabled,
    intervalMin: r.idle_interval_min ?? d.intervalMin,
    startHour: r.active_start_hour ?? d.startHour,
    endHour: r.active_end_hour ?? d.endHour,
    // 超過中の通知のマイグレーションが未適用の DB では列がないので既定値
    overrunEnabled: r.overrun_reminder_enabled ?? d.overrunEnabled,
    overrunIntervalMin: r.overrun_interval_min ?? d.overrunIntervalMin,
  };
};

export const notificationSettingsToRow = (s: NotificationSettings): UserSettingsRow => ({
  idle_reminder_enabled: s.enabled,
  idle_interval_min: s.intervalMin,
  active_start_hour: s.startHour,
  active_end_hour: s.endHour,
  overrun_reminder_enabled: s.overrunEnabled,
  overrun_interval_min: s.overrunIntervalMin,
});
