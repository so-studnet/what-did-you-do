"use client";

import {
  type NotificationSettings,
  type UserSettingsRow,
  notificationSettingsToRow,
  rowToNotificationSettings,
} from "@/lib/domain/notification-settings";
import { getSupabase } from "./client";

/**
 * 自分の設定を読む（行がなければ既定値）。
 * 列を名指しせず読むので、新しい列のマイグレーションが未適用でも読める（ない列は既定値）。
 */
export async function loadNotificationSettings(): Promise<NotificationSettings> {
  const { data, error } = await getSupabase().from("user_settings").select("*").maybeSingle();
  if (error) throw error;
  return rowToNotificationSettings((data as Partial<UserSettingsRow> | null) ?? null);
}

/** 自分の設定を保存する。通知文の時刻に使うので、この端末のタイムゾーンも保存する */
export async function saveNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
  const { error } = await getSupabase()
    .from("user_settings")
    .upsert({
      user_id: userId,
      ...notificationSettingsToRow(settings),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo",
    });
  if (error) throw error;
}
