import { BrowserWindow, ipcMain, screen, shell } from "electron";
import type { CalibrationResultSummary, EyeTrackingObservation, InteractionEvent, Preferences, ScreenBounds } from "@eyemouse/shared-types";
import { SessionCoordinator } from "../session/session-coordinator";
import { SettingsStore } from "../settings/settings-store";
import { TrackingRuntime } from "../tracking-runtime";
import { MacOSInputAdapter } from "../native/macos-input";
import { CalibrationStore, isCalibrationResult } from "../calibration/calibration-store";
import { UpdateManager } from "../update-manager";
import { applyLoginItemSetting, getLoginItemStatus } from "../login-item";

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

  if ("onboardingComplete" in input) {
    if (typeof input.onboardingComplete !== "boolean") throw new TypeError("onboardingComplete must be a boolean.");
    patch.onboardingComplete = input.onboardingComplete;
  }

  if ("cameraDeviceId" in input) {
    if (input.cameraDeviceId !== null && (typeof input.cameraDeviceId !== "string" || input.cameraDeviceId.length > 300)) throw new TypeError("cameraDeviceId must be null or a valid device identifier.");
    patch.cameraDeviceId = input.cameraDeviceId as string | null;
  }

  if ("calibrationDisplayId" in input) {
    if (input.calibrationDisplayId !== null && (typeof input.calibrationDisplayId !== "string" || input.calibrationDisplayId.length > 100)) throw new TypeError("calibrationDisplayId must be null or a valid display identifier.");
    patch.calibrationDisplayId = input.calibrationDisplayId as string | null;
  }

  if ("interactionMode" in input) {
    if (input.interactionMode !== "dwell" && input.interactionMode !== "wink") {
      throw new TypeError("interactionMode is invalid.");
    }
    patch.interactionMode = input.interactionMode;
  }

  if ("winkAction" in input) {
    if (input.winkAction !== "single-click" && input.winkAction !== "double-click") throw new TypeError("winkAction is invalid.");
    patch.winkAction = input.winkAction;
  }

  if ("scrollEnabled" in input) {
    if (typeof input.scrollEnabled !== "boolean") throw new TypeError("scrollEnabled must be a boolean.");
    patch.scrollEnabled = input.scrollEnabled;
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
  openCalibration: (displayId?: string) => void,
  openSettings: () => void,
  openDiagnostics: () => void,
  runtime: TrackingRuntime,
  nativeInput: MacOSInputAdapter,
  calibrationStore: CalibrationStore,
  updates: UpdateManager
): void {
  ipcMain.handle("session:get-status", () => coordinator.getStatus());
  ipcMain.handle("diagnostics:get", () => runtime.getDiagnostics());
  ipcMain.handle("updates:get", () => updates.getStatus());
  ipcMain.handle("updates:check", () => updates.check());
  ipcMain.handle("updates:download", () => updates.download());
  ipcMain.handle("updates:install", () => updates.install());
  ipcMain.handle("app:login-item", () => getLoginItemStatus());
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
  ipcMain.handle("calibration:open", (_event, displayId: unknown) => {
    if (displayId !== undefined && typeof displayId !== "string") throw new TypeError("Display identifier must be a string.");
    coordinator.beginCalibration();
    openCalibration(displayId as string | undefined);
  });
  ipcMain.handle("calibration:get-screen", (event): ScreenBounds => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const display = window ? screen.getDisplayMatching(window.getBounds()) : screen.getPrimaryDisplay();
    return { ...display.bounds, displayId: String(display.id) };
  });
  ipcMain.handle("display:get-all", (): ScreenBounds[] => screen.getAllDisplays().map((display) => ({ ...display.bounds, displayId: String(display.id) })));
  ipcMain.handle("calibration:complete", async (_event, result: unknown) => {
    if (!isCalibrationResult(result)) {
      throw new TypeError("Invalid calibration result.");
    }
    const calibrationResult = result as CalibrationResultSummary;
    const status = coordinator.completeCalibration(calibrationResult);
    runtime.setCalibration(calibrationResult);
    if (calibrationResult.accepted) await calibrationStore.save(calibrationResult);
    else await calibrationStore.clear();
    return status;
  });
  ipcMain.handle("tracking:observation", async (_event, value: unknown) => {
    if (!value || typeof value !== "object") throw new TypeError("Observation must be an object.");
    const observation = value as Partial<EyeTrackingObservation>;
    if (typeof observation.timestampMs !== "number" || !Number.isFinite(observation.timestampMs) || typeof observation.frameId !== "number" || !Number.isInteger(observation.frameId) || observation.frameId < 0 || !Array.isArray(observation.normalizedFeatures) || observation.normalizedFeatures.length !== 13 || !observation.normalizedFeatures.every((item) => typeof item === "number" && Number.isFinite(item)) || typeof observation.faceVisible !== "boolean" || typeof observation.leftEyeVisible !== "boolean" || typeof observation.rightEyeVisible !== "boolean") {
      throw new TypeError("Invalid eye-tracking observation.");
    }
    for (const value of [observation.leftEyeOpen, observation.rightEyeOpen, observation.landmarkStability, observation.headPose?.yaw, observation.headPose?.pitch, observation.headPose?.roll]) {
      if (value !== undefined && value !== null && (typeof value !== "number" || !Number.isFinite(value))) throw new TypeError("Observation contains non-finite measurements.");
    }
    return runtime.processObservation(observation as EyeTrackingObservation);
  });
  ipcMain.handle("tracking:interaction", async (_event, value: unknown) => {
    if (!value || typeof value !== "object") throw new TypeError("Interaction event must be an object.");
    const event = value as Partial<InteractionEvent>;
    const validTypes = ["LEFT_CLICK", "RIGHT_CLICK", "DOUBLE_CLICK", "DWELL_CLICK", "DRAG_START", "DRAG_END", "SCROLL", "PAUSE"];
    const validSources = ["left-wink", "right-wink", "dwell", "keyboard", "unknown"];
    if (typeof event.type !== "string" || !validTypes.includes(event.type) || typeof event.timestampMs !== "number" || !Number.isFinite(event.timestampMs) || typeof event.confidence !== "number" || !Number.isFinite(event.confidence) || event.confidence < 0 || event.confidence > 1 || typeof event.source !== "string" || !validSources.includes(event.source) || (event.deltaY !== undefined && (typeof event.deltaY !== "number" || !Number.isFinite(event.deltaY) || Math.abs(event.deltaY) > 100))) throw new TypeError("Invalid interaction event.");
    if (event.point !== null && event.point !== undefined && (typeof event.point !== "object" || typeof event.point.x !== "number" || typeof event.point.y !== "number" || !Number.isFinite(event.point.x) || !Number.isFinite(event.point.y))) throw new TypeError("Interaction point is invalid.");
    return runtime.processInteraction(event as InteractionEvent);
  });
  ipcMain.handle("native:check", async () => {
    let authorized = false;
    try { authorized = await nativeInput.isAuthorized(); } catch { authorized = false; }
    return coordinator.setNativeInputAuthorized(authorized);
  });
  ipcMain.handle("native:open-settings", async () => {
    await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
  });
  ipcMain.handle("settings:open", () => openSettings());
  ipcMain.handle("diagnostics:open", () => openDiagnostics());
  ipcMain.handle("preferences:get", () => settings.get());
  ipcMain.handle("preferences:set", async (_event, value: unknown) => {
    const patch = validatePreferencesPatch(value);
    const previous = settings.get();
    const loginItemChanged = patch.launchAtLogin !== undefined && patch.launchAtLogin !== previous.launchAtLogin;
    if (loginItemChanged) {
      applyLoginItemSetting(patch.launchAtLogin as boolean);
    }
    try {
      const next = await settings.update(patch);
      runtime.setPreferences(next);
      return next;
    } catch (error) {
      if (loginItemChanged) {
        try {
          applyLoginItemSetting(previous.launchAtLogin);
        } catch (rollbackError) {
          console.error("Could not roll back launch-at-login setting after preferences write failure.", rollbackError);
        }
      }
      throw error;
    }
  });

  coordinator.on("status-changed", (status) => {
    getPopover()?.webContents.send("session:status-changed", status);
  });
  updates.on("status-changed", (status) => {
    getPopover()?.webContents.send("updates:status-changed", status);
  });
}
