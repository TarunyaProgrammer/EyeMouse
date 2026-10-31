import { autoUpdater } from "electron-updater";
import { EventEmitter } from "node:events";
import type { UpdateStatus } from "@eyemouse/shared-types";

export class UpdateManager extends EventEmitter {
  private status: UpdateStatus = {
    state: process.env.EYEMOUSE_ENABLE_UPDATES === "1" ? "idle" : "disabled",
    version: null,
    message: process.env.EYEMOUSE_ENABLE_UPDATES === "1" ? null : "Updates are enabled only for signed release builds."
  };

  constructor() {
    super();
    if (this.status.state === "disabled") return;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => this.publish({ state: "checking", message: null }));
    autoUpdater.on("update-available", (info) => this.publish({ state: "available", version: info.version, message: "A signed update is available." }));
    autoUpdater.on("update-not-available", () => this.publish({ state: "idle", version: null, message: "EyeMouse is up to date." }));
    autoUpdater.on("download-progress", (progress) => this.publish({ state: "downloading", message: `Downloading update (${Math.round(progress.percent)}%).` }));
    autoUpdater.on("update-downloaded", (info) => this.publish({ state: "downloaded", version: info.version, message: "Update downloaded. Restart EyeMouse to install it." }));
    autoUpdater.on("error", (error) => this.publish({ state: "error", message: error.message }));
  }

  getStatus(): UpdateStatus { return { ...this.status }; }

  async check(): Promise<UpdateStatus> {
    if (this.status.state === "disabled") return this.getStatus();
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.publish({ state: "error", message: error instanceof Error ? error.message : "Update check failed." });
    }
    return this.getStatus();
  }

  async download(): Promise<UpdateStatus> {
    if (this.status.state !== "available") return this.getStatus();
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.publish({ state: "error", message: error instanceof Error ? error.message : "Update download failed." });
    }
    return this.getStatus();
  }

  install(): void {
    if (this.status.state === "downloaded") autoUpdater.quitAndInstall();
  }

  private publish(patch: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...patch };
    this.emit("status-changed", this.getStatus());
  }
}
