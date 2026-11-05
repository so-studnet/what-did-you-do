"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { appStore } from "@/lib/store/app-store";
import { retrySync, signOut } from "@/lib/supabase/auth";
import { useAuth } from "./auth-gate";

const STATUS_LABEL = {
  loading: { text: "読み込み中", className: "text-zinc-500" },
  saving: { text: "保存中…", className: "text-zinc-500" },
  synced: { text: "同期済み", className: "text-zinc-500" },
  offline: { text: "オフライン", className: "text-amber-700 dark:text-amber-400" },
  error: { text: "同期エラー・再読み込み", className: "text-red-600 dark:text-red-400" },
} as const;

export function AppHeader() {
  const auth = useAuth();
  const status = useSyncExternalStore(appStore.subscribe, appStore.getStatus, () => "local" as const);
  const [menuOpen, setMenuOpen] = useState(false);
  const label = status === "local" ? null : STATUS_LABEL[status];

  return (
    <header className="border-b border-zinc-200 pt-[env(safe-area-inset-top)] dark:border-zinc-800">
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2.5">
        <p className="mr-auto font-bold">What did you do</p>
        {auth.status === "signed-in" && label && (
          <button
            type="button"
            onClick={status === "error" ? retrySync : undefined}
            disabled={status !== "error"}
            aria-live="polite"
            className={`text-xs ${label.className}`}
          >
            {label.text}
          </button>
        )}
        {auth.status === "signed-in" && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="アカウント"
              className="rounded-lg px-2 py-1 text-sm text-zinc-600 dark:text-zinc-400"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-zinc-200 bg-white p-2 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                <p className="truncate px-2 py-1 text-xs text-zinc-500">{auth.email}</p>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  設定
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-red-600 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-800"
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
