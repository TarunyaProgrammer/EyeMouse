import { contextBridge, ipcRenderer } from "electron";
import type { CalibrationResultSummary, EyeMouseAPI, EyeTrackingObservation, InteractionEvent, Preferences, ScreenBounds, SessionStatus, TrackingUpdate } from "@eyemouse/shared-types";

const api: EyeMouseAPI = {
  getSessionStatus: () => ipcRenderer.invoke("session:get-status"),
  getDiagnostics: () => ipcRenderer.invoke("diagnostics:get"),
  startSession: () => ipcRenderer.invoke("session:start"),
  stopSession: () => ipcRenderer.invoke("session:stop"),
  pauseSession: () => ipcRenderer.invoke("session:pause"),
  resumeSession: () => ipcRenderer.invoke("session:resume"),
  setCameraRequesting: () => ipcRenderer.invoke("camera:requesting"),
  setCameraReady: () => ipcRenderer.invoke("camera:ready"),
  setCameraFailure: (reason: string) => ipcRenderer.invoke("camera:failure", reason),
  openCalibration: (displayId?: string) => ipcRenderer.invoke("calibration:open", displayId),
  getCalibrationScreen: (): Promise<ScreenBounds> => ipcRenderer.invoke("calibration:get-screen"),
  getDisplays: (): Promise<ScreenBounds[]> => ipcRenderer.invoke("display:get-all"),
  completeCalibration: (result: CalibrationResultSummary) => ipcRenderer.invoke("calibration:complete", result),
  publishObservation: (observation: EyeTrackingObservation): Promise<TrackingUpdate | null> => ipcRenderer.invoke("tracking:observation", observation),
  publishInteraction: (event: InteractionEvent): Promise<boolean> => ipcRenderer.invoke("tracking:interaction", event),
  checkNativeInput: () => ipcRenderer.invoke("native:check"),
  openAccessibilitySettings: () => ipcRenderer.invoke("native:open-settings"),
  openSettings: () => ipcRenderer.invoke("settings:open"),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  setPreferences: (patch: Partial<Preferences>) => ipcRenderer.invoke("preferences:set", patch),
  onSessionStatusChanged: (listener: (status: SessionStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: SessionStatus) => listener(status);
    ipcRenderer.on("session:status-changed", handler);
    return () => ipcRenderer.removeListener("session:status-changed", handler);
  }
};

contextBridge.exposeInMainWorld("eyemouse", api);
