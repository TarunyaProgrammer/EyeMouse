import type { EyeTrackingObservation } from "@eyemouse/shared-types";

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

const LEFT_EYE = { outer: 33, inner: 133, top: 159, bottom: 145, iris: [468, 469, 470, 471, 472] };
const RIGHT_EYE = { outer: 362, inner: 263, top: 386, bottom: 374, iris: [473, 474, 475, 476, 477] };
const FACE_ANCHORS = [10, 152, 234, 454];

function point(landmarks: readonly Landmark[], index: number): Landmark | null {
  return landmarks[index] ?? null;
}

function meanPoint(landmarks: readonly Landmark[], indices: readonly number[]): Landmark | null {
  const points = indices.map((index) => point(landmarks, index)).filter((value): value is Landmark => value !== null);
  if (points.length === 0) return null;
  return {
    x: points.reduce((sum, value) => sum + value.x, 0) / points.length,
    y: points.reduce((sum, value) => sum + value.y, 0) / points.length,
    z: points.reduce((sum, value) => sum + (value.z ?? 0), 0) / points.length
  };
}

function eyeOpenRatio(landmarks: readonly Landmark[], eye: typeof LEFT_EYE): number | null {
  const outer = point(landmarks, eye.outer);
  const inner = point(landmarks, eye.inner);
  const top = point(landmarks, eye.top);
  const bottom = point(landmarks, eye.bottom);
  if (!outer || !inner || !top || !bottom) return null;
  const width = Math.hypot(outer.x - inner.x, outer.y - inner.y);
  return width < 1e-6 ? null : Math.hypot(top.x - bottom.x, top.y - bottom.y) / width;
}

function irisRelativePosition(landmarks: readonly Landmark[], eye: typeof LEFT_EYE): { x: number; y: number } | null {
  const outer = point(landmarks, eye.outer);
  const inner = point(landmarks, eye.inner);
  const top = point(landmarks, eye.top);
  const bottom = point(landmarks, eye.bottom);
  const iris = meanPoint(landmarks, eye.iris);
  if (!outer || !inner || !top || !bottom || !iris) return null;
  const width = Math.max(1e-6, Math.hypot(inner.x - outer.x, inner.y - outer.y));
  const height = Math.max(1e-6, Math.hypot(bottom.x - top.x, bottom.y - top.y));
  return {
    x: ((iris.x - outer.x) * (inner.x - outer.x) + (iris.y - outer.y) * (inner.y - outer.y)) / (width * width),
    y: ((iris.x - top.x) * (bottom.x - top.x) + (iris.y - top.y) * (bottom.y - top.y)) / (height * height)
  };
}

function estimateHeadPose(landmarks: readonly Landmark[]): { yaw: number; pitch: number; roll: number } | null {
  const left = point(landmarks, FACE_ANCHORS[2]);
  const right = point(landmarks, FACE_ANCHORS[3]);
  const top = point(landmarks, FACE_ANCHORS[0]);
  const bottom = point(landmarks, FACE_ANCHORS[1]);
  if (!left || !right || !top || !bottom) return null;
  const centerX = (left.x + right.x) / 2;
  const centerY = (top.y + bottom.y) / 2;
  const width = Math.max(1e-6, Math.abs(right.x - left.x));
  const height = Math.max(1e-6, Math.abs(bottom.y - top.y));
  return {
    yaw: (centerX - 0.5) / width,
    pitch: (centerY - 0.5) / height,
    roll: Math.atan2(right.y - left.y, right.x - left.x)
  };
}

export function extractEyeTrackingObservation(landmarks: readonly Landmark[], timestampMs: number, frameId: number): EyeTrackingObservation {
  const leftIris = irisRelativePosition(landmarks, LEFT_EYE);
  const rightIris = irisRelativePosition(landmarks, RIGHT_EYE);
  const leftEyeOpen = eyeOpenRatio(landmarks, LEFT_EYE);
  const rightEyeOpen = eyeOpenRatio(landmarks, RIGHT_EYE);
  const headPose = estimateHeadPose(landmarks);
  const faceVisible = landmarks.length > 0;
  const leftEyeVisible = leftIris !== null && leftEyeOpen !== null;
  const rightEyeVisible = rightIris !== null && rightEyeOpen !== null;
  const faceCenter = meanPoint(landmarks, [FACE_ANCHORS[0], FACE_ANCHORS[1], FACE_ANCHORS[2], FACE_ANCHORS[3]]);
  const faceWidth = faceCenter && point(landmarks, FACE_ANCHORS[2]) && point(landmarks, FACE_ANCHORS[3])
    ? Math.abs(point(landmarks, FACE_ANCHORS[3])!.x - point(landmarks, FACE_ANCHORS[2])!.x)
    : 0;
  const faceHeight = faceCenter && point(landmarks, FACE_ANCHORS[0]) && point(landmarks, FACE_ANCHORS[1])
    ? Math.abs(point(landmarks, FACE_ANCHORS[1])!.y - point(landmarks, FACE_ANCHORS[0])!.y)
    : 0;

  return {
    timestampMs,
    frameId,
    faceVisible,
    leftEyeVisible,
    rightEyeVisible,
    leftEyeOpen,
    rightEyeOpen,
    normalizedFeatures: [
      leftIris?.x ?? 0, leftIris?.y ?? 0,
      rightIris?.x ?? 0, rightIris?.y ?? 0,
      leftEyeOpen ?? 0, rightEyeOpen ?? 0,
      faceCenter?.x ?? 0.5, faceCenter?.y ?? 0.5,
      faceWidth, faceHeight,
      headPose?.yaw ?? 0, headPose?.pitch ?? 0, headPose?.roll ?? 0
    ],
    headPose,
    landmarkStability: faceVisible ? 1 : 0
  };
}
