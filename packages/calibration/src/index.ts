import type { Point2D, ScreenBounds } from "@eyemouse/shared-types";
import type { RegressionModel, RegressionSample, ValidationMetrics } from "@eyemouse/gaze-estimation";
import { calculateValidationMetrics, fitRidgeRegression } from "@eyemouse/gaze-estimation";

export interface CalibrationTarget {
  id: string;
  normalized: Point2D;
  screen: Point2D;
  phase: "fit" | "validation";
}

export function createCalibrationTargets(bounds: ScreenBounds): CalibrationTarget[] {
  const fitCoordinates = [0.08, 0.5, 0.92];
  const targets: CalibrationTarget[] = [];
  let index = 0;
  for (const y of fitCoordinates) {
    for (const x of fitCoordinates) {
      targets.push({ id: `fit-${index++}`, normalized: { x, y }, screen: { x: bounds.x + x * bounds.width, y: bounds.y + y * bounds.height }, phase: "fit" });
    }
  }
  for (const [x, y] of [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75], [0.5, 0.5]]) {
    targets.push({ id: `validation-${index++}`, normalized: { x, y }, screen: { x: bounds.x + x * bounds.width, y: bounds.y + y * bounds.height }, phase: "validation" });
  }
  return targets;
}

export interface CalibrationSample extends RegressionSample {
  targetId: string;
  timestampMs: number;
  stable: boolean;
}

export class StableSampleCollector {
  private readonly samples: CalibrationSample[] = [];

  add(sample: CalibrationSample): boolean {
    if (!sample.stable || sample.features.some((value) => !Number.isFinite(value))) return false;
    this.samples.push(sample);
    return true;
  }

  forTarget(targetId: string): CalibrationSample[] {
    return this.samples.filter((sample) => sample.targetId === targetId);
  }

  all(): CalibrationSample[] {
    return [...this.samples];
  }
}

export interface CalibrationResult {
  id: string;
  model: RegressionModel;
  trainingMetrics: ValidationMetrics;
  validationMetrics: ValidationMetrics;
  screenBounds: ScreenBounds;
  createdAt: number;
}

export function fitCalibration(
  samples: readonly CalibrationSample[],
  bounds: ScreenBounds,
  options: { degree?: 1 | 2; lambda?: number } = {}
): CalibrationResult {
  const fitSamples = samples.filter((sample) => sample.targetId.startsWith("fit-"));
  const validationSamples = samples.filter((sample) => sample.targetId.startsWith("validation-"));
  if (fitSamples.length < 9) throw new Error("Calibration requires samples from all nine fitting targets.");
  if (validationSamples.length < 3) throw new Error("Calibration requires held-out validation samples.");

  const model = fitRidgeRegression(fitSamples, options);
  const scale = { x: 1, y: 1 };
  return {
    id: `calibration-${Date.now()}`,
    model,
    trainingMetrics: calculateValidationMetrics(model, fitSamples, scale),
    validationMetrics: calculateValidationMetrics(model, validationSamples, scale),
    screenBounds: bounds,
    createdAt: Date.now()
  };
}

export function calibrationMeetsThresholds(metrics: ValidationMetrics, thresholdPx: number): boolean {
  return metrics.sampleCount > 0 && Number.isFinite(metrics.percentile95ErrorPx) && metrics.percentile95ErrorPx <= thresholdPx;
}
