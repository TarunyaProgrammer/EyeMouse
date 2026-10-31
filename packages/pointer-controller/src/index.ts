import type { Point2D, PointerCommand, TrackingQuality } from "@eyemouse/shared-types";

export interface NativeInputAdapter {
  move(point: Point2D): Promise<void>;
  click(button: "left" | "right"): Promise<void>;
  doubleClick(): Promise<void>;
  scroll(deltaY: number): Promise<void>;
  dragStart(): Promise<void>;
  dragEnd(): Promise<void>;
  isAuthorized(): Promise<boolean>;
}

export class OneEuroFilter {
  private previousValue: number | null = null;
  private previousDerivative = 0;
  private previousTimestamp: number | null = null;

  constructor(private readonly minCutoff = 1.2, private readonly beta = 0.02, private readonly derivativeCutoff = 1) {}

  filter(value: number, timestampMs: number, speed = 0): number {
    if (this.previousValue === null || this.previousTimestamp === null) {
      this.previousValue = value;
      this.previousTimestamp = timestampMs;
      return value;
    }
    const dt = Math.max(0.001, (timestampMs - this.previousTimestamp) / 1000);
    const derivative = (value - this.previousValue) / dt;
    const derivativeAlpha = this.alpha(this.derivativeCutoff, dt);
    this.previousDerivative = derivativeAlpha * derivative + (1 - derivativeAlpha) * this.previousDerivative;
    const cutoff = this.minCutoff + this.beta * Math.abs(this.previousDerivative) + speed * this.beta;
    const alpha = this.alpha(cutoff, dt);
    this.previousValue = alpha * value + (1 - alpha) * this.previousValue;
    this.previousTimestamp = timestampMs;
    return this.previousValue;
  }

  reset(): void { this.previousValue = null; this.previousDerivative = 0; this.previousTimestamp = null; }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
}

export class PointerController {
  private readonly xFilter = new OneEuroFilter();
  private readonly yFilter = new OneEuroFilter();
  private lastPoint: Point2D | null = null;
  private dragging = false;

  constructor(private readonly adapter: NativeInputAdapter, private readonly maxSafeErrorPx = 140) {}

  async move(point: Point2D, quality: TrackingQuality, timestampMs: number): Promise<boolean> {
    if (!this.canMove(quality)) return false;
    const speed = this.lastPoint === null ? 0 : Math.hypot(point.x - this.lastPoint.x, point.y - this.lastPoint.y);
    const filtered = {
      x: this.xFilter.filter(point.x, timestampMs, speed),
      y: this.yFilter.filter(point.y, timestampMs, speed)
    };
    this.lastPoint = filtered;
    await this.adapter.move(filtered);
    return true;
  }

  async execute(command: PointerCommand, quality: TrackingQuality): Promise<boolean> {
    if (command.type === "MOVE") return command.point ? this.move(command.point, quality, command.timestampMs) : false;
    if (!this.canInteract(quality)) return false;
    switch (command.type) {
      case "LEFT_CLICK": await this.adapter.click("left"); return true;
      case "RIGHT_CLICK": await this.adapter.click("right"); return true;
      case "DOUBLE_CLICK": await this.adapter.doubleClick(); return true;
      case "DWELL_CLICK": await this.adapter.click("left"); return true;
      case "DRAG_START": this.dragging = true; await this.adapter.dragStart(); return true;
      case "DRAG_END": this.dragging = false; await this.adapter.dragEnd(); return true;
      case "SCROLL": await this.adapter.scroll(-1); return true;
      default: return false;
    }
  }

  async stop(): Promise<void> {
    this.xFilter.reset();
    this.yFilter.reset();
    this.lastPoint = null;
    if (this.dragging) {
      this.dragging = false;
      await this.adapter.dragEnd();
    }
  }

  private canMove(quality: TrackingQuality): boolean {
    return quality.state !== "lost" && quality.inputFresh && quality.calibrationValid && (quality.estimatedErrorPx === null || quality.estimatedErrorPx <= this.maxSafeErrorPx);
  }

  private canInteract(quality: TrackingQuality): boolean {
    return quality.state === "good" && quality.inputFresh && quality.calibrationValid && quality.estimatedErrorPx !== null && quality.estimatedErrorPx <= this.maxSafeErrorPx;
  }
}
