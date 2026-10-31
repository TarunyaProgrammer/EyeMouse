# EyeMouse architecture

## Phase 0 decision

EyeMouse uses a single Electron desktop process with a React renderer and typed IPC. Vision, gaze estimation, quality evaluation, interaction recognition and native input remain replaceable modules behind domain contracts. The first slice intentionally implements only the shell, session lifecycle, camera boundary and preferences.

```mermaid
flowchart LR
  Camera[Camera Manager] --> Vision[Vision Pipeline]
  Vision --> Gaze[Gaze Estimation]
  Gaze --> Quality[Tracking Quality Engine]
  Quality --> Safety[Interaction Safety Controller]
  Safety --> Pointer[Pointer Controller]
  Pointer --> Native[Native macOS Input Adapter]

  Main[Electron Main Process] --> Camera
  Main --> Quality
  Main --> Safety
  Main --> IPC[Typed IPC]
  IPC --> UI[React Popover / Onboarding / Settings]
  Quality --> Feedback[Feedback Engine]
  Feedback --> UI
```

## Current implemented boundary

```mermaid
flowchart LR
  User --> Popover[React Popover]
  Popover -->|typed IPC| Main[Electron Main]
  Main --> Session[SessionCoordinator]
  Session --> Machine[Explicit SessionMachine]
  Popover --> Camera[CameraManager]
  Camera -->|ready / failure| Main
  Main --> Preferences[Atomic JSON SettingsStore]
```

The renderer requests camera access through `CameraManager`, but it does not run vision algorithms or emit system input. The main process owns lifecycle state and the future safety boundary. This is a temporary Phase 1 camera placement; MediaPipe processing should move behind a worker or a dedicated vision module before active pointer control is implemented.

The first algorithm packages now exist as executable boundaries:

- `gaze-estimation`: explainable linear/polynomial ridge regression and held-out metrics.
- `calibration`: nine-point fitting targets, held-out validation targets and stable sample collection.
- `tracking-quality`: independent quality dimensions and hysteretic GOOD/DEGRADED/LOST decisions.
- `interaction-engine`: wink/blink rejection, dwell timing and event safety filtering.
- `pointer-controller`: One Euro smoothing, movement policy and native adapter contract.

## Module responsibilities

| Module | Responsibility | Not responsible for |
| --- | --- | --- |
| `shared-types` | Stable IPC and domain contracts | Runtime policy |
| `SessionMachine` | Legal lifecycle transitions | Camera or cursor side effects |
| `SessionCoordinator` | Session status and safety-relevant lifecycle orchestration | Gaze estimation |
| `CameraManager` | Browser camera permission and stream teardown | Facial landmark interpretation |
| `SettingsStore` | Local preferences with atomic writes | Calibration persistence |
| `React renderer` | Status presentation and user controls | Native input or quality decisions |
| Future `TrackingQualityEngine` | Independent quality dimensions and hysteresis | UI rendering |
| Future `NativeInputAdapter` | Accessibility checks and system events | Gesture recognition |

## Technology decisions

- Electron owns lifecycle, tray and window management.
- React and Vite own renderer composition and development builds.
- TypeScript is strict and shared types define IPC boundaries.
- Vitest covers deterministic state and numerical logic.
- JSON preferences are sufficient for Phase 1. SQLite is deferred until calibration profiles require transactional, queryable storage.
- Electron's login-item API is wrapped at the main-process boundary for Phase 1. Native Service Management integration remains a hardening task and must be verified on signed builds.
- MediaPipe and native input are not added until the first shell can be built and tested independently.

## Non-negotiable safety invariants

1. The renderer cannot call native input directly.
2. No input is enabled by `CAMERA_READY`; active tracking requires later validated calibration.
3. Stopping the session releases camera tracks and emits no further input.
4. The quality engine, not the UI, will decide whether an interaction is safe.
5. Stale observations must never reach a pointer adapter.
