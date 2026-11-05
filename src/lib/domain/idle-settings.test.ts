import { describe, expect, it } from "vitest";
import { DEFAULT_IDLE_SETTINGS, idleSettingsToRow, rowToIdleSettings, validateIdleSettings } from "./idle-settings";

describe("validateIdleSettings", () => {
  it("既定値はOK", () => {
    expect(validateIdleSettings(DEFAULT_IDLE_SETTINGS).ok).toBe(true);
  });
  it.each([
    ["間隔が短すぎる", { intervalMin: 1 }],
    ["始まりが範囲外", { startHour: 24 }],
    ["終わりが範囲外", { endHour: 25 }],
    ["終わりが始まりと同じ", { startHour: 9, endHour: 9 }],
    ["終わりが始まりより前", { startHour: 20, endHour: 8 }],
  ])("%s はエラー", (_, patch) => {
    expect(validateIdleSettings({ ...DEFAULT_IDLE_SETTINGS, ...patch }).ok).toBe(false);
  });
  it("0時〜24時（一日中）はOK", () => {
    expect(validateIdleSettings({ ...DEFAULT_IDLE_SETTINGS, startHour: 0, endHour: 24 }).ok).toBe(true);
  });
});

describe("行との変換", () => {
  it("行がなければ既定値、往復で元に戻る", () => {
    expect(rowToIdleSettings(null)).toEqual(DEFAULT_IDLE_SETTINGS);
    const s = { enabled: false, intervalMin: 30, startHour: 9, endHour: 18 };
    expect(rowToIdleSettings(idleSettingsToRow(s))).toEqual(s);
  });
});
