import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Activity } from "@/lib/domain/activity";
import { SupabaseAppStore } from "./supabase-store";

type Row = Record<string, unknown> & { id: string };

/** テスト用の最小限の Supabase クライアント（メモリ上のテーブル） */
function fakeClient(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = { tags: [], activities: [], templates: [], ...initial };
  const ops: string[] = [];
  let failNext = false;
  const result = (fn: () => unknown) =>
    new Promise<{ data: unknown; error: unknown }>((resolve) =>
      setTimeout(() => {
        if (failNext) {
          failNext = false;
          resolve({ data: null, error: new Error("network") });
          return;
        }
        resolve({ data: fn(), error: null });
      }, 1),
    );
  const client = {
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          range: (from: number, to: number) =>
            result(() => [...tables[table]].sort((a, b) => a.id.localeCompare(b.id)).slice(from, to + 1)),
        }),
      }),
      upsert: (rows: Row[]) => {
        ops.push(`upsert ${table} ${rows.map((r) => r.id).join(",")}`);
        return result(() => {
          for (const r of rows) {
            tables[table] = [...tables[table].filter((x) => x.id !== r.id), r];
          }
        });
      },
      delete: () => ({
        in: (_: string, ids: string[]) => {
          ops.push(`delete ${table} ${ids.join(",")}`);
          return result(() => {
            tables[table] = tables[table].filter((x) => !ids.includes(x.id));
          });
        },
      }),
    }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => "ok",
  };
  return {
    client: client as unknown as SupabaseClient,
    tables,
    ops,
    failNextRequest: () => {
      failNext = true;
    },
  };
}

const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
};

const activity = (id: string, title = id): Activity => ({
  id,
  title,
  startedAt: "2026-11-02T09:00:00.000Z",
  endedAt: null,
  plannedMin: null,
  tagIds: [],
});
const row = (a: Activity) => ({
  id: a.id,
  title: a.title,
  started_at: "2026-11-02T09:00:00+00:00",
  ended_at: null,
  planned_min: null,
  tag_ids: [],
});
const settle = () => new Promise((r) => setTimeout(r, 30));

describe("SupabaseAppStore", () => {
  it("起動時にサーバーから読み込み、キャッシュにも保存する", async () => {
    const { client } = fakeClient({ activities: [row(activity("a"))] });
    const cache = memoryStorage();
    const store = new SupabaseAppStore(client, "u1", cache);
    expect(store.getStatus()).toBe("loading");
    await store.refetch();
    expect(store.getSnapshot().activities).toEqual([activity("a")]);
    expect(store.getStatus()).toBe("synced");
    // 次回はキャッシュからすぐ表示できる
    expect(new SupabaseAppStore(client, "u1", cache).getSnapshot().activities).toEqual([activity("a")]);
  });

  it("変更はすぐ画面に反映し、差分だけを順番に送る", async () => {
    const { client, ops, tables } = fakeClient();
    const store = new SupabaseAppStore(client, "u1", memoryStorage());
    await store.refetch();
    const listener = vi.fn();
    store.subscribe(listener);

    store.update((d) => ({ ...d, activities: [activity("a")] }));
    expect(store.getSnapshot().activities).toHaveLength(1);
    expect(store.getStatus()).toBe("saving");
    expect(listener).toHaveBeenCalled();

    store.update((d) => ({ ...d, activities: [activity("a", "変更"), activity("b")] }));
    store.update((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== "a") }));
    await settle();

    expect(ops).toEqual(["upsert activities a", "upsert activities a,b", "delete activities a"]);
    expect(tables.activities.map((r) => r.id)).toEqual(["b"]);
    expect(store.getStatus()).toBe("synced");
  });

  it("送信中の読み直しは後回しにし、画面が古い状態に戻らない", async () => {
    const { client } = fakeClient();
    const store = new SupabaseAppStore(client, "u1", memoryStorage());
    await store.refetch();
    store.update((d) => ({ ...d, activities: [activity("a")] }));
    await store.refetch(); // 送信中なので何もしない
    expect(store.getSnapshot().activities.map((a) => a.id)).toEqual(["a"]);
    await settle();
    expect(store.getSnapshot().activities.map((a) => a.id)).toEqual(["a"]);
  });

  it("保存に失敗したらエラー状態にして、サーバーの内容に戻す", async () => {
    const { client, failNextRequest } = fakeClient({ activities: [row(activity("a"))] });
    const store = new SupabaseAppStore(client, "u1", memoryStorage());
    await store.refetch();
    failNextRequest();
    store.update((d) => ({ ...d, activities: [...d.activities, activity("b")] }));
    expect(store.getSnapshot().activities).toHaveLength(2);
    await settle();
    expect(store.getStatus()).toBe("error");
    expect(store.getSnapshot().activities.map((a) => a.id)).toEqual(["a"]);
    // 次の保存が成功すればエラーは消える
    store.update((d) => ({ ...d, activities: [...d.activities, activity("c")] }));
    await settle();
    expect(store.getStatus()).toBe("synced");
  });

  it("1000件を超えるデータもページを分けてすべて読む", async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => row(activity(`a${String(i).padStart(5, "0")}`)));
    const { client } = fakeClient({ activities: rows });
    const store = new SupabaseAppStore(client, "u1", memoryStorage());
    await store.refetch();
    expect(store.getSnapshot().activities).toHaveLength(2345);
  });
});
