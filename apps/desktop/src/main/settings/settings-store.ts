import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Preferences } from "@eyemouse/shared-types";

export const DEFAULT_PREFERENCES: Preferences = {
  launchAtLogin: false,
  onboardingComplete: false,
  cameraDeviceId: null,
  calibrationDisplayId: null,
  interactionMode: "dwell",
  cursorSensitivity: 1,
  smoothing: 0.35
};

export class SettingsStore {
  private preferences: Preferences = { ...DEFAULT_PREFERENCES };

  constructor(private readonly filePath: string) {}

  async load(): Promise<Preferences> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<Preferences>;
      this.preferences = { ...DEFAULT_PREFERENCES, ...parsed };
    } catch {
      this.preferences = { ...DEFAULT_PREFERENCES };
    }

    return this.get();
  }

  get(): Preferences {
    return { ...this.preferences };
  }

  async update(patch: Partial<Preferences>): Promise<Preferences> {
    this.preferences = { ...this.preferences, ...patch };
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.preferences, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
    return this.get();
  }
}
