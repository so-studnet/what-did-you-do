import { describe, expect, it } from "vitest";
import { addDays, fromDateTimeLocal, startOfLocalDay, toDateTimeLocal, truncateToMinute } from "./datetime-local";

describe("datetime-local", () => {
  it("相互変換できる", () => {
    const d = new Date(2026, 0, 5, 7, 3);
    expect(toDateTimeLocal(d)).toBe("2026-01-05T07:03");
    expect(fromDateTimeLocal("2026-01-05T07:03").getTime()).toBe(d.getTime());
  });
  it("秒付きの値も読める", () => {
    expect(fromDateTimeLocal("2026-01-05T07:03:09").getTime()).toBe(new Date(2026, 0, 5, 7, 3, 9).getTime());
  });
  it.each(["", "2026-01-05", "2026-02-30T10:00", "abc"])("不正な値 %j は Invalid Date", (v) => {
    expect(Number.isNaN(fromDateTimeLocal(v).getTime())).toBe(true);
  });
  it("truncateToMinute", () => {
    expect(truncateToMinute(new Date(2026, 0, 5, 7, 3, 59, 999))).toEqual(new Date(2026, 0, 5, 7, 3));
  });
  it("startOfLocalDay / addDays（月をまたぐ）", () => {
    expect(startOfLocalDay(new Date(2026, 0, 31, 15))).toEqual(new Date(2026, 0, 31));
    expect(addDays(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1));
    expect(addDays(new Date(2026, 2, 1), -1)).toEqual(new Date(2026, 1, 28));
  });
});
