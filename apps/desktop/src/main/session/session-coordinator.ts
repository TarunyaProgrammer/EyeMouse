import { EventEmitter } from "node:events";
import type {
  CalibrationResultSummary,
  CameraStatus,
  SessionState,
  SessionStatus,
  TrackingQualityState
} from "@eyemouse/shared-types";
import { SessionMachine } from "./session-machine";

export class SessionCoordinator extends EventEmitter {
  private readonly machine = new SessionMachine();
  private cameraStatus: CameraStatus = "not-requested";
  private calibrationStatus: SessionStatus["calibrationStatus"] = "not-started";
  private trackingQuality: TrackingQualityState = "unknown";
  private nativeInputAuthorized = false;
  private estimatedErrorPx: number | null = null;
  private storedCalibration: CalibrationResultSummary | null = null;
  private message = "EyeMouse is idle. Start a session when you are ready.";

  getStatus(): SessionStatus {
    const state = this.machine.state;

    return {
      state,
      cameraStatus: this.cameraStatus,
      calibrationStatus: this.calibrationStatus,
      trackingQuality: this.trackingQuality,
      inputEnabled: this.nativeInputAuthorized && this.trackingQuality !== "lost" && (state === "TRACKING_ACTIVE" || state === "TRACKING_DEGRADED"),
      nativeInputAuthorized: this.nativeInputAuthorized,
      estimatedErrorPx: this.estimatedErrorPx,
      message: this.message,
      updatedAt: Date.now()
    };
  }

  start(): SessionStatus {
    if (this.machine.state === "IDLE" || this.machine.state === "STOPPED") {
      if (this.machine.state === "STOPPED") this.machine.transition("IDLE");
      this.machine.transition("INITIALIZING");
      this.cameraStatus = "not-requested";
      this.calibrationStatus = this.storedCalibration ? "valid" : "not-started";
      this.trackingQuality = "unknown";
      this.estimatedErrorPx = this.storedCalibration?.validationErrorPx ?? null;
      this.message = this.storedCalibration ? "Preparing camera access. A saved calibration will be validated." : "Preparing camera access…";
      return this.publish();
    }

    return this.getStatus();
  }

  stop(): SessionStatus {
    if (this.machine.state !== "IDLE" && this.machine.state !== "STOPPED") {
      this.machine.transition("STOPPED");
    }

    this.cameraStatus = "stopped";
    this.calibrationStatus = this.storedCalibration ? "valid" : "not-started";
    this.trackingQuality = "unknown";
    this.estimatedErrorPx = null;
    this.message = "Session stopped. Camera access is released.";
    return this.publish();
  }

  pause(): SessionStatus {
    if (
      this.machine.state === "TRACKING_ACTIVE" ||
      this.machine.state === "TRACKING_DEGRADED" ||
      this.machine.state === "TRACKING_LOST"
    ) {
      this.machine.transition("PAUSED");
      this.message = "Session paused. No system input will be emitted.";
      return this.publish();
    }

    return this.getStatus();
  }

  resume(): SessionStatus {
    if (this.machine.state === "PAUSED") {
      this.machine.transition("TRACKING_ACTIVE");
      this.message = "Session resumed.";
      return this.publish();
    }

    return this.getStatus();
  }

  setCameraRequesting(): SessionStatus {
    if (this.machine.state !== "INITIALIZING") return this.getStatus();
    this.cameraStatus = "requesting";
    this.message = "Requesting camera access. No cursor input is active.";
    return this.publish();
  }

  setCameraReady(): SessionStatus {
    if (this.machine.state !== "INITIALIZING") return this.getStatus();
    this.machine.transition("CAMERA_READY");
    this.cameraStatus = "ready";
    if (this.storedCalibration) {
      this.machine.transition("TRACKING_ACTIVE");
      this.calibrationStatus = "valid";
      this.message = "Camera ready. Validating the saved calibration before cursor control is enabled.";
    } else {
      this.machine.transition("CALIBRATION_REQUIRED");
      this.calibrationStatus = "required";
      this.message = "Camera ready. Complete calibration before cursor control can be enabled.";
    }
    return this.publish();
  }

  setCameraFailure(reason: string): SessionStatus {
    if (this.machine.state === "INITIALIZING") {
      this.machine.transition("STOPPED");
      this.machine.transition("IDLE");
    }

    this.cameraStatus = reason.toLowerCase().includes("denied") ? "denied" : "unavailable";
    this.message = reason;
    return this.publish();
  }

  beginCalibration(): SessionStatus {
    if (this.machine.state === "TRACKING_ACTIVE" || this.machine.state === "TRACKING_DEGRADED" || this.machine.state === "TRACKING_LOST") this.machine.transition("CALIBRATION_REQUIRED");
    if (this.machine.state === "CALIBRATION_REQUIRED" || this.machine.state === "CAMERA_READY") {
      this.calibrationStatus = "in-progress";
      this.message = "Calibration is in progress. System input remains disabled.";
      return this.publish();
    }
    return this.getStatus();
  }

  completeCalibration(result: CalibrationResultSummary): SessionStatus {
    if (this.machine.state !== "CALIBRATION_REQUIRED" && this.machine.state !== "CAMERA_READY") return this.getStatus();
    this.calibrationStatus = result.accepted ? "valid" : "invalid";
    this.storedCalibration = result.accepted ? result : null;
    this.estimatedErrorPx = result.validationErrorPx;
    if (result.accepted) {
      if (this.machine.state === "CAMERA_READY") this.machine.transition("CALIBRATION_REQUIRED");
      this.machine.transition("TRACKING_ACTIVE");
      this.message = "Calibration valid. Accessibility permission is still required for system input.";
    } else {
      this.message = "Calibration error is too high. Repeat calibration with a steadier head position.";
    }
    return this.publish();
  }

  setNativeInputAuthorized(authorized: boolean): SessionStatus {
    this.nativeInputAuthorized = authorized;
    if (authorized && this.machine.state === "TRACKING_ACTIVE") this.message = "Tracking active. Cursor input is enabled.";
    if (!authorized && this.machine.state === "TRACKING_ACTIVE") this.message = "Calibration valid. Grant Accessibility permission to enable cursor input.";
    return this.publish();
  }

  setTrackingQuality(quality: TrackingQualityState, estimatedErrorPx: number | null): SessionStatus {
    this.trackingQuality = quality;
    this.estimatedErrorPx = estimatedErrorPx;
    if (quality === "lost" && this.machine.state === "TRACKING_ACTIVE") this.message = "Tracking lost. Cursor input is paused until stable tracking returns.";
    if (quality === "degraded" && this.machine.state === "TRACKING_ACTIVE") this.message = "Tracking degraded. Cursor movement is cautious and clicks are suppressed.";
    if (quality === "good" && this.machine.state === "TRACKING_ACTIVE" && this.nativeInputAuthorized) this.message = "Tracking active. Cursor input is enabled.";
    return this.publish();
  }

  setStoredCalibration(result: CalibrationResultSummary | null): void {
    this.storedCalibration = result?.accepted ? result : null;
    if (this.machine.state === "IDLE" || this.machine.state === "STOPPED") {
      this.calibrationStatus = this.storedCalibration ? "valid" : "not-started";
      this.estimatedErrorPx = this.storedCalibration?.validationErrorPx ?? null;
      this.message = this.storedCalibration ? "Saved calibration is ready for the next session." : this.message;
    }
  }

  private publish(): SessionStatus {
    const status = this.getStatus();
    this.emit("status-changed", status);
    return status;
  }
}
