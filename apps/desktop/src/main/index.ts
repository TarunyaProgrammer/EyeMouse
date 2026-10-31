import { app, BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { registerIpc } from "./ipc/register-ipc";
import { SessionCoordinator } from "./session/session-coordinator";
import { SettingsStore } from "./settings/settings-store";
import { createTray } from "./tray/tray-controller";
import { createPopover } from "./windows/popover";
import { MacOSInputAdapter } from "./native/macos-input";
import { PointerController } from "@eyemouse/pointer-controller";
import { TrackingRuntime } from "./tracking-runtime";
import { CalibrationStore, matchesDisplay } from "./calibration/calibration-store";
import { UpdateManager } from "./update-manager";
import { applyLoginItemSetting } from "./login-item";

let popover: ReturnType<typeof createPopover> | null = null;
let tray: ReturnType<typeof createTray> | null = null;
let calibrationWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let diagnosticsWindow: BrowserWindow | null = null;
let onboardingWindow: BrowserWindow | null = null;
let nativeInput: MacOSInputAdapter | null = null;
let trackingRuntime: TrackingRuntime | null = null;

function openCalibrationWindow(displayId?: string): void {
  if (calibrationWindow && !calibrationWindow.isDestroyed()) {
    calibrationWindow.show();
    calibrationWindow.focus();
    return;
  }

  const display = displayId ? screen.getAllDisplays().find((candidate) => String(candidate.id) === displayId) ?? screen.getPrimaryDisplay() : screen.getPrimaryDisplay();
  const bounds = display.bounds;
  calibrationWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  calibrationWindow.on("closed", () => { calibrationWindow = null; });
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) void calibrationWindow.loadURL(`${rendererUrl}?calibration=1`);
  else void calibrationWindow.loadFile(join(__dirname, "../renderer/index.html"), { query: { calibration: "1" } });
  calibrationWindow.once("ready-to-show", () => calibrationWindow?.show());
}

function openUtilityWindow(kind: "settings" | "diagnostics" | "onboarding"): BrowserWindow {
  const existing = kind === "settings" ? settingsWindow : kind === "diagnostics" ? diagnosticsWindow : onboardingWindow;
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }
  const window = new BrowserWindow({
    width: kind === "settings" ? 520 : kind === "diagnostics" ? 620 : 560,
    height: kind === "settings" ? 620 : kind === "diagnostics" ? 620 : 520,
    minWidth: kind === "settings" ? 480 : kind === "diagnostics" ? 580 : 520,
    minHeight: kind === "settings" ? 560 : kind === "diagnostics" ? 560 : 480,
    show: false,
    title: kind === "settings" ? "EyeMouse Settings" : kind === "diagnostics" ? "EyeMouse Diagnostics" : "Welcome to EyeMouse",
    backgroundColor: "#f7f7f8",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (kind === "settings") settingsWindow = window;
  else if (kind === "diagnostics") diagnosticsWindow = window;
  else onboardingWindow = window;
  window.on("closed", () => {
    if (kind === "settings") settingsWindow = null;
    else if (kind === "diagnostics") diagnosticsWindow = null;
    else onboardingWindow = null;
  });
  const query = `?${kind}=1`;
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) void window.loadURL(`${rendererUrl}${query}`);
  else void window.loadFile(join(__dirname, "../renderer/index.html"), { query: { [kind]: "1" } });
  window.once("ready-to-show", () => window.show());
  return window;
}

function openSettingsWindow(): void { openUtilityWindow("settings"); }
function openDiagnosticsWindow(): void { openUtilityWindow("diagnostics"); }

app.whenReady().then(async () => {
  if (process.platform === "darwin") app.dock?.hide();

  const settings = new SettingsStore(join(app.getPath("userData"), "preferences.json"));
  const preferences = await settings.load();
  try {
    applyLoginItemSetting(preferences.launchAtLogin);
  } catch (error) {
    console.error(error);
  }

  const coordinator = new SessionCoordinator();
  const updates = new UpdateManager();
  const calibrationStore = new CalibrationStore(join(app.getPath("userData"), "calibration.json"));
  const storedCalibration = await calibrationStore.load();
  const display = preferences.calibrationDisplayId
    ? screen.getAllDisplays().find((candidate) => String(candidate.id) === preferences.calibrationDisplayId) ?? screen.getPrimaryDisplay()
    : screen.getPrimaryDisplay();
  const activeCalibration = storedCalibration && matchesDisplay(storedCalibration, { id: String(display.id), ...display.bounds }) ? storedCalibration : null;
  nativeInput = new MacOSInputAdapter();
  const pointerController = new PointerController(nativeInput);
  trackingRuntime = new TrackingRuntime(coordinator, pointerController);
  trackingRuntime.setPreferences(preferences);
  if (activeCalibration) {
    coordinator.setStoredCalibration(activeCalibration);
    trackingRuntime.setCalibration(activeCalibration);
  } else if (storedCalibration) {
    await calibrationStore.clear();
  }
  popover = createPopover();
  tray = createTray(popover, () => app.quit());
  registerIpc(coordinator, settings, () => popover, openCalibrationWindow, openSettingsWindow, openDiagnosticsWindow, trackingRuntime, nativeInput, calibrationStore, updates);
  if (updates.getStatus().state !== "disabled" && app.isPackaged) void updates.check();
  if (!preferences.onboardingComplete) openUtilityWindow("onboarding");

  app.on("activate", () => {
    if (popover && tray) {
      popover.show();
    }
  });
});

app.on("before-quit", () => {
  void trackingRuntime?.stop();
  void nativeInput?.close();
  tray?.destroy();
  tray = null;
  popover?.destroy();
  popover = null;
  calibrationWindow?.destroy();
  calibrationWindow = null;
  settingsWindow?.destroy();
  settingsWindow = null;
  diagnosticsWindow?.destroy();
  diagnosticsWindow = null;
  onboardingWindow?.destroy();
  onboardingWindow = null;
});
