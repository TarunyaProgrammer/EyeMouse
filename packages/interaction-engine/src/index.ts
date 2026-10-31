import type { InteractionEvent, Point2D } from "@eyemouse/shared-types";

export interface GestureObservation {
  timestampMs: number;
  leftEyeOpen: number | null;
  rightEyeOpen: number | null;
  qualityState: "good" | "degraded" | "lost";
  point: Point2D | null;
  fixationStable: boolean;
}

export interface WinkThresholds {
  closure: number;
  open: number;
  minClosureMs: number;
  maxClosureMs: number;
  cooldownMs: number;
}

const DEFAULT_WINK_THRESHOLDS: WinkThresholds = {
  closure: 0.22,
  open: 0.55,
  minClosureMs: 140,
  maxClosureMs: 550,
  cooldownMs: 350
};

export class WinkRecognizer {
  private leftClosedAt: number | null = null;
  private rightClosedAt: number | null = null;
  private cooldownUntil = 0;
  private readonly thresholds: WinkThresholds;

  constructor(thresholds: Partial<WinkThresholds> = {}) {
    this.thresholds = { ...DEFAULT_WINK_THRESHOLDS, ...thresholds };
  }

  observe(observation: GestureObservation): InteractionEvent[] {
    const { timestampMs: now, leftEyeOpen, rightEyeOpen } = observation;
    if (observation.qualityState === "lost" || leftEyeOpen === null || rightEyeOpen === null) {
      this.reset();
      return [];
    }
    if (now < this.cooldownUntil) return [];

    const leftClosed = leftEyeOpen <= this.thresholds.closure && rightEyeOpen >= this.thresholds.open;
    const rightClosed = rightEyeOpen <= this.thresholds.closure && leftEyeOpen >= this.thresholds.open;
    const bothClosed = leftEyeOpen <= this.thresholds.closure && rightEyeOpen <= this.thresholds.closure;
    if (bothClosed) {
      this.reset();
      return [];
    }

    if (leftClosed && this.leftClosedAt === null) this.leftClosedAt = now;
    if (rightClosed && this.rightClosedAt === null) this.rightClosedAt = now;
    const events: InteractionEvent[] = [];
    if (!leftClosed && this.leftClosedAt !== null) {
      if (this.isIntentional(now - this.leftClosedAt)) events.push(this.event("LEFT_CLICK", now, "left-wink", observation.point));
      this.leftClosedAt = null;
    }
    if (!rightClosed && this.rightClosedAt !== null) {
      if (this.isIntentional(now - this.rightClosedAt)) events.push(this.event("RIGHT_CLICK", now, "right-wink", observation.point));
      this.rightClosedAt = null;
    }
    if (events.length > 0) this.cooldownUntil = now + this.thresholds.cooldownMs;
    return events;
  }

  reset(): void {
    this.leftClosedAt = null;
    this.rightClosedAt = null;
  }

  private isIntentional(durationMs: number): boolean {
    return durationMs >= this.thresholds.minClosureMs && durationMs <= this.thresholds.maxClosureMs;
  }

  private event(type: "LEFT_CLICK" | "RIGHT_CLICK", timestampMs: number, source: "left-wink" | "right-wink", point: Point2D | null): InteractionEvent {
    return { type, timestampMs, confidence: 0.9, source, point };
  }
}

export interface DwellOptions {
  durationMs: number;
  radiusPx: number;
  cooldownMs: number;
}

export class DwellRecognizer {
  private startedAt: number | null = null;
  private origin: Point2D | null = null;
  private cooldownUntil = 0;
  private readonly options: DwellOptions;

  constructor(options: Partial<DwellOptions> = {}) {
    this.options = { durationMs: 900, radiusPx: 18, cooldownMs: 650, ...options };
  }

  observe(observation: GestureObservation): InteractionEvent[] {
    const point = observation.point;
    if (observation.qualityState !== "good" || !observation.fixationStable || point === null || observation.timestampMs < this.cooldownUntil) {
      this.reset(point === null ? null : point, observation.timestampMs);
      return [];
    }
    if (this.origin === null || this.distance(this.origin, point) > this.options.radiusPx) {
      this.origin = point;
      this.startedAt = observation.timestampMs;
      return [];
    }
    if (this.startedAt !== null && observation.timestampMs - this.startedAt >= this.options.durationMs) {
      this.cooldownUntil = observation.timestampMs + this.options.cooldownMs;
      this.startedAt = null;
      return [{ type: "DWELL_CLICK", timestampMs: observation.timestampMs, confidence: 0.86, source: "dwell", point }];
    }
    return [];
  }

  reset(point: Point2D | null = null, timestampMs = 0): void {
    this.origin = point;
    this.startedAt = point === null ? null : timestampMs;
  }

  private distance(a: Point2D, b: Point2D): number { return Math.hypot(a.x - b.x, a.y - b.y); }
}

export function filterInteractionEvent(event: InteractionEvent, qualityState: "good" | "degraded" | "lost", estimatedErrorPx: number | null, maxSafeErrorPx = 140): InteractionEvent | null {
  if (qualityState === "lost") return null;
  if ((event.type === "LEFT_CLICK" || event.type === "RIGHT_CLICK" || event.type === "DOUBLE_CLICK" || event.type === "DRAG_START" || event.type === "DRAG_END") && (qualityState !== "good" || estimatedErrorPx === null || estimatedErrorPx > maxSafeErrorPx)) return null;
  if (event.confidence < 0.75) return null;
  return event;
}
