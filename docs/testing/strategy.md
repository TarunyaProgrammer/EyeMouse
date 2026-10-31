# Testing strategy

## Deterministic tests first

Keep safety and numerical behavior testable without a camera or a live cursor.

- Session transition tests cover legal and illegal lifecycle changes.
- Calibration tests will use recorded feature observations and known screen targets.
- Gesture tests will use frame sequences for blink, wink, ambiguity, cooldown and loss cases.
- Tracking-quality tests will use replay fixtures with controlled jitter, stale frames and visibility changes.
- Pointer safety tests will assert that unsafe commands are rejected before reaching a native adapter.

## Integration tests

Electron integration tests should cover preload exposure, IPC validation, preference persistence, camera teardown and session shutdown. These tests should use fake camera/native adapters and must not inject real system input.

## Manual evaluation matrix

After the vision pipeline exists, evaluate representative combinations of lighting, camera placement, glasses, head orientation, display geometry, blink frequency and temporary occlusion. Record screen-space error, false clicks per active hour, recovery time and end-to-end latency. Do not report accuracy without held-out targets.

## Privacy rule for fixtures

Do not commit raw camera frames or identifiable facial recordings. Prefer synthetic feature sequences or explicitly consented, privacy-safe observations with documented provenance.
