# EyeMouse

Precision-first, quality-aware eye control for macOS.

The repository is being built incrementally. The current slice is the Phase 1 desktop shell: a menu-bar application with an explicit session lifecycle, camera permission boundary, local settings persistence and a React popover. It does not yet move the system cursor or perform gaze estimation.

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
