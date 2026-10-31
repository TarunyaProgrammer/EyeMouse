import { Menu, nativeImage, Tray, type BrowserWindow } from "electron";
import { togglePopover } from "../windows/popover";

const TRAY_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <path fill="#111111" d="M9 1.5c-4.2 0-7.5 2.4-7.5 5.4S4.8 12.3 9 12.3c1.2 0 2.3-.2 3.3-.6l3 2.2-.7-3.3c1.2-1 1.9-2.3 1.9-3.7C16.5 3.9 13.2 1.5 9 1.5Zm-3.1 5.4a1.1 1.1 0 1 1 2.2 0 1.1 1.1 0 0 1-2.2 0Zm4 0a1.1 1.1 0 1 1 2.2 0 1.1 1.1 0 0 1-2.2 0Z"/>
</svg>`;

export function createTray(popover: BrowserWindow, onQuit: () => void): Tray {
  const tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(TRAY_ICON_SVG).toString("base64")}`));
  tray.setToolTip("EyeMouse");
  tray.on("click", () => togglePopover(popover, tray));
  tray.on("right-click", () => {
    tray.popUpContextMenu(
      Menu.buildFromTemplate([{ label: "Quit EyeMouse", click: onQuit }])
    );
  });
  return tray;
}
