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

The repository includes `.github/workflows/macos-release.yml`, which runs on `v*` tags. Configure these repository secrets before using it:

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

The workflow signs, notarizes through Electron Builder, publishes the DMG/ZIP to the GitHub release, and runs the bundle verifier.

For a signed release app, verify the final bundle before distribution:

```sh
scripts/verify-macos-app.sh "dist/mac-arm64/EyeMouse.app"
```

The verifier checks the app signature, the bundled native helper signature and Gatekeeper assessment. It is expected to fail on unsigned local artifacts produced without a Developer ID identity.
