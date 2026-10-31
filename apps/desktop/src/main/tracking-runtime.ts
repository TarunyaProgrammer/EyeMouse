import type { CalibrationResultSummary, EyeTrackingObservation, GazePrediction } from "@eyemouse/shared-types";
import { deserializeRegressionModel, type RegressionModel } from "@eyemouse/gaze-estimation";
import { TrackingQualityEngine, type QualityInput } from "@eyemouse/tracking-quality";
import { PointerController } from "@eyemouse/pointer-controller";
import { SessionCoordinator } from "./session/session-coordinator";

export class TrackingRuntime {
  private model: RegressionModel | null = null;
  private validationErrorPx: number | null = null;
  private readonly qualityEngine = new TrackingQualityEngine();

  constructor(private readonly coordinator: SessionCoordinator, private readonly pointer: PointerController) {}

  setCalibration(result: CalibrationResultSummary): void {
    this.model = result.accepted ? deserializeRegressionModel(result.model) : null;
    this.validationErrorPx = result.accepted ? result.validationErrorPx : null;
  }

  async processObservation(observation: EyeTrackingObservation): Promise<void> {
    if (!this.model || this.validationErrorPx === null) return;
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
    this.coordinator.setTrackingQuality(quality.state, quality.estimatedErrorPx);
    if (this.coordinator.getStatus().inputEnabled && quality.state !== "lost") {
      const point = this.model.predict(observation.normalizedFeatures);
      const prediction: GazePrediction = {
        timestampMs: observation.timestampMs,
        point,
        normalizedPoint: { x: point.x, y: point.y },
        estimatedErrorPx: quality.estimatedErrorPx,
        calibrationId: "active"
      };
      await this.pointer.move(prediction.point, quality, prediction.timestampMs);
    }
  }

  async stop(): Promise<void> {
    await this.pointer.stop();
    this.model = null;
    this.validationErrorPx = null;
  }
}
