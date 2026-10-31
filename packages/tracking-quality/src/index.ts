import type { QualityReasonCode, TrackingQuality } from "@eyemouse/shared-types";

export interface QualityInput {
  nowMs: number;
  timestampMs: number;
  cameraConnected: boolean;
  faceVisible: boolean;
  eyesVisible: boolean;
  landmarkStability: number | null;
  headPoseStability: number | null;
  estimatedErrorPx: number | null;
  calibrationValid: boolean;
  gestureConfidence: number | null;
}

export interface QualityThresholds {
  maxInputAgeMs: number;
  minimumLandmarkStability: number;
  minimumHeadPoseStability: number;
  maximumGoodErrorPx: number;
  maximumDegradedErrorPx: number;
  minimumGestureConfidence: number;
  degradedFrames: number;
  recoveryFrames: number;
  lostFrames: number;
}

const DEFAULT_THRESHOLDS: QualityThresholds = {
  maxInputAgeMs: 150,
  minimumLandmarkStability: 0.58,
  minimumHeadPoseStability: 0.55,
  maximumGoodErrorPx: 80,
  maximumDegradedErrorPx: 180,
  minimumGestureConfidence: 0.72,
  degradedFrames: 3,
  recoveryFrames: 5,
  lostFrames: 3
};

export class TrackingQualityEngine {
  private state: TrackingQuality["state"] = "lost";
  private degradedCount = 0;
  private recoveryCount = 0;
  private lostCount = 0;
  private readonly thresholds: QualityThresholds;

  constructor(thresholds: Partial<QualityThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  evaluate(input: QualityInput): TrackingQuality {
    const inputFresh = input.nowMs - input.timestampMs <= this.thresholds.maxInputAgeMs;
    const reasons: QualityReasonCode[] = [];
    if (!input.cameraConnected) reasons.push("CAMERA_UNAVAILABLE");
    if (!inputFresh) reasons.push("STALE_INPUT");
    if (!input.faceVisible) reasons.push("FACE_NOT_VISIBLE");
    if (input.faceVisible && !input.eyesVisible) reasons.push("EYES_NOT_VISIBLE");
    if (input.landmarkStability !== null && input.landmarkStability < this.thresholds.minimumLandmarkStability) reasons.push("LANDMARK_UNSTABLE");
    if (input.headPoseStability !== null && input.headPoseStability < this.thresholds.minimumHeadPoseStability) reasons.push("HEAD_POSE_UNSTABLE");
    if (!input.calibrationValid) reasons.push("CALIBRATION_INVALID");
    if (input.estimatedErrorPx === null) reasons.push("GAZE_ERROR_UNKNOWN");
    else if (input.estimatedErrorPx > this.thresholds.maximumDegradedErrorPx) reasons.push("GAZE_ERROR_HIGH");
    if (input.gestureConfidence !== null && input.gestureConfidence < this.thresholds.minimumGestureConfidence) reasons.push("GESTURE_UNCERTAIN");

    const immediateLost = !input.cameraConnected || !inputFresh;
    const missingFace = !input.faceVisible || !input.eyesVisible;
    const hardDegraded = reasons.includes("GAZE_ERROR_HIGH") || reasons.includes("LANDMARK_UNSTABLE") || reasons.includes("HEAD_POSE_UNSTABLE");
    const hasGoodSignals = input.cameraConnected && inputFresh && input.faceVisible && input.eyesVisible && input.calibrationValid && input.estimatedErrorPx !== null && input.estimatedErrorPx <= this.thresholds.maximumGoodErrorPx && (input.landmarkStability ?? 0) >= this.thresholds.minimumLandmarkStability && (input.headPoseStability ?? 0) >= this.thresholds.minimumHeadPoseStability;

    if (immediateLost) {
      this.state = "lost";
      this.resetCounters();
    } else if (missingFace) {
      this.lostCount += 1;
      this.recoveryCount = 0;
      if (this.lostCount >= this.thresholds.lostFrames) this.state = "lost";
    } else if (hardDegraded || !input.calibrationValid || input.estimatedErrorPx === null) {
      this.degradedCount += 1;
      this.recoveryCount = 0;
      if (this.degradedCount >= this.thresholds.degradedFrames && this.state !== "lost") this.state = "degraded";
      if (this.state === "lost" && this.lostCount < this.thresholds.lostFrames) this.state = "degraded";
    } else if (hasGoodSignals) {
      this.recoveryCount += 1;
      this.degradedCount = 0;
      this.lostCount = 0;
      if (this.recoveryCount >= this.thresholds.recoveryFrames) this.state = "good";
    }

    const recoveryRecommendation = reasons.includes("STALE_INPUT") || reasons.includes("CAMERA_UNAVAILABLE")
      ? "Check that the camera is connected, then start the session again."
      : reasons.includes("FACE_NOT_VISIBLE") || reasons.includes("EYES_NOT_VISIBLE")
        ? "Move closer and keep both eyes visible to the camera."
        : reasons.includes("CALIBRATION_INVALID") || reasons.includes("GAZE_ERROR_HIGH")
          ? "Recalibrate or return to the position used during calibration."
          : reasons.includes("LANDMARK_UNSTABLE") || reasons.includes("HEAD_POSE_UNSTABLE")
            ? "Keep your head steady briefly while tracking recovers."
            : "Tracking is stable.";

    return {
      state: this.state,
      faceVisible: input.faceVisible,
      eyesVisible: input.eyesVisible,
      landmarkStability: input.landmarkStability,
      headPoseStability: input.headPoseStability,
      gazeConfidence: input.estimatedErrorPx === null ? null : Math.max(0, 1 - input.estimatedErrorPx / this.thresholds.maximumDegradedErrorPx),
      estimatedErrorPx: input.estimatedErrorPx,
      calibrationValid: input.calibrationValid,
      inputFresh,
      reasonCodes: reasons,
      recoveryRecommendation
    };
  }

  private resetCounters(): void {
    this.degradedCount = 0;
    this.recoveryCount = 0;
    this.lostCount = 0;
  }
}
