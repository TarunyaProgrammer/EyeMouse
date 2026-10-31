import { app } from "electron";
import { join } from "node:path";
import { registerIpc } from "./ipc/register-ipc";
import { SessionCoordinator } from "./session/session-coordinator";
import { SettingsStore } from "./settings/settings-store";
import { createTray } from "./tray/tray-controller";
import { createPopover } from "./windows/popover";

let popover: ReturnType<typeof createPopover> | null = null;
let tray: ReturnType<typeof createTray> | null = null;

app.whenReady().then(async () => {
  if (process.platform === "darwin") app.dock?.hide();

  const settings = new SettingsStore(join(app.getPath("userData"), "preferences.json"));
  const preferences = await settings.load();
  app.setLoginItemSettings({ openAtLogin: preferences.launchAtLogin });

  const coordinator = new SessionCoordinator();
  popover = createPopover();
  tray = createTray(popover, () => app.quit());
  registerIpc(coordinator, settings, () => popover);

  app.on("activate", () => {
    if (popover && tray) {
      popover.show();
    }
  });
});

app.on("before-quit", () => {
  tray?.destroy();
  tray = null;
  popover?.destroy();
  popover = null;
});
