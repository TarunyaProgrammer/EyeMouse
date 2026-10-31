export const SESSION_STATES = [
  "IDLE",
  "INITIALIZING",
  "CAMERA_READY",
  "CALIBRATION_REQUIRED",
  "TRACKING_ACTIVE",
  "TRACKING_DEGRADED",
  "TRACKING_LOST",
  "PAUSED",
  "STOPPED"
] as const;

export type SessionState = (typeof SESSION_STATES)[number];

export type CameraStatus =
  | "not-requested"
  | "requesting"
  | "ready"
  | "denied"
  | "unavailable"
  | "stopped";

export type TrackingQualityState = "unknown" | "good" | "degraded" | "lost";

export type InteractionMode = "dwell" | "wink";

export interface Preferences {
  launchAtLogin: boolean;
  interactionMode: InteractionMode;
  cursorSensitivity: number;
  smoothing: number;
}

export interface SessionStatus {
  state: SessionState;
  cameraStatus: CameraStatus;
  trackingQuality: TrackingQualityState;
  inputEnabled: boolean;
  message: string;
  updatedAt: number;
}

export interface EyeMouseAPI {
  getSessionStatus(): Promise<SessionStatus>;
  startSession(): Promise<SessionStatus>;
  stopSession(): Promise<SessionStatus>;
  pauseSession(): Promise<SessionStatus>;
  resumeSession(): Promise<SessionStatus>;
  setCameraRequesting(): Promise<SessionStatus>;
  setCameraReady(): Promise<SessionStatus>;
  setCameraFailure(reason: string): Promise<SessionStatus>;
  getPreferences(): Promise<Preferences>;
  setPreferences(patch: Partial<Preferences>): Promise<Preferences>;
  onSessionStatusChanged(listener: (status: SessionStatus) => void): () => void;
}
