"use client";

import type { Session } from "@supabase/supabase-js";
import { appStore, localAppStore } from "@/lib/store/app-store";
import { SupabaseAppStore } from "@/lib/store/supabase-store";
import { getSupabase, isSupabaseConfigured } from "./client";

export type AuthState =
  | { status: "local" } // Supabase 未設定（ブラウザ内保存だけで動く）
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; userId: string; email: string | null };

const LOCAL: AuthState = { status: "local" };
const LOADING: AuthState = { status: "loading" };
const SIGNED_OUT: AuthState = { status: "signed-out" };

let state: AuthState = isSupabaseConfigured ? LOADING : LOCAL;
let remoteStore: SupabaseAppStore | null = null;
let started = false;
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

/** ログイン状態に合わせて保存先を切り替える */
function applySession(session: Session | null) {
  const userId = session?.user.id ?? null;
  if (userId && state.status === "signed-in" && state.userId === userId) return;
  if (remoteStore) {
    remoteStore.stop();
    remoteStore = null;
  }
  if (userId) {
    remoteStore = new SupabaseAppStore(getSupabase(), userId);
    remoteStore.start();
    appStore.setBackend(remoteStore);
    setState({ status: "signed-in", userId, email: session?.user.email ?? null });
  } else {
    appStore.setBackend(localAppStore);
    setState(SIGNED_OUT);
  }
}

function start() {
  if (started || !isSupabaseConfigured || typeof window === "undefined") return;
  started = true;
  // INITIAL_SESSION を含め、ログイン状態の変化はすべてここに届く
  getSupabase().auth.onAuthStateChange((_event, session) => applySession(session));
}

export function subscribeAuth(onChange: () => void): () => void {
  start();
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export const getAuthState = () => state;
export const getServerAuthState = (): AuthState => (isSupabaseConfigured ? LOADING : LOCAL);

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  if (error.code === "invalid_credentials") return "メールアドレスかパスワードが違います";
  if (error.code === "email_not_confirmed") return "メールアドレスの確認が済んでいません";
  if (error.status === 429) return "試行回数が多すぎます。しばらく待ってからやり直してください";
  return "ログインできませんでした。通信状態を確認してください";
}

export async function signOut(): Promise<void> {
  remoteStore?.clearCache();
  await getSupabase().auth.signOut();
}

/** 同期エラーのとき、サーバーから読み直す */
export function retrySync(): void {
  remoteStore?.retry();
}
