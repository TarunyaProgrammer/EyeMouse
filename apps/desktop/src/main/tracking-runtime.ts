import type { CalibrationResultSummary, EyeTrackingObservation, GazePrediction, InteractionEvent, TrackingQuality, TrackingUpdate } from "@eyemouse/shared-types";
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

  constructor(private readonly coordinator: SessionCoordinator, private readonly pointer: PointerController) {}

  setCalibration(result: CalibrationResultSummary): void {
    this.model = result.accepted ? deserializeRegressionModel(result.model) : null;
    this.calibrationId = result.accepted ? result.calibrationId : null;
    this.screenBounds = result.accepted ? result.screenBounds : null;
    this.validationErrorPx = result.accepted ? result.validationErrorPx : null;
  }

  async processObservation(observation: EyeTrackingObservation): Promise<TrackingUpdate | null> {
    if (!this.model || this.validationErrorPx === null) return null;
    const nowMs = performance.now();
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
    const point = this.model.predict(observation.normalizedFeatures);
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
    if (!safeEvent || safeEvent.type === "PAUSE") return false;
    return this.pointer.execute({ type: safeEvent.type, point: safeEvent.point, timestampMs: safeEvent.timestampMs }, quality);
  }

  async stop(): Promise<void> {
    await this.pointer.stop();
    this.model = null;
    this.calibrationId = null;
    this.screenBounds = null;
    this.validationErrorPx = null;
    this.lastQuality = null;
  }
}
