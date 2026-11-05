"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  DEFAULT_IDLE_SETTINGS,
  IDLE_INTERVAL_OPTIONS,
  type IdleSettings,
  validateIdleSettings,
} from "@/lib/domain/idle-settings";
import { isPushConfigured } from "@/lib/push-subscription";
import { loadIdleSettings, saveIdleSettings } from "@/lib/supabase/settings";
import { useAuth } from "./auth-gate";
import { inputClass } from "./modal";

const HOURS = Array.from({ length: 25 }, (_, h) => h);

export function SettingsView() {
  const auth = useAuth();

  if (auth.status !== "signed-in") {
    return (
      <p className="text-sm text-zinc-500">
        通知の設定は、ログインしてアカウントに記録を保存しているときに使えます。
      </p>
    );
  }
  return <IdleSettingsForm key={auth.userId} userId={auth.userId} />;
}

type LoadState = { status: "loading" } | { status: "ready"; settings: IdleSettings } | { status: "error" };

function IdleSettingsForm({ userId }: { userId: string }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadIdleSettings()
      .then((settings) => !cancelled && setLoad({ status: "ready", settings }))
      .catch((e) => {
        console.error("設定の読み込みに失敗しました", e);
        if (!cancelled) setLoad({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (load.status === "loading") return <p className="text-sm text-zinc-500">読み込み中…</p>;
  if (load.status === "error") {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        設定を読み込めませんでした。DB に設定用のテーブルが追加されているか確認してください（docs/setup.md の 8）。
      </p>
    );
  }
  return <Form userId={userId} initial={load.settings} />;
}

function Form({ userId, initial }: { userId: string; initial: IdleSettings }) {
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<IdleSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setMessage(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = validateIdleSettings(settings);
    if (!r.ok) {
      setMessage({ kind: "error", text: r.error });
      return;
    }
    setSaving(true);
    try {
      await saveIdleSettings(userId, r.value);
      setMessage({ kind: "ok", text: "保存しました" });
    } catch (err) {
      console.error("設定の保存に失敗しました", err);
      setMessage({ kind: "error", text: "保存できませんでした。通信状態を確認してください" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <section aria-labelledby="idle-heading" className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <h2 id="idle-heading" className="font-bold">
            何も作業していない時間の通知
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            実行中の作業がないとき、最後の作業が終わってから一定の間隔で「今、何をしていますか？」と通知します。
            前の日から何もしていないときは、通知する時間帯の始まりから数えます。
          </p>
        </div>

        <label className="flex items-center justify-between gap-3">
          <span>通知する</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            className="size-6 accent-blue-600"
          />
        </label>

        <fieldset disabled={!settings.enabled} className="flex flex-col gap-4 disabled:opacity-50">
          <label className="flex flex-col gap-1 text-sm">
            間隔
            <select
              value={settings.intervalMin}
              onChange={(e) => set({ intervalMin: Number(e.target.value) })}
              className={inputClass}
            >
              {IDLE_INTERVAL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}分ごと
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm">
            通知する時間帯
            <div className="flex items-center gap-2">
              <select
                aria-label="始まり"
                value={settings.startHour}
                onChange={(e) => set({ startHour: Number(e.target.value) })}
                className={inputClass}
              >
                {HOURS.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </select>
              <span>〜</span>
              <select
                aria-label="終わり"
                value={settings.endHour}
                onChange={(e) => set({ endHour: Number(e.target.value) })}
                className={inputClass}
              >
                {HOURS.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-zinc-500">寝ている時間などは外しておくと安心です</span>
          </div>
        </fieldset>

        {!isPushConfigured && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            この通知はサーバーから送るため、アプリを閉じていても届く通知（Web Push）の設定が必要です。
          </p>
        )}
      </section>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`text-sm ${message.kind === "error" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}
        >
          {message.text}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-60"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={() => set(DEFAULT_IDLE_SETTINGS)}
          className="rounded-xl px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400"
        >
          初期値に戻す
        </button>
      </div>
    </form>
  );
}
