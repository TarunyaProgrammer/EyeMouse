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

export interface Point2D {
  x: number;
  y: number;
}

export interface ScreenBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  displayId: string;
}

export interface EyeTrackingObservation {
  timestampMs: number;
  frameId: number;
  faceVisible: boolean;
  leftEyeVisible: boolean;
  rightEyeVisible: boolean;
  leftEyeOpen: number | null;
  rightEyeOpen: number | null;
  normalizedFeatures: readonly number[];
  headPose: {
    yaw: number;
    pitch: number;
    roll: number;
  } | null;
  landmarkStability: number | null;
}

export interface GazePrediction {
  timestampMs: number;
  point: Point2D;
  normalizedPoint: Point2D;
  estimatedErrorPx: number | null;
  calibrationId: string | null;
}

export type QualityReasonCode =
  | "CAMERA_UNAVAILABLE"
  | "STALE_INPUT"
  | "FACE_NOT_VISIBLE"
  | "EYES_NOT_VISIBLE"
  | "LANDMARK_UNSTABLE"
  | "HEAD_POSE_UNSTABLE"
  | "CALIBRATION_INVALID"
  | "GAZE_ERROR_UNKNOWN"
  | "GAZE_ERROR_HIGH"
  | "GESTURE_UNCERTAIN";

export interface TrackingQuality {
  state: "good" | "degraded" | "lost";
  faceVisible: boolean;
  eyesVisible: boolean;
  landmarkStability: number | null;
  headPoseStability: number | null;
  gazeConfidence: number | null;
  estimatedErrorPx: number | null;
  calibrationValid: boolean;
  inputFresh: boolean;
  reasonCodes: readonly QualityReasonCode[];
  recoveryRecommendation: string;
}

export type InteractionEventType =
  | "LEFT_CLICK"
  | "RIGHT_CLICK"
  | "DOUBLE_CLICK"
  | "DWELL_CLICK"
  | "DRAG_START"
  | "DRAG_END"
  | "SCROLL"
  | "PAUSE";

export interface InteractionEvent {
  type: InteractionEventType;
  timestampMs: number;
  confidence: number;
  source: "left-wink" | "right-wink" | "dwell" | "keyboard" | "unknown";
  point: Point2D | null;
}

export type PointerCommand =
  | { type: "MOVE"; point: Point2D; timestampMs: number }
  | { type: Exclude<InteractionEventType, "PAUSE">; point: Point2D | null; timestampMs: number };
