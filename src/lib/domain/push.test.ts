import { describe, expect, it } from "vitest";
import { buildDuePushPayload, buildIdlePushPayload, buildOverrunPushPayload, formatClockInZone } from "./push";

const notice = {
  activityId: "a1",
  title: "洗濯",
  startedAt: new Date("2026-11-02T00:05:00Z"), // 日本時間 9:05
  plannedMin: 30,
  dueAt: new Date("2026-11-02T00:35:00Z"),
};

describe("buildDuePushPayload", () => {
  it("予定時間ちょうど（1分未満の遅れ）", () => {
    expect(buildDuePushPayload(notice, new Date("2026-11-02T00:35:40Z"), "Asia/Tokyo")).toEqual({
      title: "「洗濯」の予定時間です",
      body: "予定の30分になりました（09:05開始）",
      tag: "wdyd-due-a1",
      url: "/",
    });
  });
  it("すでに超過している", () => {
    expect(buildDuePushPayload(notice, new Date("2026-11-02T01:47:00Z"), "Asia/Tokyo").body).toBe(
      "予定の30分を1時間12分超過しています（09:05開始）",
    );
  });
  it("端末のタイムゾーンで時刻を表示する", () => {
    expect(buildDuePushPayload(notice, notice.dueAt, "America/New_York").body).toContain("（19:05開始）");
  });
});

describe("formatClockInZone", () => {
  it("不明なタイムゾーンは日本時間", () => {
    expect(formatClockInZone(new Date("2026-11-02T15:00:00Z"), "Not/AZone")).toBe("00:00");
  });
});

describe("buildIdlePushPayload", () => {
  it("今日の作業が終わってからの時間を伝える", () => {
    const p = buildIdlePushPayload(
      { lastTitle: "洗濯", lastEndedAt: new Date("2026-11-05T01:30:00Z"), baseAt: new Date("2026-11-05T01:30:00Z") },
      new Date("2026-11-05T02:15:20Z"),
    );
    expect(p).toEqual({
      title: "今、何をしていますか？",
      body: "「洗濯」が終わってから45分、何も記録していません",
      tag: "wdyd-idle",
      url: "/",
      renotify: true,
    });
  });
  it("前日の作業しかない・作業がないときは、今日まだ記録がないと伝える", () => {
    const base = new Date("2026-11-05T23:00:00Z");
    const now = new Date("2026-11-06T00:15:00Z");
    expect(buildIdlePushPayload({ lastTitle: "開発", lastEndedAt: new Date("2026-11-05T02:10:00Z"), baseAt: base }, now).body).toBe(
      "今日はまだ何も記録していません（1時間15分経過）",
    );
    expect(buildIdlePushPayload({ lastTitle: null, lastEndedAt: null, baseAt: base }, now).body).toBe(
      "今日はまだ何も記録していません（1時間15分経過）",
    );
  });
});

describe("buildOverrunPushPayload", () => {
  it("終了し忘れを問いかけ、超過時間と開始時刻を伝える。予定時刻の通知と同じ tag で知らせ直す", () => {
    const meal = {
      activityId: "m1",
      title: "食事",
      startedAt: new Date("2026-11-15T03:00:00Z"), // 日本時間 12:00
      plannedMin: 30,
      dueAt: new Date("2026-11-15T03:30:00Z"),
    };
    expect(buildOverrunPushPayload(meal, new Date("2026-11-15T04:45:30Z"), "Asia/Tokyo")).toEqual({
      title: "「食事」終了し忘れていませんか？",
      body: "予定の30分を1時間15分超過しています（12:00開始）",
      tag: "wdyd-due-m1",
      url: "/",
      renotify: true,
    });
  });
});
