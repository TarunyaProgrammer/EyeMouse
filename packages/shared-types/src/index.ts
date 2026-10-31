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
export type WinkAction = "single-click" | "double-click";

export interface Preferences {
  launchAtLogin: boolean;
  onboardingComplete: boolean;
  cameraDeviceId: string | null;
  calibrationDisplayId: string | null;
  interactionMode: InteractionMode;
  winkAction: WinkAction;
  scrollEnabled: boolean;
  cursorSensitivity: number;
  smoothing: number;
}

export interface SessionStatus {
  state: SessionState;
  cameraStatus: CameraStatus;
  calibrationStatus: "not-started" | "required" | "in-progress" | "valid" | "invalid";
  trackingQuality: TrackingQualityState;
  inputEnabled: boolean;
  nativeInputAuthorized: boolean;
  estimatedErrorPx: number | null;
  message: string;
  updatedAt: number;
}

export interface DiagnosticsSnapshot {
  fps: number;
  frameAgeMs: number | null;
  observations: number;
  acceptedInteractions: number;
  suppressedInteractions: number;
  qualityState: TrackingQualityState;
  lastRecoveryRecommendation: string | null;
}

export type UpdateState = "disabled" | "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";

export interface UpdateStatus {
  state: UpdateState;
  version: string | null;
  message: string | null;
}

export interface EyeMouseAPI {
  getSessionStatus(): Promise<SessionStatus>;
  getDiagnostics(): Promise<DiagnosticsSnapshot>;
  getUpdateStatus(): Promise<UpdateStatus>;
  checkForUpdates(): Promise<UpdateStatus>;
  downloadUpdate(): Promise<UpdateStatus>;
  installUpdate(): Promise<void>;
  startSession(): Promise<SessionStatus>;
  stopSession(): Promise<SessionStatus>;
  pauseSession(): Promise<SessionStatus>;
  resumeSession(): Promise<SessionStatus>;
  setCameraRequesting(): Promise<SessionStatus>;
  setCameraReady(): Promise<SessionStatus>;
  setCameraFailure(reason: string): Promise<SessionStatus>;
  openCalibration(displayId?: string): Promise<void>;
  getCalibrationScreen(): Promise<ScreenBounds>;
  getDisplays(): Promise<ScreenBounds[]>;
  completeCalibration(result: CalibrationResultSummary): Promise<SessionStatus>;
  publishObservation(observation: EyeTrackingObservation): Promise<TrackingUpdate | null>;
  publishInteraction(event: InteractionEvent): Promise<boolean>;
  checkNativeInput(): Promise<SessionStatus>;
  openAccessibilitySettings(): Promise<void>;
  openSettings(): Promise<void>;
  getPreferences(): Promise<Preferences>;
  setPreferences(patch: Partial<Preferences>): Promise<Preferences>;
  onSessionStatusChanged(listener: (status: SessionStatus) => void): () => void;
  onUpdateStatusChanged(listener: (status: UpdateStatus) => void): () => void;
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

export interface CalibrationResultSummary {
  calibrationId: string;
  displayId: string;
  validationErrorPx: number;
  accepted: boolean;
  model: CalibrationModelSnapshot;
  screenBounds: ScreenBounds;
}

export interface CalibrationModelSnapshot {
  featureCount: number;
  degree: 1 | 2;
  lambda: number;
  coefficientsX: readonly number[];
  coefficientsY: readonly number[];
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

export interface TrackingUpdate {
  quality: TrackingQuality;
  prediction: GazePrediction | null;
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
  deltaY?: number;
}

export type PointerCommand =
  | { type: "MOVE"; point: Point2D; timestampMs: number }
  | { type: Exclude<InteractionEventType, "PAUSE" | "SCROLL">; point: Point2D | null; timestampMs: number }
  | { type: "SCROLL"; point: Point2D | null; timestampMs: number; deltaY: number };
