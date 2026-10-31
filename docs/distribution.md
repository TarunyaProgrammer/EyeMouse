# Distribution

`pnpm package:mac` builds the Swift input helper, builds the Electron application and invokes Electron Builder for arm64 DMG and ZIP artifacts.

The package includes:

- the compiled `native/eyemouse-input` helper under `Contents/Resources/native/`;
- the MediaPipe face-landmarker model and local WASM assets in the renderer bundle;
- hardened-runtime configuration and camera entitlement scaffolding.

The local validation is intentionally unsigned when no Developer ID identity is available. Release distribution still requires:

1. a Developer ID Application certificate and signing identity;
2. Apple notarization credentials (`APPLE_ID`, app-specific password and team ID, or an equivalent keychain profile);
3. a signed-build smoke test covering camera permission, Accessibility refusal, login startup and native helper launch;
4. an update feed and release artifact hosting policy.
