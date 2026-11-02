import { type AppData, EMPTY_APP_DATA, parseAppData } from "@/lib/domain/app-data";
import { parseActivities } from "@/lib/domain/activity";

/**
 * アプリデータの保存先。
 * 今はブラウザの localStorage、M2 で Supabase 実装に差し替える。
 */
export interface AppStore {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): AppData;
  getServerSnapshot(): AppData;
  update(fn: (prev: AppData) => AppData): void;
}

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

export const appStore: AppStore =
  typeof window === "undefined"
    ? {
        subscribe: () => () => {},
        getSnapshot: () => EMPTY_APP_DATA,
        getServerSnapshot: () => EMPTY_APP_DATA,
        update: () => {
          throw new Error("サーバ上では更新できません");
        },
      }
    : createLocalStorageAppStore();
