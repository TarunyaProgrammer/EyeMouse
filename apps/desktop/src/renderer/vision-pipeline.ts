import type { EyeTrackingObservation } from "@eyemouse/shared-types";

interface VisionWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export class VisionPipeline {
  private worker: VisionWorker | null = null;
  private video: HTMLVideoElement | null = null;
  private timer: number | null = null;
  private frameId = 0;
  private pending = false;
  private running = false;
  private ready = false;

  async start(video: HTMLVideoElement, onObservation: (observation: EyeTrackingObservation) => void, onError: (message: string) => void): Promise<void> {
    this.stop();
    this.video = video;
    this.worker = new Worker(new URL("./workers/vision.worker.ts", import.meta.url), { type: "module" }) as unknown as VisionWorker;
    this.worker.onmessage = (event: MessageEvent<{ type: string; observation?: EyeTrackingObservation; message?: string }>) => {
      if (event.data.type === "ready") this.ready = true;
      if (event.data.type === "observation" && event.data.observation) {
        this.pending = false;
        onObservation(event.data.observation);
      }
      if (event.data.type === "error") {
        this.pending = false;
        onError(event.data.message ?? "Vision worker failed.");
      }
    };
    this.worker.onerror = (event) => onError(event.message || "Vision worker failed.");
    this.worker.postMessage({ type: "init", wasmRoot: "/wasm", modelUrl: "/models/face_landmarker.task" });
    this.running = true;
    this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    this.ready = false;
    this.pending = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.worker?.postMessage({ type: "close" });
    this.worker?.terminate();
    this.worker = null;
    this.video = null;
  }

  private scheduleFrame(): void {
    if (!this.running) return;
    this.timer = window.setTimeout(() => void this.processFrame(), 33);
  }

  private async processFrame(): Promise<void> {
    if (!this.running || !this.video || !this.ready || this.pending || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.scheduleFrame();
      return;
    }
    this.pending = true;
    try {
      const bitmap = await createImageBitmap(this.video);
      this.worker?.postMessage({ type: "frame", bitmap, timestampMs: performance.now(), frameId: this.frameId++ }, [bitmap]);
    } catch {
      this.pending = false;
    }
    this.scheduleFrame();
  }
}
