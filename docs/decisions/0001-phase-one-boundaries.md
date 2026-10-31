# ADR 0001: Keep Phase 1 to lifecycle and permission boundaries

## Status

Accepted

## Context

EyeMouse has no existing implementation. The product brief contains several high-risk systems—webcam gaze estimation, calibration, accessibility input injection and gesture safety—that cannot be validated by generating a large set of placeholder modules.

## Decision

Phase 1 implements one vertical slice:

- Electron tray lifecycle.
- React popover.
- Typed preload/main IPC.
- Explicit session state machine.
- Camera permission acquisition and release.
- Atomic local preferences.
- Login-start preference wiring.

It does not claim to implement gaze estimation, calibration, pointer movement, clicks, MediaPipe tracking or tracking-quality confidence.

## Consequences

The first app is intentionally not an MVP for end users. It is a testable shell that establishes the lifecycle and safety boundaries needed before adding irreversible system input. The extra boundary work makes later phases slower to start but prevents UI code from becoming the owner of camera, quality or native-input policy.

## Rejected alternatives

- Building a fake cursor demo first: it would hide calibration and safety failures behind a successful-looking interaction.
- Creating all future packages empty: it would add naming and dependency surface without executable behavior.
- Adding SQLite in Phase 1: preferences do not require queryable storage yet.
