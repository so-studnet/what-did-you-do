import { describe, expect, it, vi } from "vitest";
import { type DuePushRow, dispatchDuePush, safeEqual } from "./push-dispatch";

const row = (endpoint: string): DuePushRow => ({
  activity_id: "a1",
  title: "洗濯",
  started_at: "2026-11-02T00:05:00+00:00",
  planned_min: 30,
  due_at: "2026-11-02T00:35:00+00:00",
  endpoint,
  p256dh: "key",
  auth: "auth",
  time_zone: "Asia/Tokyo",
});
const httpError = (statusCode: number) => Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });

describe("dispatchDuePush", () => {
  it("宛先ごとに通知を送り、無効な宛先は消し、その他の失敗は数える", async () => {
    const send = vi.fn(async (target: { endpoint: string }) => {
      if (target.endpoint === "gone") throw httpError(410);
      if (target.endpoint === "broken") throw httpError(500);
    });
    const removeSubscription = vi.fn(async () => {});
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await dispatchDuePush({
      claim: async () => [row("ok"), row("gone"), row("broken")],
      send,
      removeSubscription,
      now: () => new Date("2026-11-02T00:35:10Z"),
    });
    spy.mockRestore();
    expect(result).toEqual({ sent: 1, failed: 1, removed: 1 });
    expect(removeSubscription).toHaveBeenCalledWith("gone");
    expect(send).toHaveBeenCalledWith(
      { endpoint: "ok", keys: { p256dh: "key", auth: "auth" } },
      { title: "「洗濯」の予定時間です", body: "予定の30分になりました（09:05開始）", tag: "wdyd-due-a1", url: "/" },
    );
  });
  it("送るものがなければ何もしない", async () => {
    const send = vi.fn();
    expect(await dispatchDuePush({ claim: async () => [], send, removeSubscription: vi.fn(), now: () => new Date() })).toEqual({
      sent: 0,
      failed: 0,
      removed: 0,
    });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("safeEqual", () => {
  it("同じ文字列だけ true", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secret", "secreT")).toBe(false);
    expect(safeEqual("secret", "secret2")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
});
