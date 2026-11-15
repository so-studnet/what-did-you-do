import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  notificationSettingsToRow,
  rowToNotificationSettings,
  validateNotificationSettings,
} from "./notification-settings";

describe("validateNotificationSettings", () => {
  it("既定値はOK", () => {
    expect(validateNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS).ok).toBe(true);
  });
  it.each([
    ["空き時間の間隔が短すぎる", { intervalMin: 1 }],
    ["超過中の間隔が長すぎる", { overrunIntervalMin: 241 }],
    ["始まりが範囲外", { startHour: 24 }],
    ["終わりが範囲外", { endHour: 25 }],
    ["終わりが始まりと同じ", { startHour: 9, endHour: 9 }],
    ["終わりが始まりより前", { startHour: 20, endHour: 8 }],
  ])("%s はエラー", (_, patch) => {
    expect(validateNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...patch }).ok).toBe(false);
  });
  it("0時〜24時（一日中）はOK", () => {
    expect(validateNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, startHour: 0, endHour: 24 }).ok).toBe(true);
  });
});

describe("行との変換", () => {
  it("行がなければ既定値、往復で元に戻る", () => {
    expect(rowToNotificationSettings(null)).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    const s = { enabled: false, intervalMin: 30, startHour: 9, endHour: 18, overrunEnabled: false, overrunIntervalMin: 60 };
    expect(rowToNotificationSettings(notificationSettingsToRow(s))).toEqual(s);
  });
  it("超過中の通知の列がない（マイグレーション未適用の）行は、その部分だけ既定値", () => {
    expect(
      rowToNotificationSettings({ idle_reminder_enabled: false, idle_interval_min: 30, active_start_hour: 9, active_end_hour: 18 }),
    ).toEqual({ enabled: false, intervalMin: 30, startHour: 9, endHour: 18, overrunEnabled: true, overrunIntervalMin: 15 });
  });
});
