import { type Activity, parseActivities } from "@/lib/domain/activity";

/**
 * 作業記録の保存先。
 * M1 ではブラウザの localStorage、M2 で Supabase 実装に差し替える。
 */
export interface ActivityStore {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): readonly Activity[];
  getServerSnapshot(): readonly Activity[];
  update(fn: (prev: readonly Activity[]) => Activity[]): void;
}

const EMPTY: readonly Activity[] = Object.freeze([]);

export function createLocalStorageActivityStore(key = "wdyd:activities:v1"): ActivityStore {
  const listeners = new Set<() => void>();
  // useSyncExternalStore は同じ値に対して同じ参照を返す必要があるので、生文字列でキャッシュする
  let cachedRaw: string | null | undefined;
  let cached: readonly Activity[] = EMPTY;

  const read = (): readonly Activity[] => {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return cached;
    }
    if (raw === cachedRaw) return cached;
    cachedRaw = raw;
    try {
      cached = raw === null ? EMPTY : parseActivities(JSON.parse(raw));
    } catch {
      cached = EMPTY;
    }
    return cached;
  };

  const notify = () => listeners.forEach((l) => l());

  const onStorage = (e: StorageEvent) => {
    if (e.key === key) notify();
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
    getServerSnapshot: () => EMPTY,
    update(fn) {
      const next = fn(read());
      window.localStorage.setItem(key, JSON.stringify(next));
      notify();
    },
  };
}

export const activityStore: ActivityStore =
  typeof window === "undefined"
    ? {
        subscribe: () => () => {},
        getSnapshot: () => EMPTY,
        getServerSnapshot: () => EMPTY,
        update: () => {
          throw new Error("サーバ上では更新できません");
        },
      }
    : createLocalStorageActivityStore();
