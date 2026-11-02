"use client";

import { type FormEvent, type ReactNode, useState, useSyncExternalStore } from "react";
import { getAuthState, getServerAuthState, signIn, subscribeAuth } from "@/lib/supabase/auth";
import { inputClass } from "./modal";

export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuthState, getServerAuthState);
}

/** Supabase を使う設定のとき、ログインしていなければログイン画面を出す */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === "local" || auth.status === "signed-in") return children;
  if (auth.status === "loading") {
    return <p className="mx-auto p-8 text-sm text-zinc-500">読み込み中…</p>;
  }
  return <LoginForm />;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="mt-1 text-sm text-zinc-500">記録はアカウントに保存され、スマホとパソコンで同期されます。</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          メールアドレス
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          パスワード
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-60"
        >
          {busy ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
