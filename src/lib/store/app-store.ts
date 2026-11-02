import { type AppData, EMPTY_APP_DATA, parseAppData } from "@/lib/domain/app-data";
import { parseActivities } from "@/lib/domain/activity";

/**
 * アプリデータの保存先。
 * ブラウザ内（localStorage）と Supabase（supabase-store.ts）の2つの実装がある。
 */
export interface AppStore {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): AppData;
  getServerSnapshot(): AppData;
  update(fn: (prev: AppData) => AppData): void;
  /** 同期の状態。ブラウザ内保存なら "local" */
  getStatus?(): SyncStatus;
}

export type SyncStatus = "local" | "loading" | "synced" | "saving" | "error" | "offline";

export const STORAGE_KEY = "wdyd:data:v2";
/** M1〜M3 の保存形式（作業記録の配列のみ） */
export const LEGACY_ACTIVITIES_KEY = "wdyd:activities:v1";

/** 保存されている文字列からデータを復元する。v2 がなければ v1 から移行する。 */
export function decodeStoredData(v2Raw: string | null, v1Raw: string | null): AppData {
  try {
    if (v2Raw !== null) return parseAppData(JSON.parse(v2Raw));
    if (v1Raw !== null) return { ...EMPTY_APP_DATA, activities: parseActivities(JSON.parse(v1Raw)) };
  } catch {
    // 壊れたデータは空として扱う
  }
  return EMPTY_APP_DATA;
}

export function createLocalStorageAppStore(storage: Storage = window.localStorage): AppStore {
  const listeners = new Set<() => void>();
  // useSyncExternalStore は同じ値に対して同じ参照を返す必要があるので、生文字列でキャッシュする
  let cacheKey: string | undefined;
  let cached: AppData = EMPTY_APP_DATA;

  const read = (): AppData => {
    let v2: string | null;
    let v1: string | null;
    try {
      v2 = storage.getItem(STORAGE_KEY);
      v1 = v2 === null ? storage.getItem(LEGACY_ACTIVITIES_KEY) : null;
    } catch {
      return cached;
    }
    const key = `${v2 ?? ""}\u0000${v1 ?? ""}`;
    if (key !== cacheKey) {
      cacheKey = key;
      cached = decodeStoredData(v2, v1);
    }
    return cached;
  };

  const notify = () => listeners.forEach((l) => l());
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === LEGACY_ACTIVITIES_KEY) notify();
  };

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      // 別タブでの変更も反映する
      if (listeners.size === 1) window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot: read,
    getServerSnapshot: () => EMPTY_APP_DATA,
    update(fn) {
      storage.setItem(STORAGE_KEY, JSON.stringify(fn(read())));
      notify();
    },
  };
}

const serverStore: AppStore = {
  subscribe: () => () => {},
  getSnapshot: () => EMPTY_APP_DATA,
  getServerSnapshot: () => EMPTY_APP_DATA,
  update: () => {
    throw new Error("サーバ上では更新できません");
  },
};

/**
 * 保存先を切り替えられるストア。画面はこれだけを使う。
 * 既定はブラウザ内保存。ログインすると Supabase のストアに切り替わる。
 */
export class SwitchableAppStore implements AppStore {
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;

  constructor(private backend: AppStore) {
    this.unsubscribe = backend.subscribe(this.notify);
  }

  private notify = () => this.listeners.forEach((l) => l());

  setBackend(backend: AppStore): void {
    if (backend === this.backend) return;
    this.unsubscribe();
    this.backend = backend;
    this.unsubscribe = backend.subscribe(this.notify);
    this.notify();
  }

  subscribe = (onChange: () => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };
  getSnapshot = () => this.backend.getSnapshot();
  getServerSnapshot = () => this.backend.getServerSnapshot();
  getStatus = (): SyncStatus => this.backend.getStatus?.() ?? "local";
  update = (fn: (prev: AppData) => AppData) => this.backend.update(fn);
}

/** このブラウザ内に保存されているデータ（ログイン前の保存先・取り込み元） */
export const localAppStore: AppStore =
  typeof window === "undefined" ? serverStore : createLocalStorageAppStore();

export const appStore = new SwitchableAppStore(localAppStore);
