# Dependency and native integration assessment

## Current dependencies

- Electron: lifecycle, tray, BrowserWindow and login-item bridge.
- React: renderer UI.
- Vite / electron-vite: renderer, main and preload builds.
- TypeScript: strict contracts across process boundaries.
- Vitest: deterministic unit tests.

Dependencies are declared in `apps/desktop/package.json`; the lockfile is committed after the initial install.

## Deferred dependencies

- MediaPipe Tasks Vision: add after camera lifecycle is stable and model licensing/version are documented.
- Numerical library: start with small, testable TypeScript implementations; add a library only when profiling or numerical correctness justifies it.
- SQLite: add when calibration profiles and diagnostics need transactional persistence.
- Native module or Swift helper: add only after browser/Electron capture and the required CoreGraphics input behavior are measured to be insufficient.

## Native integration constraints

- Electron renderer processes do not receive unrestricted system input privileges.
- Accessibility permission must be checked and explained before enabling pointer control.
- Cursor movement and mouse events must be exposed through a narrow main-process/native adapter, never through arbitrary renderer IPC.
- Login startup currently uses Electron's `app.setLoginItemSettings` wrapper. Signed/notarized behavior must be verified before distribution; unmanaged shell startup scripts are out of scope.
- Code signing, entitlements, sandbox behavior and notarization are Phase 8 work and are not implied by the development build.
