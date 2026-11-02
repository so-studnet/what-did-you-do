import { describe, expect, it } from "vitest";
import { formatClock, formatDay, formatHm, formatMinutes, formatMonth } from "./format";

describe("format", () => {
  it("formatMinutes", () => {
    expect(formatMinutes(0)).toBe("0分");
    expect(formatMinutes(45)).toBe("45分");
    expect(formatMinutes(60)).toBe("1時間");
    expect(formatMinutes(150)).toBe("2時間30分");
  });
  it("formatHm は分未満を切り捨て、負は0", () => {
    expect(formatHm(59_999)).toBe("0分");
    expect(formatHm(90 * 60_000 + 30_000)).toBe("1時間30分");
    expect(formatHm(-1)).toBe("0分");
  });
  it("日付・時刻", () => {
    expect(formatDay(new Date(2026, 10, 2))).toBe("11/2(月)");
    expect(formatMonth(new Date(2026, 10, 2))).toBe("2026年11月");
    expect(formatClock(new Date(2026, 10, 2, 7, 5).toISOString())).toBe("07:05");
  });
});
