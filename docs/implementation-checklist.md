# Implementation checklist

## Phase 0 — repository and technical validation

- [x] Inspect repository and confirm it was empty.
- [x] Record product truth and constraints in `PRODUCT.md`.
- [x] Document architecture and module responsibilities.
- [x] Record technology decisions and risks.
- [ ] Verify MediaPipe model asset and licensing on the target Electron version.
- [ ] Validate native cursor-control API and accessibility permission behavior.

## Phase 1 — desktop shell

- [x] Electron main process and React renderer.
- [x] Menu-bar tray and compact popover.
- [x] Explicit session state machine.
- [x] Typed IPC contracts.
- [x] Camera permission boundary and teardown.
- [x] Atomic local preferences.
- [x] Login-start preference wiring.
- [x] Unit tests for lifecycle transitions.
- [ ] Add signed-build verification for login startup.
- [ ] Add a dedicated settings window.

## Phase 2 — camera and vision

- [ ] Camera discovery and selection.
- [ ] MediaPipe Face Landmarker integration.
- [ ] Stable eye/head observation format.
- [ ] Worker-based frame processing.
- [ ] Frame freshness and FPS diagnostics.

## Phase 3 — calibration and gaze estimation

- [x] Nine-point target and held-out validation target definitions.
- [x] Stable sample rejection primitive.
- [x] Explainable regularized regression baseline.
- [x] Held-out training/validation metrics.
- [ ] Interactive calibration UI and display metadata integration.
- [ ] Calibration persistence and invalidation.

## Phase 4+ — input and hardening

- [x] Native adapter contract and pointer safety policy.
- [x] One Euro smoothing primitive.
- [x] Wink, blink rejection and dwell state machines.
- [x] Quality-gated interaction event filtering.
- [ ] Native macOS input adapter.
- [ ] Centralized runtime safety controller integration.
- [ ] Quality state engine with hysteresis.
- [ ] Gesture state machines.
- [ ] Accessibility and extended-session evaluation.
- [ ] Packaging, signing, notarization and updates.
