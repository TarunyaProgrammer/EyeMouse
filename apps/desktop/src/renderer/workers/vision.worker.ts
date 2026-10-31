import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { estimateTemporalStability, extractEyeTrackingObservation, type Landmark } from "@eyemouse/vision";

type WorkerMessage =
  | { type: "init"; wasmRoot: string; modelUrl: string }
  | { type: "frame"; bitmap: ImageBitmap; timestampMs: number; frameId: number }
  | { type: "close" };

let landmarker: FaceLandmarker | null = null;
let previousFeatures: readonly number[] | null = null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      previousFeatures = null;
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
      const stability = estimateTemporalStability(previousFeatures, observation.normalizedFeatures);
      previousFeatures = observation.normalizedFeatures;
      message.bitmap.close();
      self.postMessage({ type: "observation", observation: { ...observation, landmarkStability: observation.faceVisible ? stability : 0 } });
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
