import { EventEmitter } from "node:events";
import type {
  CameraStatus,
  SessionState,
  SessionStatus,
  TrackingQualityState
} from "@eyemouse/shared-types";
import { SessionMachine } from "./session-machine";

export class SessionCoordinator extends EventEmitter {
  private readonly machine = new SessionMachine();
  private cameraStatus: CameraStatus = "not-requested";
  private trackingQuality: TrackingQualityState = "unknown";
  private message = "EyeMouse is idle. Start a session when you are ready.";

  getStatus(): SessionStatus {
    const state = this.machine.state;

    return {
      state,
      cameraStatus: this.cameraStatus,
      trackingQuality: this.trackingQuality,
      inputEnabled: state === "TRACKING_ACTIVE" || state === "TRACKING_DEGRADED",
      message: this.message,
      updatedAt: Date.now()
    };
  }

  start(): SessionStatus {
    if (this.machine.state === "IDLE" || this.machine.state === "STOPPED") {
      if (this.machine.state === "STOPPED") this.machine.transition("IDLE");
      this.machine.transition("INITIALIZING");
      this.cameraStatus = "not-requested";
      this.trackingQuality = "unknown";
      this.message = "Preparing camera access…";
      return this.publish();
    }

    return this.getStatus();
  }

  stop(): SessionStatus {
    if (this.machine.state !== "IDLE" && this.machine.state !== "STOPPED") {
      this.machine.transition("STOPPED");
    }

    this.cameraStatus = "stopped";
    this.trackingQuality = "unknown";
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
    this.message = "Camera ready. Gaze processing is the next implementation phase.";
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

  private publish(): SessionStatus {
    const status = this.getStatus();
    this.emit("status-changed", status);
    return status;
  }
}
