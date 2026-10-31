import { describe, expect, it } from "vitest";
import { calibrationMeetsThresholds, createCalibrationTargets, fitCalibration } from "@eyemouse/calibration";
import { calculateValidationMetrics, fitRidgeRegression } from "@eyemouse/gaze-estimation";
import { DwellRecognizer, ScrollRecognizer, WinkRecognizer, filterInteractionEvent } from "@eyemouse/interaction-engine";
import { OneEuroFilter } from "@eyemouse/pointer-controller";
import { TrackingQualityEngine } from "@eyemouse/tracking-quality";
import { estimateTemporalStability } from "@eyemouse/vision";

describe("gaze estimation", () => {
  it("fits an explainable linear mapping", () => {
    const model = fitRidgeRegression([
      { features: [0], target: { x: 1, y: 2 } },
      { features: [1], target: { x: 3, y: 5 } },
      { features: [2], target: { x: 5, y: 8 } }
    ], { degree: 1, lambda: 1e-9 });
    expect(model.predict([3]).x).toBeCloseTo(7, 3);
    expect(model.predict([3]).y).toBeCloseTo(11, 3);
  });

  it("reports validation separately from training", () => {
    const model = fitRidgeRegression([
      { features: [0], target: { x: 0, y: 0 } },
      { features: [1], target: { x: 10, y: 10 } },
      { features: [2], target: { x: 20, y: 20 } }
    ], { degree: 1, lambda: 1e-9 });
    const metrics = calculateValidationMetrics(model, [{ features: [3], target: { x: 30, y: 30 } }]);
    expect(metrics.sampleCount).toBe(1);
    expect(metrics.meanErrorPx).toBeLessThan(0.01);
  });
});

describe("calibration", () => {
  it("creates nine fit targets and separate validation targets", () => {
    const targets = createCalibrationTargets({ x: 0, y: 0, width: 1000, height: 800, displayId: "main" });
    expect(targets.filter((target) => target.phase === "fit")).toHaveLength(9);
    expect(targets.filter((target) => target.phase === "validation")).toHaveLength(5);
  });

  it("does not accept a calibration without held-out validation", () => {
    const bounds = { x: 0, y: 0, width: 1000, height: 800, displayId: "main" };
    const samples = Array.from({ length: 9 }, (_, index) => ({
      targetId: `fit-${index}`,
      timestampMs: index,
      stable: true,
      features: [index / 9],
      target: { x: index, y: index }
    }));
    expect(() => fitCalibration(samples, bounds)).toThrow(/held-out/);
  });

  it("uses explicit threshold checks", () => {
    expect(calibrationMeetsThresholds({ sampleCount: 2, meanErrorPx: 10, medianErrorPx: 10, percentile95ErrorPx: 30, maxErrorPx: 40 }, 35)).toBe(true);
    expect(calibrationMeetsThresholds({ sampleCount: 2, meanErrorPx: 10, medianErrorPx: 10, percentile95ErrorPx: 40, maxErrorPx: 40 }, 35)).toBe(false);
  });
});

describe("tracking quality", () => {
  const goodInput = (nowMs: number) => ({
    nowMs, timestampMs: nowMs, cameraConnected: true, faceVisible: true, eyesVisible: true,
    landmarkStability: 0.9, headPoseStability: 0.9, estimatedErrorPx: 30, calibrationValid: true, gestureConfidence: 0.9
  });

  it("requires recovery hysteresis before becoming good", () => {
    const engine = new TrackingQualityEngine({ recoveryFrames: 3 });
    expect(engine.evaluate(goodInput(0)).state).toBe("lost");
    expect(engine.evaluate(goodInput(20)).state).toBe("lost");
    expect(engine.evaluate(goodInput(40)).state).toBe("good");
  });

  it("immediately loses trust for stale input", () => {
    const engine = new TrackingQualityEngine({ recoveryFrames: 1 });
    expect(engine.evaluate(goodInput(0)).state).toBe("good");
    expect(engine.evaluate({ ...goodInput(1000), timestampMs: 0 }).state).toBe("lost");
  });

  it("keeps a long stable replay healthy and recovers after temporary loss", () => {
    const engine = new TrackingQualityEngine({ recoveryFrames: 5, lostFrames: 3 });
    let state = "lost";
    for (let index = 0; index < 120; index += 1) state = engine.evaluate(goodInput(index * 33)).state;
    expect(state).toBe("good");
    expect(engine.evaluate({ ...goodInput(120 * 33), faceVisible: false, eyesVisible: false }).state).toBe("good");
    expect(engine.evaluate({ ...goodInput(121 * 33), faceVisible: false, eyesVisible: false }).state).toBe("good");
    expect(engine.evaluate({ ...goodInput(122 * 33), faceVisible: false, eyesVisible: false }).state).toBe("lost");
    for (let index = 123; index < 128; index += 1) state = engine.evaluate(goodInput(index * 33)).state;
    expect(state).toBe("good");
  });
});

