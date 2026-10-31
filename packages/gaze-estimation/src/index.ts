import type { Point2D } from "@eyemouse/shared-types";

export interface RegressionSample {
  features: readonly number[];
  target: Point2D;
}

export interface RegressionModel {
  readonly featureCount: number;
  readonly degree: 1 | 2;
  readonly lambda: number;
  readonly coefficientsX: readonly number[];
  readonly coefficientsY: readonly number[];
  predict(features: readonly number[]): Point2D;
}

function polynomialFeatures(features: readonly number[], degree: 1 | 2): number[] {
  const result = [1, ...features];
  if (degree === 2) {
    for (let i = 0; i < features.length; i += 1) {
      for (let j = i; j < features.length; j += 1) result.push(features[i] * features[j]);
    }
  }
  return result;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const augmented = matrix.map((row, i) => [...row, vector[i]]);

  for (let pivot = 0; pivot < n; pivot += 1) {
    let largest = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[largest][pivot])) largest = row;
    }
    if (Math.abs(augmented[largest][pivot]) < 1e-10) throw new Error("Regression matrix is singular.");
    [augmented[pivot], augmented[largest]] = [augmented[largest], augmented[pivot]];

    const pivotValue = augmented[pivot][pivot];
    for (let col = pivot; col <= n; col += 1) augmented[pivot][col] /= pivotValue;
    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let col = pivot; col <= n; col += 1) augmented[row][col] -= factor * augmented[pivot][col];
    }
  }

  return augmented.map((row) => row[n]);
}

function fitTarget(design: number[][], targets: number[], lambda: number): number[] {
  const width = design[0].length;
  const normal = Array.from({ length: width }, () => Array<number>(width).fill(0));
  const rhs = Array<number>(width).fill(0);

  for (let row = 0; row < design.length; row += 1) {
    for (let i = 0; i < width; i += 1) {
      rhs[i] += design[row][i] * targets[row];
      for (let j = 0; j < width; j += 1) normal[i][j] += design[row][i] * design[row][j];
    }
  }
  for (let i = 1; i < width; i += 1) normal[i][i] += lambda;
  return solveLinearSystem(normal, rhs);
}

export function fitRidgeRegression(
  samples: readonly RegressionSample[],
  options: { degree?: 1 | 2; lambda?: number } = {}
): RegressionModel {
  if (samples.length < 3) throw new Error("At least three calibration samples are required.");
  const degree = options.degree ?? 1;
  const lambda = options.lambda ?? 1e-3;
  const featureCount = samples[0].features.length;
  if (!samples.every((sample) => sample.features.length === featureCount)) throw new Error("Feature dimensions must match.");
  const design = samples.map((sample) => polynomialFeatures(sample.features, degree));
  const coefficientsX = fitTarget(design, samples.map((sample) => sample.target.x), lambda);
  const coefficientsY = fitTarget(design, samples.map((sample) => sample.target.y), lambda);

  return {
    featureCount,
    degree,
    lambda,
    coefficientsX,
    coefficientsY,
    predict(features) {
      if (features.length !== featureCount) throw new Error("Feature dimensions must match.");
      const basis = polynomialFeatures(features, degree);
      return {
        x: basis.reduce((sum, value, index) => sum + value * coefficientsX[index], 0),
        y: basis.reduce((sum, value, index) => sum + value * coefficientsY[index], 0)
      };
    }
  };
}

export interface ValidationMetrics {
  sampleCount: number;
  meanErrorPx: number;
  medianErrorPx: number;
  percentile95ErrorPx: number;
  maxErrorPx: number;
}

export function calculateValidationMetrics(
  model: RegressionModel,
  samples: readonly RegressionSample[],
  scale: Point2D = { x: 1, y: 1 }
): ValidationMetrics {
  const errors = samples.map((sample) => {
    const predicted = model.predict(sample.features);
    return Math.hypot((predicted.x - sample.target.x) * scale.x, (predicted.y - sample.target.y) * scale.y);
  }).sort((a, b) => a - b);
  if (errors.length === 0) throw new Error("Validation requires at least one sample.");
  const percentile = (p: number) => errors[Math.min(errors.length - 1, Math.floor((errors.length - 1) * p))];
  return {
    sampleCount: errors.length,
    meanErrorPx: errors.reduce((sum, value) => sum + value, 0) / errors.length,
    medianErrorPx: percentile(0.5),
    percentile95ErrorPx: percentile(0.95),
    maxErrorPx: errors[errors.length - 1]
  };
}
