"use client";

import {
  type IdleSettings,
  type UserSettingsRow,
  idleSettingsToRow,
  rowToIdleSettings,
} from "@/lib/domain/idle-settings";
import { getSupabase } from "./client";

const COLUMNS = "idle_reminder_enabled, idle_interval_min, active_start_hour, active_end_hour";

/** 自分の設定を読む（行がなければ既定値） */
export async function loadIdleSettings(): Promise<IdleSettings> {
  const { data, error } = await getSupabase().from("user_settings").select(COLUMNS).maybeSingle();
  if (error) throw error;
  return rowToIdleSettings((data as UserSettingsRow | null) ?? null);
}

/** 自分の設定を保存する。通知文の時刻に使うので、この端末のタイムゾーンも保存する */
export async function saveIdleSettings(userId: string, settings: IdleSettings): Promise<void> {
  const { error } = await getSupabase()
    .from("user_settings")
    .upsert({
      user_id: userId,
      ...idleSettingsToRow(settings),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo",
    });
  if (error) throw error;
}
