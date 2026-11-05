import { describe, expect, it, vi } from "vitest";
import type { PushPayload } from "@/lib/domain/push";
import { type DuePushRow, type IdlePushRow, type PushTarget, dispatchPush, safeEqual } from "./push-dispatch";

const dueRow = (endpoint: string): DuePushRow => ({
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
const idleRow = (endpoint: string): IdlePushRow => ({
  user_id: "u1",
  slot_at: "2026-11-02T01:20:00+00:00",
  base_at: "2026-11-02T00:35:00+00:00",
  last_title: "洗濯",
  last_ended_at: "2026-11-02T00:35:00+00:00",
  endpoint,
  p256dh: "key",
  auth: "auth",
  time_zone: "Asia/Tokyo",
});
const httpError = (statusCode: number) => Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
const NOW = () => new Date("2026-11-02T01:20:10Z");

describe("dispatchPush", () => {
  it("予定時間と空き時間の通知をまとめて送る", async () => {
    const send = vi.fn<(target: PushTarget, payload: PushPayload) => Promise<void>>(async () => {});
    const result = await dispatchPush({
      claimDue: async () => [dueRow("phone")],
      claimIdle: async () => [idleRow("phone")],
      send,
      removeSubscription: vi.fn(),
      now: NOW,
    });
    expect(result).toEqual({ sent: 2, failed: 0, removed: 0 });
    expect(send.mock.calls.map(([, p]) => p.tag)).toEqual(["wdyd-due-a1", "wdyd-idle"]);
    expect(send).toHaveBeenCalledWith(
      { endpoint: "phone", keys: { p256dh: "key", auth: "auth" } },
      { title: "今、何をしていますか？", body: "「洗濯」が終わってから45分、何も記録していません", tag: "wdyd-idle", url: "/" },
    );
  });

  it("無効な宛先は1回だけ消し、その他の失敗は数える", async () => {
    const send = vi.fn(async (target: { endpoint: string }) => {
      if (target.endpoint === "gone") throw httpError(410);
      if (target.endpoint === "broken") throw httpError(500);
    });
    const removeSubscription = vi.fn(async () => {});
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await dispatchPush({
      claimDue: async () => [dueRow("ok"), dueRow("gone"), dueRow("broken")],
      claimIdle: async () => [idleRow("gone")],
      send,
      removeSubscription,
      now: NOW,
    });
    spy.mockRestore();
    expect(result).toEqual({ sent: 1, failed: 1, removed: 1 });
    expect(removeSubscription).toHaveBeenCalledTimes(1);
    expect(removeSubscription).toHaveBeenCalledWith("gone");
  });

  it("送るものがなければ何もしない", async () => {
    const send = vi.fn();
    const result = await dispatchPush({
      claimDue: async () => [],
      claimIdle: async () => [],
      send,
      removeSubscription: vi.fn(),
      now: NOW,
    });
    expect(result).toEqual({ sent: 0, failed: 0, removed: 0 });
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
