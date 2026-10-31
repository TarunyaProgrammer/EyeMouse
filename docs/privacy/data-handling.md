# Data handling

The Phase 1 shell acquires a live camera stream only after the user starts a session and releases every track when the session stops or camera initialization fails. No camera frame, landmark, biometric template or calibration sample is persisted by this slice.

Preferences are stored locally in the Electron user-data directory as JSON. The file contains interaction settings only. Future calibration storage must minimize facial data, use display metadata deliberately, and document retention and invalidation behavior before implementation.
