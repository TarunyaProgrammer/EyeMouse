import type { SessionState } from "@eyemouse/shared-types";

const LEGAL_TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
  IDLE: ["INITIALIZING"],
  INITIALIZING: ["CAMERA_READY", "STOPPED"],
  CAMERA_READY: ["CALIBRATION_REQUIRED", "TRACKING_ACTIVE", "STOPPED"],
  CALIBRATION_REQUIRED: ["TRACKING_ACTIVE", "STOPPED"],
  TRACKING_ACTIVE: ["TRACKING_DEGRADED", "TRACKING_LOST", "CALIBRATION_REQUIRED", "PAUSED", "STOPPED"],
  TRACKING_DEGRADED: ["TRACKING_ACTIVE", "TRACKING_LOST", "CALIBRATION_REQUIRED", "PAUSED", "STOPPED"],
  TRACKING_LOST: ["TRACKING_ACTIVE", "CALIBRATION_REQUIRED", "PAUSED", "STOPPED"],
  PAUSED: ["TRACKING_ACTIVE", "STOPPED"],
  STOPPED: ["IDLE", "INITIALIZING"]
};

export class InvalidSessionTransitionError extends Error {
  constructor(from: SessionState, to: SessionState) {
    super(`Illegal session transition: ${from} -> ${to}`);
    this.name = "InvalidSessionTransitionError";
  }
}

export class SessionMachine {
  private currentState: SessionState = "IDLE";

  get state(): SessionState {
    return this.currentState;
  }

  canTransitionTo(nextState: SessionState): boolean {
    return LEGAL_TRANSITIONS[this.currentState].includes(nextState);
  }

  transition(nextState: SessionState): SessionState {
    if (!this.canTransitionTo(nextState)) {
      throw new InvalidSessionTransitionError(this.currentState, nextState);
    }

    this.currentState = nextState;
    return this.currentState;
  }
}
