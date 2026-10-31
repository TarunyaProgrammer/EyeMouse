# Product

<!-- impeccable:product-schema 1 -->

## Platform

macOS desktop

## Stack

delegated: Electron, React, TypeScript, Vite and Vitest, with native macOS adapters introduced only where browser/Electron APIs are insufficient.

## Users

People who need or prefer hands-free computer interaction and want to control macOS using gaze from a built-in or external webcam.

## Product Purpose

EyeMouse is a privacy-first menu-bar utility that estimates screen gaze, moves the macOS pointer, and supports intentional eye-based interaction. Success means users can start and stop a session predictably, understand when tracking is trustworthy, and avoid unsafe clicks when it is not.

## Positioning

EyeMouse treats tracking quality and interaction safety as first-class systems: the vision pipeline estimates gaze, a quality engine decides how much to trust it, and an independent safety layer decides whether system input may be emitted.

## Operating Context

EyeMouse runs unobtrusively from the macOS menu bar. A user starts an explicit session, completes calibration, uses gaze and configured gestures for system-wide interaction, and can pause or stop using an accessible fallback at any time.

## Capabilities and Constraints

- Camera processing is local by default; raw camera footage is not stored or uploaded.
- The initial vision foundation is MediaPipe Face Landmarker, behind an internal observation interface.
- Gaze calibration must use held-out validation targets; face-detection confidence is not gaze accuracy.
- The product must distinguish GOOD, DEGRADED and LOST tracking states with hysteresis.
- System-wide cursor control requires explicit macOS accessibility permission and must remain behind a native adapter.
- The application should be a menu-bar utility with optional login startup, not a permanent full-size window.
- Multi-monitor support, external cameras, calibration drift detection and broad accessibility validation remain implementation work, not achieved capabilities.

## Brand Commitments

- Product name: EyeMouse (subject to future change).
- Voice: clear, calm, direct and honest about uncertainty.
- Visual direction: restrained, premium, macOS-native utility UI; no decorative dashboard noise.

## Evidence on Hand

- Product and engineering master prompt supplied by the user in the attached plan.
- No existing source implementation, assets, measurement dataset or user research were present in the repository at project start.

## Product Principles

1. Precision before feature breadth.
2. Report uncertainty instead of inventing confidence.
3. Restrict risky interactions before restricting useful movement.
4. Keep sensitive processing on-device by default.
5. Build measurable vertical slices instead of speculative abstractions.

## Accessibility & Inclusion

The product is intended for accessibility and hands-free interaction. It must support an emergency pause/fallback path, avoid assuming a single head position or lighting condition, and not claim universal suitability without testing with users with different abilities and input preferences.

## Open Decisions

- Whether wink gestures are enabled by default after user testing.
- Exact safe operating thresholds for pointer movement and clicks.
- Whether the first public release supports Intel Macs in addition to Apple Silicon.
- Whether SQLite is needed after calibration profiles and diagnostics are implemented.
