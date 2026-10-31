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

let popover: ReturnType<typeof createPopover> | null = null;
let tray: ReturnType<typeof createTray> | null = null;
let calibrationWindow: BrowserWindow | null = null;
let nativeInput: MacOSInputAdapter | null = null;
let trackingRuntime: TrackingRuntime | null = null;

function openCalibrationWindow(): void {
  if (calibrationWindow && !calibrationWindow.isDestroyed()) {
    calibrationWindow.show();
    calibrationWindow.focus();
    return;
  }

  const bounds = screen.getPrimaryDisplay().bounds;
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
      preload: join(__dirname, "../preload/index.mjs"),
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

app.whenReady().then(async () => {
  if (process.platform === "darwin") app.dock?.hide();

  const settings = new SettingsStore(join(app.getPath("userData"), "preferences.json"));
  const preferences = await settings.load();
  app.setLoginItemSettings({ openAtLogin: preferences.launchAtLogin });

  const coordinator = new SessionCoordinator();
  const calibrationStore = new CalibrationStore(join(app.getPath("userData"), "calibration.json"));
  const storedCalibration = await calibrationStore.load();
  const display = screen.getPrimaryDisplay();
  const activeCalibration = storedCalibration && matchesDisplay(storedCalibration, { id: String(display.id), ...display.bounds }) ? storedCalibration : null;
  nativeInput = new MacOSInputAdapter();
  const pointerController = new PointerController(nativeInput);
  trackingRuntime = new TrackingRuntime(coordinator, pointerController);
  if (activeCalibration) {
    coordinator.setStoredCalibration(activeCalibration);
    trackingRuntime.setCalibration(activeCalibration);
  } else if (storedCalibration) {
    await calibrationStore.clear();
  }
  popover = createPopover();
  tray = createTray(popover, () => app.quit());
  registerIpc(coordinator, settings, () => popover, openCalibrationWindow, trackingRuntime, nativeInput, calibrationStore);

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
});
