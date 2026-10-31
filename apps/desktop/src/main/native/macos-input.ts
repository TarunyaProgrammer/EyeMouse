import { access } from "node:fs/promises";
import { createInterface, type Interface } from "node:readline";
import { join } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { NativeInputAdapter } from "@eyemouse/pointer-controller";
import type { Point2D } from "@eyemouse/shared-types";

interface HelperResponse {
  ok: boolean;
  error?: string | null;
  authorized?: boolean | null;
}

interface HelperRequest {
  type: string;
  x?: number;
  y?: number;
  button?: "left" | "right";
  deltaY?: number;
}

export class MacOSInputAdapter implements NativeInputAdapter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private output: Interface | null = null;
  private pending: Promise<HelperResponse> = Promise.resolve({ ok: false, error: "Not initialized." });

  async move(point: Point2D): Promise<void> { await this.send({ type: "move", x: point.x, y: point.y }); }
  async click(button: "left" | "right"): Promise<void> { await this.send({ type: "click", button }); }
  async doubleClick(): Promise<void> { await this.send({ type: "doubleClick" }); }
  async scroll(deltaY: number): Promise<void> { await this.send({ type: "scroll", deltaY }); }
  async dragStart(): Promise<void> { await this.send({ type: "dragStart" }); }
  async dragEnd(): Promise<void> { await this.send({ type: "dragEnd" }); }

  async isAuthorized(): Promise<boolean> {
    const response = await this.send({ type: "authorized" });
    return response.authorized === true;
  }

  async close(): Promise<void> {
    this.output?.close();
    this.output = null;
    this.process?.kill();
    this.process = null;
  }

  private async send(request: HelperRequest): Promise<HelperResponse> {
    const current = this.pending.then(async () => {
      await this.ensureProcess();
      return this.writeAndRead(request);
    });
    this.pending = current.catch(() => ({ ok: false, error: "Native input request failed." }));
    const response = await current;
    if (!response.ok) throw new Error(response.error ?? "Native input request failed.");
    return response;
  }

  private async ensureProcess(): Promise<void> {
    if (this.process && this.output) return;
    if (process.platform !== "darwin") throw new Error("EyeMouse native input is only available on macOS.");
    const candidates = [
      process.env.EYEMOUSE_INPUT_HELPER,
      join(process.cwd(), "native/macos/input/eyemouse-input"),
      join(process.resourcesPath, "native/eyemouse-input")
    ].filter((candidate): candidate is string => Boolean(candidate));
    let helperPath: string | null = null;
    for (const candidate of candidates) {
      try { await access(candidate); helperPath = candidate; break; } catch { /* try next candidate */ }
    }
    if (!helperPath) throw new Error("Native input helper is not built. Run scripts/build-native-input.sh.");

    this.process = spawn(helperPath, [], { stdio: ["pipe", "pipe", "pipe"] });
    this.output = createInterface({ input: this.process.stdout });
    this.process.once("exit", () => {
      this.process = null;
      this.output?.close();
      this.output = null;
    });
  }

  private writeAndRead(request: HelperRequest): Promise<HelperResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.output) return reject(new Error("Native input helper is unavailable."));
      const onLine = (line: string) => {
        this.output?.removeListener("line", onLine);
        try { resolve(JSON.parse(line) as HelperResponse); } catch (error) { reject(error); }
      };
      this.output.on("line", onLine);
      this.process.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
        if (error) {
          this.output?.removeListener("line", onLine);
          reject(error);
        }
      });
    });
  }
}
