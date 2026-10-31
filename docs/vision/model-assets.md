# Vision model assets

EyeMouse bundles the MediaPipe Tasks Vision Face Landmarker model and WASM runtime locally so camera inference does not require a network connection or upload frames.

- Package: `@mediapipe/tasks-vision` version pinned by `pnpm-lock.yaml`.
- Model: `assets/models/face_landmarker.task`.
- Runtime: `assets/wasm/`.
- Upstream model family: MediaPipe Face Landmarker / Face Mesh.
- Upstream model card: [MediaPipe Face Mesh V2 model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf).
- Distribution license: verify the exact package/model notices before signed public distribution; preserve upstream notices in the packaged application.

The model is a facial landmark estimator, not a gaze-accuracy model. EyeMouse must continue to use personalized calibration and held-out validation before enabling pointer actions. The model card also documents sensitivity to lighting, motion, face position and orientation; those limitations are part of the product’s quality-state design.
