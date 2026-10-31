import type { EyeMouseAPI } from "@eyemouse/shared-types";

declare global {
  interface Window {
    eyemouse: EyeMouseAPI;
  }
}

export {};
