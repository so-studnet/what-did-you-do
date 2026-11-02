import type { SupabaseClient } from "@supabase/supabase-js";
import { type AppData, EMPTY_APP_DATA, parseAppData } from "@/lib/domain/app-data";
import {
  type ActivityRow,
  type AppDataDiff,
  type TagRow,
  type TemplateRow,
  diffAppData,
  isEmptyDiff,
  rowToActivity,
  rowToTag,
  rowsToTemplates,
} from "@/lib/sync/rows";
import type { AppStore, SyncStatus } from "./app-store";

const PAGE_SIZE = 1000;
const TABLES = ["tags", "activities", "templates"] as const;

/**
 * Supabase に保存するストア。
 * - 画面はすぐ更新し（楽観的更新）、差分を順番にサーバーへ送る
 * - 別の端末の変更は Realtime で受け取り、読み直す
 * - 保存に失敗したらサーバーから読み直して正しい状態に戻す
 * - 起動を速くするため、最後に読んだデータを localStorage にも置く
 */
export class SupabaseAppStore implements AppStore {
  private data: AppData = EMPTY_APP_DATA;
  private status: SyncStatus = "loading";
  private loaded = false;
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  private needsRefetch = false;
  private failed = false;
  private refetchTimer: ReturnType<typeof setTimeout> | undefined;
  private cleanups: (() => void)[] = [];

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
    private readonly cache: Storage | null = typeof window === "undefined" ? null : window.localStorage,
  ) {
    const cached = this.readCache();
    if (cached) this.data = cached;
  }

  // ---- AppStore ----
  subscribe = (onChange: () => void) => {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  };
  getSnapshot = () => this.data;
  getServerSnapshot = () => EMPTY_APP_DATA;
  getStatus = () => this.status;

  update = (fn: (prev: AppData) => AppData) => {
    const prev = this.data;
    const next = fn(prev);
    if (next === prev) return;
    this.data = next;
    this.writeCache();
    this.pending += 1;
    this.status = "saving";
    this.notify();
    this.queue = this.queue
      .then(() => this.push(diffAppData(prev, next)))
      .catch((e: unknown) => {
        console.error("保存に失敗しました", e);
        this.failed = true;
      })
      .finally(() => {
        this.pending -= 1;
        if (this.pending > 0) return;
        if (this.failed) {
          this.failed = false;
          this.setStatus("error");
          void this.refetch({ keepErrorStatus: true });
        } else if (this.needsRefetch) {
          void this.refetch();
        } else {
          this.setStatus("synced");
        }
      });
  };

  // ---- 起動・終了 ----
  start(): void {
    void this.refetch();
    const channel = this.client.channel(`wdyd-${this.userId}`);
    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${this.userId}` },
        () => this.scheduleRefetch(),
      );
    }
    channel.subscribe();
    this.cleanups.push(() => void this.client.removeChannel(channel));

    if (typeof window !== "undefined") {
      const onVisible = () => {
        if (document.visibilityState === "visible") this.scheduleRefetch(0);
      };
      const onOnline = () => this.scheduleRefetch(0);
      const onOffline = () => this.setStatus("offline");
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      this.cleanups.push(() => {
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      });
    }
  }

  stop(): void {
    clearTimeout(this.refetchTimer);
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
  }

  /** 失敗した後などに、手動でサーバーから読み直す */
  retry(): void {
    void this.refetch();
  }

  // ---- 読み込み ----
  private scheduleRefetch(delayMs = 300): void {
    clearTimeout(this.refetchTimer);
    this.refetchTimer = setTimeout(() => void this.refetch(), delayMs);
  }

  async refetch({ keepErrorStatus = false } = {}): Promise<void> {
    // 送信中の変更があるときに読み直すと、画面が一瞬古い状態に戻るので後回しにする
    if (this.pending > 0) {
      this.needsRefetch = true;
      return;
    }
    this.needsRefetch = false;
    if (!this.loaded && !keepErrorStatus) this.setStatus("loading");
    try {
      const [tags, activities, templates] = await Promise.all([
        this.fetchAll<TagRow>("tags", "id, name, parent_id, color"),
        this.fetchAll<ActivityRow>("activities", "id, title, started_at, ended_at, planned_min, tag_ids"),
        this.fetchAll<TemplateRow>("templates", "id, title, planned_min, tag_ids, sort_order"),
      ]);
      // 読み込み中に画面で変更があったら、この結果は捨てて送信後に読み直す
      if (this.pending > 0) {
        this.needsRefetch = true;
        return;
      }
      this.data = {
        tags: tags.map(rowToTag),
        activities: activities.map(rowToActivity),
        templates: rowsToTemplates(templates),
      };
      this.loaded = true;
      this.writeCache();
      this.status = keepErrorStatus ? "error" : "synced";
      this.notify();
    } catch (e) {
      console.error("読み込みに失敗しました", e);
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      this.setStatus(offline ? "offline" : "error");
    }
  }

  private async fetchAll<R>(table: string, columns: string): Promise<R[]> {
    const rows: R[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await this.client
        .from(table)
        .select(columns)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as R[]));
      if (!data || data.length < PAGE_SIZE) return rows;
    }
  }

  // ---- 送信 ----
  private async push(diff: AppDataDiff): Promise<void> {
    if (isEmptyDiff(diff)) return;
    // 追加・更新を先に、削除を後に（タグ削除時の子タグ付け替えなどを先に反映する）
    if (diff.tags.upserts.length) await this.run(this.client.from("tags").upsert(diff.tags.upserts));
    if (diff.activities.upserts.length)
      await this.run(this.client.from("activities").upsert(diff.activities.upserts));
    if (diff.templates.upserts.length)
      await this.run(this.client.from("templates").upsert(diff.templates.upserts));
    if (diff.activities.deletes.length)
      await this.run(this.client.from("activities").delete().in("id", diff.activities.deletes));
    if (diff.templates.deletes.length)
      await this.run(this.client.from("templates").delete().in("id", diff.templates.deletes));
    if (diff.tags.deletes.length) await this.run(this.client.from("tags").delete().in("id", diff.tags.deletes));
  }

  private async run(query: PromiseLike<{ error: unknown }>): Promise<void> {
    const { error } = await query;
    if (error) throw error;
  }

  // ---- その他 ----
  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  private setStatus(status: SyncStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.notify();
  }

  private cacheKey(): string {
    return `wdyd:cache:${this.userId}`;
  }

  private readCache(): AppData | null {
    try {
      const raw = this.cache?.getItem(this.cacheKey());
      return raw ? parseAppData(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  private writeCache(): void {
    try {
      this.cache?.setItem(this.cacheKey(), JSON.stringify(this.data));
    } catch {
      // 容量不足などは無視する（次回の起動が少し遅くなるだけ）
    }
  }

  /** ログアウト時に、この端末に残したキャッシュを消す */
  clearCache(): void {
    try {
      this.cache?.removeItem(this.cacheKey());
    } catch {}
  }
}
