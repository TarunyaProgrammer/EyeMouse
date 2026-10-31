import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CalibrationResultSummary } from "@eyemouse/shared-types";

export class CalibrationStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<CalibrationResultSummary | null> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      return isCalibrationResult(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async save(result: CalibrationResultSummary): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(result, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }

  async clear(): Promise<void> {
    await unlink(this.filePath).catch(() => undefined);
  }
}

export function isCalibrationResult(value: unknown): value is CalibrationResultSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const model = input.model;
  const bounds = input.screenBounds;
  if (typeof input.calibrationId !== "string" || input.calibrationId.length === 0 || typeof input.displayId !== "string" || typeof input.validationErrorPx !== "number" || !Number.isFinite(input.validationErrorPx) || input.validationErrorPx < 0 || input.validationErrorPx > 10000 || typeof input.accepted !== "boolean") return false;
  if (!model || typeof model !== "object" || Array.isArray(model) || !bounds || typeof bounds !== "object" || Array.isArray(bounds)) return false;

  const modelValue = model as Record<string, unknown>;
  const boundsValue = bounds as Record<string, unknown>;
  if (modelValue.degree !== 1 && modelValue.degree !== 2) return false;
  if (typeof modelValue.featureCount !== "number" || !Number.isInteger(modelValue.featureCount) || modelValue.featureCount < 1 || typeof modelValue.lambda !== "number" || !Number.isFinite(modelValue.lambda) || !Array.isArray(modelValue.coefficientsX) || !Array.isArray(modelValue.coefficientsY)) return false;
  const expectedCoefficientCount = 1 + modelValue.featureCount + (modelValue.degree === 2 ? modelValue.featureCount * (modelValue.featureCount + 1) / 2 : 0);
  if (modelValue.coefficientsX.length !== expectedCoefficientCount || modelValue.coefficientsY.length !== expectedCoefficientCount || ![...modelValue.coefficientsX, ...modelValue.coefficientsY].every((item) => typeof item === "number" && Number.isFinite(item))) return false;
  if (typeof boundsValue.x !== "number" || typeof boundsValue.y !== "number" || typeof boundsValue.width !== "number" || typeof boundsValue.height !== "number" || typeof boundsValue.displayId !== "string" || !Number.isFinite(boundsValue.x) || !Number.isFinite(boundsValue.y) || !Number.isFinite(boundsValue.width) || !Number.isFinite(boundsValue.height) || boundsValue.width <= 0 || boundsValue.height <= 0 || boundsValue.displayId.length === 0) return false;
  return true;
}

export function matchesDisplay(result: CalibrationResultSummary, display: { id: string; x: number; y: number; width: number; height: number }): boolean {
  return result.accepted && result.displayId === String(display.id) && result.screenBounds.displayId === String(display.id) && result.screenBounds.x === display.x && result.screenBounds.y === display.y && result.screenBounds.width === display.width && result.screenBounds.height === display.height;
}
