# EyeMouse

Precision-first, quality-aware eye control for macOS.

The repository is being built incrementally. The current slice includes the menu-bar shell, local MediaPipe face-landmark inference, a nine-point calibration flow, tested gaze/quality/gesture algorithms and a compiled Swift input helper. Native cursor actions remain disabled until Accessibility permission, calibration validity and runtime safety policy all allow them.

## Requirements

- macOS on Apple Silicon for the initial development target.
- Node.js 22 or newer.
- pnpm 10 or newer.
- Camera permission for the camera boundary test.

## Development

```sh
pnpm install
pnpm dev
```

Run the checks:

```sh
pnpm test
pnpm typecheck
pnpm build
```

## Current boundary

The renderer may request camera access through the dedicated camera manager, but it does not run gaze estimation or emit system input. The main process owns session state and safety-relevant lifecycle decisions. Native cursor input, calibration and MediaPipe processing are planned phases and are intentionally not represented as complete here.

See [docs/architecture.md](docs/architecture.md), [docs/technical-risk-register.md](docs/technical-risk-register.md) and [docs/implementation-checklist.md](docs/implementation-checklist.md).