describe("vision stability", () => {
  it("distinguishes stable landmarks from frame jitter", () => {
    expect(estimateTemporalStability([0.1, 0.2], [0.1, 0.2])).toBe(1);
    expect(estimateTemporalStability([0.1, 0.2], [0.12, 0.21])).toBeGreaterThan(0.7);
    expect(estimateTemporalStability([0.1, 0.2], [0.5, 0.6])).toBe(0);
  });
});

describe("interaction safety", () => {
  const observation = (timestampMs: number, leftEyeOpen: number, rightEyeOpen: number) => ({
    timestampMs, leftEyeOpen, rightEyeOpen, qualityState: "good" as const, point: { x: 10, y: 10 }, fixationStable: true
  });

  it("rejects ordinary bilateral blinks", () => {
    const wink = new WinkRecognizer();
    expect(wink.observe(observation(0, 0.1, 0.1))).toHaveLength(0);
    expect(wink.observe(observation(200, 0.8, 0.8))).toHaveLength(0);
  });

  it("recognizes a deliberate unilateral wink", () => {
    const wink = new WinkRecognizer();
    expect(wink.observe(observation(0, 0.1, 0.8))).toHaveLength(0);
    const events = wink.observe(observation(180, 0.8, 0.8));
    expect(events[0]?.type).toBe("LEFT_CLICK");
  });

  it("maps a prolonged unilateral wink to drag start and release", () => {
    const wink = new WinkRecognizer({ dragHoldMs: 300 });
    expect(wink.observe(observation(0, 0.1, 0.8))).toHaveLength(0);
    expect(wink.observe(observation(320, 0.1, 0.8))[0]?.type).toBe("DRAG_START");
    expect(wink.observe(observation(500, 0.8, 0.8))[0]?.type).toBe("DRAG_END");
  });

  it("supports an explicitly configured double-click wink", () => {
    const wink = new WinkRecognizer({}, "double-click");
    expect(wink.observe(observation(0, 0.1, 0.8))).toHaveLength(0);
    expect(wink.observe(observation(180, 0.8, 0.8))[0]?.type).toBe("DOUBLE_CLICK");
  });

  it("scrolls only after an intentional edge fixation", () => {
    const scroll = new ScrollRecognizer({ durationMs: 100 });
    const edgeObservation = { ...observation(0, 0.8, 0.8), normalizedPoint: { x: 0.5, y: 0.02 } };
    expect(scroll.observe(edgeObservation)).toHaveLength(0);
    expect(scroll.observe({ ...edgeObservation, timestampMs: 120 })[0]?.deltaY).toBe(-1);
    expect(scroll.observe({ ...edgeObservation, timestampMs: 200 })).toHaveLength(0);
  });

  it("requires stable fixation for dwell", () => {
    const dwell = new DwellRecognizer({ durationMs: 100 });
    expect(dwell.observe({ ...observation(0, 0.8, 0.8), fixationStable: true })).toHaveLength(0);
    expect(dwell.observe({ ...observation(120, 0.8, 0.8), fixationStable: true })[0]?.type).toBe("DWELL_CLICK");
  });

  it("suppresses clicks outside the safe quality envelope", () => {
    const event = { type: "LEFT_CLICK" as const, timestampMs: 1, confidence: 0.9, source: "left-wink" as const, point: { x: 1, y: 1 } };
    expect(filterInteractionEvent(event, "degraded", 60)).toBeNull();
    expect(filterInteractionEvent(event, "good", 60)).not.toBeNull();
  });

  it("smooths a pointer signal without claiming calibration accuracy", () => {
    const filter = new OneEuroFilter(1, 0.02);
    const first = filter.filter(100, 0);
    const second = filter.filter(120, 16);
    expect(first).toBe(100);
    expect(second).toBeGreaterThan(100);
    expect(second).toBeLessThan(120);
  });
});
