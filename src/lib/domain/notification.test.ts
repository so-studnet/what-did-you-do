import { describe, expect, it } from "vitest";
import type { Activity } from "./activity";
import { dueActivities, notificationKey, pruneNotified } from "./notification";

const t = (iso: string) => new Date(iso);
const act = (id: string, plannedMin: number | null, endedAt: string | null = null, startedAt = "2026-11-02T09:00:00.000Z"): Activity => ({
  id,
  title: id,
  startedAt,
  endedAt,
  plannedMin,
  tagIds: [],
});

describe("dueActivities", () => {
  const list = [
    act("due", 30), // 09:30 に到達
    act("later", 60), // 10:00
    act("unlimited", null),
    act("ended", 10, "2026-11-02T09:20:00.000Z"),
  ];
  it("実行中・予定あり・到達済み・未通知のものだけ", () => {
    expect(dueActivities(list, t("2026-11-02T09:30:00Z"), new Set()).map((a) => a.id)).toEqual(["due"]);
    expect(dueActivities(list, t("2026-11-02T09:29:59Z"), new Set())).toEqual([]);
  });
  it("通知済みなら出さない", () => {
    const notified = new Set([notificationKey(list[0])!]);
    expect(dueActivities(list, t("2026-11-02T10:00:00Z"), notified).map((a) => a.id)).toEqual(["later"]);
  });
  it("開始時刻や予定時間を編集するとキーが変わり、改めて通知される", () => {
    const notified = new Set([notificationKey(list[0])!]);
    const edited = act("due", 45);
    expect(notificationKey(edited)).not.toBe(notificationKey(list[0]));
    expect(dueActivities([edited], t("2026-11-02T10:00:00Z"), notified)).toHaveLength(1);
  });
});

describe("pruneNotified", () => {
  it("実行中の作業のキーだけ残す", () => {
    const running = act("r", 30);
    const ended = act("e", 30, "2026-11-02T10:00:00.000Z");
    const notified = new Set([notificationKey(running)!, notificationKey(ended)!, "deleted@1"]);
    expect(pruneNotified([running, ended], notified)).toEqual(new Set([notificationKey(running)]));
  });
});
