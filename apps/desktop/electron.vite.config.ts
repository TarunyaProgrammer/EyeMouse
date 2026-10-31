import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
    publicDir: resolve(projectDirectory, "../../assets")
  }
});
