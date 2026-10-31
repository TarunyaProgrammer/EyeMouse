# Manual macOS acceptance protocol

This protocol is required before calling a signed release production-ready. Record the macOS version, Mac model, chip, camera, display arrangement and EyeMouse commit alongside the results.

## Signed installation and startup

1. Install the signed DMG on a clean user account.
2. Open EyeMouse and confirm the menu-bar item appears without a Gatekeeper warning.
3. Open Settings, enable Launch at login, and confirm the readback says `Electron reports startup as enabled`.
4. Log out and log back in. Confirm the menu-bar item appears without opening a foreground window.
5. Disable Launch at login and repeat the check after the next login.
6. Run `scripts/verify-macos-app.sh` against the installed `.app` bundle.

Pass evidence: valid Developer ID signature, successful Gatekeeper assessment, correct startup behavior in both enabled and disabled cases.

## Permissions and failure recovery

1. Deny camera permission. Start a session and confirm no native input is emitted and the UI gives a recovery instruction.
2. Grant camera permission and repeat the session.
3. Disconnect the camera during tracking. Confirm the stream is released, the session stops safely and the cursor does not move afterward.
4. With Accessibility disabled, confirm the native helper reports `authorized: false` and all move/click/drag/scroll commands are refused.
5. Grant Accessibility, re-check permission, and confirm only a calibrated, good-quality session can move the cursor.
6. Trigger Pause immediately during active movement. Confirm movement and interactions stop, then verify Resume requires stable tracking again.

## Precision and interaction matrix

For each display and camera setup, complete calibration and record held-out validation error, frame rate, frame age and suppressed/accepted interactions from Diagnostics.

- 30 minutes of normal gaze movement: no unexplained camera teardown or growing frame age.
- 100 deliberate single clicks: zero clicks while quality is degraded or lost.
- 100 ordinary bilateral blinks: zero clicks.
- 20 double-click actions, 20 drag actions and 20 edge-scroll actions: record missed and extra actions separately.
- Three temporary face occlusions: cursor movement stops after loss and resumes only after recovery hysteresis.
- Two display configurations: the calibrated display receives the pointer, and geometry changes invalidate the old profile.

Record memory at start and end. A release fails this protocol if the process grows continuously, emits input during lost tracking, or cannot recover without restarting.

## Evidence bundle

Attach the signed app verification output, Diagnostics screenshots or exported notes, validation metrics, false-action counts, OS/device details and any crash logs to the release record. Do not attach camera frames or identifiable facial recordings.
