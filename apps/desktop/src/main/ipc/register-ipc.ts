import { app, ipcMain, screen, type BrowserWindow } from "electron";
import type { Preferences, ScreenBounds } from "@eyemouse/shared-types";
import { SessionCoordinator } from "../session/session-coordinator";
import { SettingsStore } from "../settings/settings-store";

function validatePreferencesPatch(value: unknown): Partial<Preferences> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Preferences patch must be an object.");
  }

  const input = value as Record<string, unknown>;
  const patch: Partial<Preferences> = {};

  if ("launchAtLogin" in input) {
    if (typeof input.launchAtLogin !== "boolean") throw new TypeError("launchAtLogin must be a boolean.");
    patch.launchAtLogin = input.launchAtLogin;
  }

  if ("interactionMode" in input) {
    if (input.interactionMode !== "dwell" && input.interactionMode !== "wink") {
      throw new TypeError("interactionMode is invalid.");
    }
    patch.interactionMode = input.interactionMode;
  }

  if ("cursorSensitivity" in input) {
    if (typeof input.cursorSensitivity !== "number" || !Number.isFinite(input.cursorSensitivity) || input.cursorSensitivity < 0.25 || input.cursorSensitivity > 4) {
      throw new TypeError("cursorSensitivity must be a finite number between 0.25 and 4.");
    }
    patch.cursorSensitivity = input.cursorSensitivity;
  }

  if ("smoothing" in input) {
    if (typeof input.smoothing !== "number" || !Number.isFinite(input.smoothing) || input.smoothing < 0 || input.smoothing > 1) {
      throw new TypeError("smoothing must be a finite number between 0 and 1.");
    }
    patch.smoothing = input.smoothing;
  }

  return patch;
}

export function registerIpc(
  coordinator: SessionCoordinator,
  settings: SettingsStore,
  getPopover: () => BrowserWindow | null,
  openCalibration: () => void
): void {
  ipcMain.handle("session:get-status", () => coordinator.getStatus());
  ipcMain.handle("session:start", () => coordinator.start());
  ipcMain.handle("session:stop", () => coordinator.stop());
  ipcMain.handle("session:pause", () => coordinator.pause());
  ipcMain.handle("session:resume", () => coordinator.resume());
  ipcMain.handle("camera:requesting", () => coordinator.setCameraRequesting());
  ipcMain.handle("camera:ready", () => coordinator.setCameraReady());
  ipcMain.handle("camera:failure", (_event, reason: unknown) => {
    if (typeof reason !== "string" || reason.length === 0 || reason.length > 500) {
      throw new TypeError("Camera failure reason must be a non-empty string under 500 characters.");
    }
    return coordinator.setCameraFailure(reason);
  });
  ipcMain.handle("calibration:begin", () => coordinator.beginCalibration());
  ipcMain.handle("calibration:open", () => {
    coordinator.beginCalibration();
    openCalibration();
  });
  ipcMain.handle("calibration:get-screen", (): ScreenBounds => {
    const display = screen.getPrimaryDisplay();
    return { ...display.bounds, displayId: String(display.id) };
  });
  ipcMain.handle("calibration:complete", (_event, result: unknown) => {
    if (!result || typeof result !== "object") throw new TypeError("Calibration result must be an object.");
    const value = result as Record<string, unknown>;
    if (typeof value.calibrationId !== "string" || typeof value.displayId !== "string" || typeof value.validationErrorPx !== "number" || typeof value.accepted !== "boolean") {
      throw new TypeError("Invalid calibration result.");
    }
    return coordinator.completeCalibration({ calibrationId: value.calibrationId, displayId: value.displayId, validationErrorPx: value.validationErrorPx, accepted: value.accepted });
  });
  ipcMain.handle("preferences:get", () => settings.get());
  ipcMain.handle("preferences:set", async (_event, value: unknown) => {
    const patch = validatePreferencesPatch(value);
    const next = await settings.update(patch);
    if (patch.launchAtLogin !== undefined) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin });
    }
    return next;
  });

  coordinator.on("status-changed", (status) => {
    getPopover()?.webContents.send("session:status-changed", status);
  });
}
