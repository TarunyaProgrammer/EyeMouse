# Technical risk register

| Risk | Impact | Current mitigation | Exit evidence |
| --- | --- | --- | --- |
| Webcam gaze error is too high for reliable screen control | Product may be unusable or unsafe | Start with held-out calibration validation and honest unknown metrics | Per-user screen-space error and false-click measurements |
| Browser/Electron camera capture adds latency or blocks UI | Poor responsiveness and unstable sessions | Camera access is isolated behind `CameraManager`; vision uses a bounded worker queue and runtime frame-age diagnostics | Measured frame age and p95 end-to-end latency |
| macOS accessibility permission and event injection differ across packaging modes | Cursor control fails outside development | Native input remains an adapter; unsigned DMG/ZIP packaging has been validated; no fake cursor implementation | Signed/notarized integration build with permission checks |
| Natural blinking triggers clicks | Destructive unintended actions | Gesture engine must use temporal state, cooldowns and quality gating | False-click rate per active hour across users |
| Head movement invalidates calibration | Cursor drift and inaccurate clicks | Store display metadata and add drift/recalibration signals | Error after controlled head movement |
| Multi-monitor coordinate transforms are wrong | Cursor moves to wrong display or edge | Keep display geometry in calibration metadata | Automated geometry tests plus manual monitor matrix |
| Electron renderer compromise exposes camera or native capabilities | Privacy/security incident | Context isolation, no Node integration, narrow IPC contracts | Security review and packaged smoke tests |
| Dependency/native packaging churn | Build and distribution delays | Keep Phase 1 dependency-light and defer native modules | Reproducible signed build on supported macOS |

## Known limitations of this slice

- `CAMERA_READY` means only that the camera stream was acquired; it does not mean eyes are tracked.
- The login-item preference is wired through Electron's API but has not been verified in a signed/notarized artifact.
- Calibration and preferences are persisted locally, but there is no cloud sync by design.
- No automatic update feed is configured yet.
- Multi-monitor selection and display-specific calibration are implemented, but a physical monitor-matrix evaluation is still required.
