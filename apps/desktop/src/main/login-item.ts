import { app } from "electron";
import type { LoginItemStatus } from "@eyemouse/shared-types";
import { applyLoginItemSetting as apply, getLoginItemStatus as get } from "./login-item-policy";

export function getLoginItemStatus(): LoginItemStatus {
  return get(app);
}

/**
 * Electron does not expose a success result from setLoginItemSettings. Read the
 * setting back so the preferences store cannot claim startup is enabled when
 * macOS rejected the request (common for unsigned or improperly signed builds).
 */
export function applyLoginItemSetting(openAtLogin: boolean): void {
  apply(app, openAtLogin);
}
