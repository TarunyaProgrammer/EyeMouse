# Implementation checklist

## Phase 0 — repository and technical validation

- [x] Inspect repository and confirm it was empty.
- [x] Record product truth and constraints in `PRODUCT.md`.
- [x] Document architecture and module responsibilities.
- [x] Record technology decisions and risks.
- [x] Verify MediaPipe Tasks Vision integration and local model/WASM asset packaging.
- [x] Validate native cursor-control API shape and Accessibility permission refusal behavior.

## Phase 1 — desktop shell

- [x] Electron main process and React renderer.
- [x] Menu-bar tray and compact popover.
- [x] Explicit session state machine.
- [x] Typed IPC contracts.
- [x] Camera permission boundary and teardown.
- [x] Atomic local preferences.
- [x] Login-start preference wiring.
- [x] Dedicated settings window for interaction, camera and startup preferences.
- [x] First-run privacy and permission onboarding.
- [x] Unit tests for lifecycle transitions.
- [ ] Add signed-build verification for login startup.

## Phase 2 — camera and vision

- [x] Camera discovery and selection.
- [x] Camera disconnect detection and teardown.
- [x] MediaPipe Face Landmarker integration.
- [x] Stable eye/head observation format.
- [x] Worker-based frame processing.
- [x] Frame freshness and FPS diagnostics in the popover.

## Phase 3 — calibration and gaze estimation

- [x] Nine-point target and held-out validation target definitions.
- [x] Stable sample rejection primitive.
- [x] Explainable regularized regression baseline.
- [x] Held-out training/validation metrics.
- [x] Interactive nine-point calibration window and display metadata integration.
- [x] Calibration persistence and display-geometry invalidation.
- [x] Multi-display enumeration and display-specific calibration targeting.

## Phase 4+ — input and hardening

- [x] Native adapter contract and pointer safety policy.
- [x] One Euro smoothing primitive.
- [x] Wink, blink rejection and dwell state machines.
- [x] Quality-gated interaction event filtering.
- [x] Native macOS input helper and main-process adapter.
- [x] Swift/CoreGraphics input helper compiles and refuses commands without Accessibility permission.
- [x] Centralized runtime safety controller integration for movement.
- [x] Quality state engine with hysteresis.
- [x] Gesture state machines.
- [x] Runtime interaction IPC and diagnostics metrics.
- [ ] Accessibility and extended-session evaluation.
- [x] Unsigned DMG/ZIP packaging with native helper and local model assets.
- [ ] Developer ID signing, notarization and update feed.
