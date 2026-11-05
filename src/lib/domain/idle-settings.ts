/** 何も作業していない時間の通知の設定（DB の user_settings と対応） */
export type IdleSettings = {
  enabled: boolean;
  intervalMin: number;
  /** 通知する時間帯の始まり（0〜23時） */
  startHour: number;
  /** 通知する時間帯の終わり（1〜24時。この時刻になったら送らない） */
  endHour: number;
};

/** DB の既定値と同じ。設定の行がないときもこの値で動く */
export const DEFAULT_IDLE_SETTINGS: IdleSettings = { enabled: true, intervalMin: 15, startHour: 8, endHour: 23 };

export const IDLE_INTERVAL_OPTIONS = [15, 30, 60] as const;

export type IdleSettingsResult = { ok: true; value: IdleSettings } | { ok: false; error: string };

export function validateIdleSettings(s: IdleSettings): IdleSettingsResult {
  if (!Number.isInteger(s.intervalMin) || s.intervalMin < 5 || s.intervalMin > 240) {
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
};

export const rowToIdleSettings = (r: UserSettingsRow | null): IdleSettings =>
  r === null
    ? DEFAULT_IDLE_SETTINGS
    : {
        enabled: r.idle_reminder_enabled,
        intervalMin: r.idle_interval_min,
        startHour: r.active_start_hour,
        endHour: r.active_end_hour,
      };

export const idleSettingsToRow = (s: IdleSettings): UserSettingsRow => ({
  idle_reminder_enabled: s.enabled,
  idle_interval_min: s.intervalMin,
  active_start_hour: s.startHour,
  active_end_hour: s.endHour,
});
