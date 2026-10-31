# Data handling

EyeMouse acquires a live camera stream only after the user starts a session and releases every track when the session stops, the camera disconnects or camera initialization fails. Face landmarks are processed in the local worker and are not uploaded or persisted. Calibration persistence stores only the fitted regression coefficients, screen geometry, validation error and profile identifier; it does not store camera frames or raw landmark recordings.

Preferences and calibration profiles are stored locally in the Electron user-data directory as separate JSON files using atomic replacement for writes. Calibration profiles are invalidated when the selected display ID or geometry changes. There is no cloud sync or remote telemetry in the current product slice.
