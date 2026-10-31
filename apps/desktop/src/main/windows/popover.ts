import { BrowserWindow, screen, type Tray } from "electron";
import { join } from "node:path";

const POPOVER_WIDTH = 380;
const POPOVER_HEIGHT = 540;

export function createPopover(): BrowserWindow {
  const window = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    titleBarStyle: "hidden",
    vibrancy: "popover",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.on("blur", () => {
    if (!window.isDestroyed() && process.platform === "darwin") window.hide();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

export function togglePopover(window: BrowserWindow, tray: Tray): void {
  if (window.isVisible()) {
    window.hide();
    return;
  }

  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - POPOVER_WIDTH / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 6);
  const workArea = display.workArea;
  const safeX = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - POPOVER_WIDTH - 8));
  const safeY = Math.max(workArea.y + 8, Math.min(y, workArea.y + workArea.height - POPOVER_HEIGHT - 8));

  window.setPosition(safeX, safeY, false);
  window.show();
  window.focus();
}
