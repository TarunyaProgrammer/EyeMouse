import type { LoginItemStatus } from "@eyemouse/shared-types";

export interface LoginItemSettingsHost {
  setLoginItemSettings(settings: { openAtLogin: boolean }): void;
  getLoginItemSettings(): LoginItemStatus;
}

export function getLoginItemStatus(host: LoginItemSettingsHost): LoginItemStatus {
  const status = host.getLoginItemSettings();
  return { openAtLogin: status.openAtLogin, wasOpenedAtLogin: status.wasOpenedAtLogin };
}

export function applyLoginItemSetting(host: LoginItemSettingsHost, openAtLogin: boolean): void {
  try {
    host.setLoginItemSettings({ openAtLogin });
    const status = getLoginItemStatus(host);
    if (status.openAtLogin !== openAtLogin) {
      throw new Error(`macOS reported launch at login as ${status.openAtLogin ? "enabled" : "disabled"}.`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "macOS rejected the login-item request.";
    throw new Error(`Launch at login could not be configured. ${reason}`);
  }
}
