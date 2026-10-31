# EyeMouse

Precision-first, quality-aware eye control for macOS.

The repository is being built incrementally. The current product slice includes the menu-bar shell, local MediaPipe face-landmark inference, a nine-point calibration flow, persisted display-aware calibration, tested gaze/quality/gesture algorithms, runtime diagnostics, settings/onboarding windows and a compiled Swift input helper. Native cursor actions remain disabled until Accessibility permission, calibration validity and runtime safety policy all allow them.

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

Build unsigned macOS artifacts locally:

```sh
pnpm package:mac
```

This produces an arm64 DMG and ZIP. Signing and notarization require a Developer ID certificate and Apple notarization credentials; the local packaging check intentionally does not claim either.

## Current boundary

The renderer requests camera access through the dedicated camera manager and runs MediaPipe inference in a worker. It publishes typed observations to the main process; the main process owns session state, calibration persistence, quality decisions, interaction filtering and native input. The renderer never calls the native helper directly.

See [docs/architecture.md](docs/architecture.md), [docs/technical-risk-register.md](docs/technical-risk-register.md) and [docs/implementation-checklist.md](docs/implementation-checklist.md).
