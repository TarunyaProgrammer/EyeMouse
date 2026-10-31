import { describe, expect, it } from "vitest";
import type { Point2D } from "@eyemouse/shared-types";
import { PointerController, type NativeInputAdapter } from "@eyemouse/pointer-controller";
import { SessionCoordinator } from "./main/session/session-coordinator";
import { TrackingRuntime } from "./main/tracking-runtime";

class FakeInput implements NativeInputAdapter {
  moves: Point2D[] = [];
  async move(point: Point2D): Promise<void> { this.moves.push(point); }
  async click(): Promise<void> {}
  async doubleClick(): Promise<void> {}
  async scroll(): Promise<void> {}
  async dragStart(): Promise<void> {}
  async dragEnd(): Promise<void> {}
  async isAuthorized(): Promise<boolean> { return true; }
}

const observation = (timestampMs: number) => ({
  timestampMs,
  frameId: timestampMs,
  faceVisible: true,
  leftEyeVisible: true,
  rightEyeVisible: true,
  leftEyeOpen: 0.4,
  rightEyeOpen: 0.4,
  normalizedFeatures: Array(13).fill(0),
  headPose: { yaw: 0, pitch: 0, roll: 0 },
  landmarkStability: 0.95
});

describe("TrackingRuntime", () => {
  it("does not move until native input is authorized and quality recovers", async () => {
    const coordinator = new SessionCoordinator();
    coordinator.start();
    coordinator.setCameraReady();
    const model = {
      featureCount: 13 as const,
      degree: 1 as const,
      lambda: 0.01,
      coefficientsX: Array(14).fill(0),
      coefficientsY: Array(14).fill(0)
    };
    const result = {
      calibrationId: "test",
      displayId: "main",
      validationErrorPx: 30,
      accepted: true,
      model,
      screenBounds: { x: 0, y: 0, width: 1000, height: 800, displayId: "main" }
    };
    const input = new FakeInput();
    const runtime = new TrackingRuntime(coordinator, new PointerController(input));
    coordinator.completeCalibration(result);
    runtime.setCalibration(result);

    for (let index = 0; index < 6; index += 1) await runtime.processObservation(observation(performance.now()));
    expect(input.moves).toHaveLength(0);

    coordinator.setNativeInputAuthorized(true);
    for (let index = 0; index < 3; index += 1) await runtime.processObservation(observation(performance.now()));
    expect(input.moves.length).toBeGreaterThan(0);
    expect(coordinator.getStatus().trackingQuality).toBe("good");
  });
});
