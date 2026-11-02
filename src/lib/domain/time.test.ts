import { describe, expect, it } from "vitest";
import { elapsedMs, formatDuration, isOverrun, overrunMs } from "./time";

const t = (iso: string) => new Date(iso);
const start = t("2026-11-02T09:00:00Z");

describe("elapsedMs", () => {
  it("実行中なら now までの時間", () => {
    const a = { startedAt: start, endedAt: null, plannedMin: null };
    expect(elapsedMs(a, t("2026-11-02T09:30:00Z"))).toBe(30 * 60_000);
  });
  it("終了済みなら now に関係なく終了時刻までの時間", () => {
    const a = { startedAt: start, endedAt: t("2026-11-02T10:00:00Z"), plannedMin: null };
    expect(elapsedMs(a, t("2026-11-03T00:00:00Z"))).toBe(60 * 60_000);
  });
  it("開始時刻が now より未来でも負にならない", () => {
    const a = { startedAt: start, endedAt: null, plannedMin: null };
    expect(elapsedMs(a, t("2026-11-02T08:00:00Z"))).toBe(0);
  });
});

describe("overrunMs / isOverrun", () => {
  it("予定なしなら超過しない", () => {
    const a = { startedAt: start, endedAt: null, plannedMin: null };
    expect(isOverrun(a, t("2026-11-03T09:00:00Z"))).toBe(false);
  });
  it("予定時間ちょうどは超過ではない", () => {
    const a = { startedAt: start, endedAt: null, plannedMin: 25 };
    expect(isOverrun(a, t("2026-11-02T09:25:00Z"))).toBe(false);
  });
  it("予定を過ぎた分だけ超過時間になる", () => {
    const a = { startedAt: start, endedAt: t("2026-11-02T09:37:00Z"), plannedMin: 25 };
    expect(overrunMs(a, t("2026-11-02T12:00:00Z"))).toBe(12 * 60_000);
  });
});

describe("formatDuration", () => {
  it("H:MM:SS 形式", () => {
    expect(formatDuration(0)).toBe("0:00:00");
    expect(formatDuration((3600 + 5 * 60 + 9) * 1000 + 999)).toBe("1:05:09");
  });
});
