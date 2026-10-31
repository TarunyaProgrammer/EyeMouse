import { describe, expect, it } from "vitest";
import { applyLoginItemSetting, getLoginItemStatus, type LoginItemSettingsHost } from "./login-item-policy";

function fakeHost(readback: boolean): LoginItemSettingsHost {
  return {
    setLoginItemSettings: () => undefined,
    getLoginItemSettings: () => ({ openAtLogin: readback, wasOpenedAtLogin: false })
  };
}

describe("login item policy", () => {
  it("reads the macOS login-item state through the typed boundary", () => {
    expect(getLoginItemStatus(fakeHost(true))).toEqual({ openAtLogin: true, wasOpenedAtLogin: false });
  });

  it("rejects a request when macOS readback disagrees", () => {
    expect(() => applyLoginItemSetting(fakeHost(false), true)).toThrow("macOS reported launch at login as disabled");
  });

  it("wraps a native setter failure with recovery context", () => {
    const host: LoginItemSettingsHost = {
      setLoginItemSettings: () => { throw new Error("operation not permitted"); },
      getLoginItemSettings: () => ({ openAtLogin: false, wasOpenedAtLogin: false })
    };
    expect(() => applyLoginItemSetting(host, true)).toThrow("Launch at login could not be configured. operation not permitted");
  });
});
