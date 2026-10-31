import { describe, expect, it } from "vitest";
import { SessionCoordinator } from "./session-coordinator";

const calibration = {
  calibrationId: "test",
  displayId: "main",
  validationErrorPx: 40,
  accepted: true,
  model: { featureCount: 13, degree: 1 as const, lambda: 0.01, coefficientsX: Array(14).fill(0), coefficientsY: Array(14).fill(0) },
  screenBounds: { x: 0, y: 0, width: 1000, height: 800, displayId: "main" }
};

describe("SessionCoordinator", () => {
  it("publishes quality transitions and keeps input disabled while lost", () => {
    const coordinator = new SessionCoordinator();
    coordinator.start();
    coordinator.setCameraReady();
    coordinator.completeCalibration(calibration);
    coordinator.setNativeInputAuthorized(true);
    coordinator.setTrackingQuality("good", 40);
    expect(coordinator.getStatus().state).toBe("TRACKING_ACTIVE");
    expect(coordinator.getStatus().inputEnabled).toBe(true);

    coordinator.setTrackingQuality("lost", 40);
    expect(coordinator.getStatus().state).toBe("TRACKING_LOST");
    expect(coordinator.getStatus().inputEnabled).toBe(false);

    coordinator.setTrackingQuality("good", 40);
    expect(coordinator.getStatus().state).toBe("TRACKING_ACTIVE");
  });

  it("allows immediate pause and explicit recalibration from an active session", () => {
    const coordinator = new SessionCoordinator();
    coordinator.start();
    coordinator.setCameraReady();
    coordinator.completeCalibration(calibration);
    expect(coordinator.pause().state).toBe("PAUSED");
    expect(coordinator.getStatus().inputEnabled).toBe(false);
    expect(coordinator.resume().state).toBe("TRACKING_ACTIVE");
    expect(coordinator.beginCalibration().state).toBe("CALIBRATION_REQUIRED");
    expect(coordinator.getStatus().calibrationStatus).toBe("in-progress");
  });
});
