import { app, ipcMain, screen, shell, type BrowserWindow } from "electron";
import type { CalibrationResultSummary, EyeTrackingObservation, Preferences, ScreenBounds } from "@eyemouse/shared-types";
import { SessionCoordinator } from "../session/session-coordinator";
import { SettingsStore } from "../settings/settings-store";
import { TrackingRuntime } from "../tracking-runtime";
import { MacOSInputAdapter } from "../native/macos-input";

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
  openCalibration: () => void,
  runtime: TrackingRuntime,
  nativeInput: MacOSInputAdapter
): void {
  ipcMain.handle("session:get-status", () => coordinator.getStatus());
  ipcMain.handle("session:start", () => coordinator.start());
  ipcMain.handle("session:stop", async () => {
    await runtime.stop();
    return coordinator.stop();
  });
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
    if (typeof value.calibrationId !== "string" || typeof value.displayId !== "string" || typeof value.validationErrorPx !== "number" || !Number.isFinite(value.validationErrorPx) || typeof value.accepted !== "boolean" || !value.model || typeof value.model !== "object" || !value.screenBounds || typeof value.screenBounds !== "object") {
      throw new TypeError("Invalid calibration result.");
    }
    const calibrationResult = value as unknown as CalibrationResultSummary;
    const status = coordinator.completeCalibration(calibrationResult);
    runtime.setCalibration(calibrationResult);
    return status;
  });
  ipcMain.handle("tracking:observation", async (_event, value: unknown) => {
    if (!value || typeof value !== "object") throw new TypeError("Observation must be an object.");
    const observation = value as Partial<EyeTrackingObservation>;
    if (typeof observation.timestampMs !== "number" || !Number.isFinite(observation.timestampMs) || typeof observation.frameId !== "number" || !Array.isArray(observation.normalizedFeatures) || typeof observation.faceVisible !== "boolean" || typeof observation.leftEyeVisible !== "boolean" || typeof observation.rightEyeVisible !== "boolean") {
      throw new TypeError("Invalid eye-tracking observation.");
    }
    await runtime.processObservation(observation as EyeTrackingObservation);
  });
  ipcMain.handle("native:check", async () => {
    let authorized = false;
    try { authorized = await nativeInput.isAuthorized(); } catch { authorized = false; }
    return coordinator.setNativeInputAuthorized(authorized);
  });
  ipcMain.handle("native:open-settings", async () => {
    await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
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
