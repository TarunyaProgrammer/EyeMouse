import type { CalibrationResultSummary, DiagnosticsSnapshot, EyeTrackingObservation, GazePrediction, InteractionEvent, Preferences, TrackingQuality, TrackingUpdate } from "@eyemouse/shared-types";
import { deserializeRegressionModel, type RegressionModel } from "@eyemouse/gaze-estimation";
import { TrackingQualityEngine, type QualityInput } from "@eyemouse/tracking-quality";
import { PointerController } from "@eyemouse/pointer-controller";
import { filterInteractionEvent } from "@eyemouse/interaction-engine";
import { SessionCoordinator } from "./session/session-coordinator";

export class TrackingRuntime {
  private model: RegressionModel | null = null;
  private calibrationId: string | null = null;
  private screenBounds: CalibrationResultSummary["screenBounds"] | null = null;
  private validationErrorPx: number | null = null;
  private lastQuality: TrackingQuality | null = null;
  private readonly qualityEngine = new TrackingQualityEngine();
  private cursorSensitivity = 1;
  private readonly frameTimes: number[] = [];
  private lastObservationAt: number | null = null;
  private observationCount = 0;
  private acceptedInteractions = 0;
  private suppressedInteractions = 0;

  constructor(private readonly coordinator: SessionCoordinator, private readonly pointer: PointerController) {}

  setCalibration(result: CalibrationResultSummary): void {
    this.model = result.accepted ? deserializeRegressionModel(result.model) : null;
    this.calibrationId = result.accepted ? result.calibrationId : null;
    this.screenBounds = result.accepted ? result.screenBounds : null;
    this.validationErrorPx = result.accepted ? result.validationErrorPx : null;
  }

  setPreferences(preferences: Preferences): void {
    this.cursorSensitivity = preferences.cursorSensitivity;
    this.pointer.setSmoothing(preferences.smoothing);
  }

  async processObservation(observation: EyeTrackingObservation): Promise<TrackingUpdate | null> {
    if (!this.model || this.validationErrorPx === null) return null;
    const nowMs = performance.now();
    this.lastObservationAt = nowMs;
    this.observationCount += 1;
    this.frameTimes.push(nowMs);
    while (this.frameTimes.length > 0 && nowMs - this.frameTimes[0] > 1000) this.frameTimes.shift();
    const qualityInput: QualityInput = {
      nowMs,
      timestampMs: observation.timestampMs,
      cameraConnected: true,
      faceVisible: observation.faceVisible,
      eyesVisible: observation.leftEyeVisible && observation.rightEyeVisible,
      landmarkStability: observation.landmarkStability,
      headPoseStability: observation.headPose ? Math.max(0, 1 - Math.min(1, Math.abs(observation.headPose.yaw) + Math.abs(observation.headPose.pitch))) : null,
      estimatedErrorPx: this.validationErrorPx,
      calibrationValid: true,
      gestureConfidence: null
    };
    const quality = this.qualityEngine.evaluate(qualityInput);
    this.lastQuality = quality;
    this.coordinator.setTrackingQuality(quality.state, quality.estimatedErrorPx);
    if (quality.state === "lost") await this.pointer.stop();
    const point = this.applySensitivity(this.model.predict(observation.normalizedFeatures));
    const bounds = this.screenBounds;
    const normalizedPoint = bounds
      ? { x: (point.x - bounds.x) / bounds.width, y: (point.y - bounds.y) / bounds.height }
      : { x: point.x, y: point.y };
    const prediction: GazePrediction = {
      timestampMs: observation.timestampMs,
      point,
      normalizedPoint,
      estimatedErrorPx: quality.estimatedErrorPx,
      calibrationId: this.calibrationId
    };
    if (this.coordinator.getStatus().inputEnabled && quality.state !== "lost") {
      await this.pointer.move(prediction.point, quality, prediction.timestampMs);
      return { quality, prediction };
    }
    return { quality, prediction };
  }

  async processInteraction(event: InteractionEvent): Promise<boolean> {
    const quality = this.lastQuality;
    if (!quality) return false;
    const safeEvent = filterInteractionEvent(event, quality.state, quality.estimatedErrorPx);
    if (!safeEvent || safeEvent.type === "PAUSE") {
      this.suppressedInteractions += 1;
      return false;
    }
    const command = safeEvent.type === "SCROLL"
      ? { type: "SCROLL" as const, point: safeEvent.point, timestampMs: safeEvent.timestampMs, deltaY: safeEvent.deltaY ?? -1 }
      : { type: safeEvent.type, point: safeEvent.point, timestampMs: safeEvent.timestampMs };
    const executed = await this.pointer.execute(command, quality);
    if (executed) this.acceptedInteractions += 1;
    else this.suppressedInteractions += 1;
    return executed;
  }

  getDiagnostics(): DiagnosticsSnapshot {
    const nowMs = performance.now();
    while (this.frameTimes.length > 0 && nowMs - this.frameTimes[0] > 1000) this.frameTimes.shift();
    return {
      fps: this.frameTimes.length,
      frameAgeMs: this.lastObservationAt === null ? null : Math.max(0, nowMs - this.lastObservationAt),
      observations: this.observationCount,
      acceptedInteractions: this.acceptedInteractions,
      suppressedInteractions: this.suppressedInteractions,
      qualityState: this.lastQuality?.state ?? "unknown",
      lastRecoveryRecommendation: this.lastQuality?.recoveryRecommendation ?? null
    };
  }

  async stop(): Promise<void> {
    await this.pointer.stop();
    // Keep the validated profile for the next explicit session start. Stopping
    // must disable input, not force a returning user through calibration again.
    this.lastQuality = null;
    this.frameTimes.length = 0;
    this.lastObservationAt = null;
    this.observationCount = 0;
    this.acceptedInteractions = 0;
    this.suppressedInteractions = 0;
  }

  private applySensitivity(point: { x: number; y: number }): { x: number; y: number } {
    const bounds = this.screenBounds;
    if (!bounds || this.cursorSensitivity === 1) return point;
    return {
      x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, bounds.x + bounds.width / 2 + (point.x - bounds.x - bounds.width / 2) * this.cursorSensitivity)),
      y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, bounds.y + bounds.height / 2 + (point.y - bounds.y - bounds.height / 2) * this.cursorSensitivity))
    };
  }
}
