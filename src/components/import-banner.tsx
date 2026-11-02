"use client";

import { useState, useSyncExternalStore } from "react";
import { appStore, localAppStore } from "@/lib/store/app-store";
import { isEmptyData, mergeAppData } from "@/lib/sync/rows";
import { useAuth } from "./auth-gate";

const DONE_KEY = "wdyd:local-import-done";

function isDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return true;
  }
}

/** ログイン後、このブラウザに残っている記録をアカウントに取り込むか尋ねる */
export function ImportBanner() {
  const auth = useAuth();
  const local = useSyncExternalStore(localAppStore.subscribe, localAppStore.getSnapshot, localAppStore.getServerSnapshot);
  const status = useSyncExternalStore(appStore.subscribe, appStore.getStatus, () => "local" as const);
  const [hidden, setHidden] = useState(false);

  // サーバーの内容を読み終えてから尋ねる（同じ記録をサーバー側優先で合わせるため）
  if (auth.status !== "signed-in" || status !== "synced" || hidden || isEmptyData(local) || isDone()) {
    return null;
  }

  const finish = () => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {}
    setHidden(true);
  };

  return (
    <aside
      aria-label="記録の取り込み"
      className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
    >
      <p className="font-bold">このブラウザに保存されている記録があります</p>
      <p className="text-zinc-600 dark:text-zinc-400">
        作業記録 {local.activities.length}件・タグ {local.tags.length}個・テンプレート {local.templates.length}個を、
        アカウントに取り込みますか？ 同じ記録がすでにある場合はアカウント側を残します。
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            appStore.update((server) => mergeAppData(server, local));
            finish();
          }}
          className="rounded-xl bg-blue-600 px-4 py-1.5 font-bold text-white"
        >
          取り込む
        </button>
        <button type="button" onClick={finish} className="rounded-xl px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
          取り込まない
        </button>
      </div>
    </aside>
  );
}
