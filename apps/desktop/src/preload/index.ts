import { contextBridge, ipcRenderer } from "electron";
import type { EyeMouseAPI, Preferences, SessionStatus } from "@eyemouse/shared-types";

const api: EyeMouseAPI = {
  getSessionStatus: () => ipcRenderer.invoke("session:get-status"),
  startSession: () => ipcRenderer.invoke("session:start"),
  stopSession: () => ipcRenderer.invoke("session:stop"),
  pauseSession: () => ipcRenderer.invoke("session:pause"),
  resumeSession: () => ipcRenderer.invoke("session:resume"),
  setCameraRequesting: () => ipcRenderer.invoke("camera:requesting"),
  setCameraReady: () => ipcRenderer.invoke("camera:ready"),
  setCameraFailure: (reason: string) => ipcRenderer.invoke("camera:failure", reason),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  setPreferences: (patch: Partial<Preferences>) => ipcRenderer.invoke("preferences:set", patch),
  onSessionStatusChanged: (listener: (status: SessionStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: SessionStatus) => listener(status);
    ipcRenderer.on("session:status-changed", handler);
    return () => ipcRenderer.removeListener("session:status-changed", handler);
  }
};

contextBridge.exposeInMainWorld("eyemouse", api);
