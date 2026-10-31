import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { extractEyeTrackingObservation, type Landmark } from "@eyemouse/vision";

type WorkerMessage =
  | { type: "init"; wasmRoot: string; modelUrl: string }
  | { type: "frame"; bitmap: ImageBitmap; timestampMs: number; frameId: number }
  | { type: "close" };

let landmarker: FaceLandmarker | null = null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      const fileset = await FilesetResolver.forVisionTasks(message.wasmRoot);
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: message.modelUrl, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true
      });
      self.postMessage({ type: "ready" });
      return;
    }

    if (message.type === "frame" && landmarker) {
      const result = landmarker.detectForVideo(message.bitmap, message.timestampMs);
      const landmarks = (result.faceLandmarks[0] ?? []) as Landmark[];
      const observation = extractEyeTrackingObservation(landmarks, message.timestampMs, message.frameId);
      message.bitmap.close();
      self.postMessage({ type: "observation", observation });
      return;
    }

    if (message.type === "close") {
      landmarker?.close();
      landmarker = null;
    }
  } catch (error) {
    if (message.type === "frame") message.bitmap.close();
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Vision worker failed." });
  }
};
