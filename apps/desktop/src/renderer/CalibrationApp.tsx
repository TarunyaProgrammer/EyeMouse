import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { createCalibrationTargets, fitCalibration, StableSampleCollector, type CalibrationSample, type CalibrationTarget } from "@eyemouse/calibration";
import { serializeRegressionModel } from "@eyemouse/gaze-estimation";
import type { ScreenBounds } from "@eyemouse/shared-types";
import { CameraManager } from "./camera-manager";
import { VisionPipeline } from "./vision-pipeline";

const TARGET_HOLD_MS = 1000;
const MIN_SAMPLES_PER_TARGET = 8;

export function CalibrationApp(): JSX.Element {
  const [bounds, setBounds] = useState<ScreenBounds | null>(null);
  const [targets, setTargets] = useState<CalibrationTarget[]>([]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [sampleCount, setSampleCount] = useState(0);
  const [message, setMessage] = useState("Preparing calibration…");
  const [finished, setFinished] = useState(false);
  const camera = useRef(new CameraManager());
  const vision = useRef(new VisionPipeline());
  const collector = useRef(new StableSampleCollector());
  const boundsRef = useRef<ScreenBounds | null>(null);
  const targetsRef = useRef<CalibrationTarget[]>([]);
  const targetIndexRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const advancing = useRef(false);

  useEffect(() => {
    void start();
    return () => {
      vision.current.stop();
      camera.current.release();
    };
  }, []);

  async function start(): Promise<void> {
    try {
      const screenBounds = await window.eyemouse.getCalibrationScreen();
      const calibrationTargets = createCalibrationTargets(screenBounds);
      boundsRef.current = screenBounds;
      targetsRef.current = calibrationTargets;
      setBounds(screenBounds);
      setTargets(calibrationTargets);
      await camera.current.requestAccess();
      const video = camera.current.getVideo();
      if (!video) throw new Error("Camera video was not initialized.");
      await vision.current.start(video, onObservation, (error) => setMessage(`Vision error: ${error}`));
      setMessage("Look at the target and keep your head steady.");
      const startTime = performance.now();
      startedAtRef.current = startTime;
      setStartedAt(startTime);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Calibration could not start.");
    }
  }

  function onObservation(observation: Parameters<NonNullable<Parameters<VisionPipeline["start"]>[1]>>[0]): void {
    const target = targetsRef.current[targetIndexRef.current];
    const now = performance.now();
    if (!target || startedAtRef.current === null || advancing.current) return;
    const stable = observation.faceVisible && observation.leftEyeVisible && observation.rightEyeVisible && (observation.landmarkStability ?? 0) >= 0.5 && (observation.leftEyeOpen ?? 0) > 0.18 && (observation.rightEyeOpen ?? 0) > 0.18;
    if (stable) {
      const sample: CalibrationSample = {
        targetId: target.id,
        timestampMs: observation.timestampMs,
        stable: true,
        features: observation.normalizedFeatures,
        target: target.screen
      };
      collector.current.add(sample);
      setSampleCount(collector.current.forTarget(target.id).length);
    }
    if (now - startedAtRef.current >= TARGET_HOLD_MS && collector.current.forTarget(target.id).length >= MIN_SAMPLES_PER_TARGET) {
      advance();
    }
  }

  function advance(): void {
    if (advancing.current) return;
    advancing.current = true;
    if (targetIndexRef.current >= targetsRef.current.length - 1) {
      finish();
      return;
    }
    targetIndexRef.current += 1;
    setTargetIndex(targetIndexRef.current);
    setSampleCount(0);
    const nextStart = performance.now() + 250;
    startedAtRef.current = nextStart;
    setStartedAt(nextStart);
    setMessage("Hold your gaze on the target…");
    window.setTimeout(() => { advancing.current = false; }, 260);
  }

  async function finish(): Promise<void> {
    setFinished(true);
    setMessage("Validating calibration…");
    try {
      const screenBounds = boundsRef.current;
      if (!screenBounds) throw new Error("Display bounds are unavailable.");
      const result = fitCalibration(collector.current.all(), screenBounds, { degree: 1, lambda: 0.01 });
      const validationErrorPx = result.validationMetrics.percentile95ErrorPx;
      const accepted = Number.isFinite(validationErrorPx) && validationErrorPx <= 180;
      await window.eyemouse.completeCalibration({
        calibrationId: result.id,
        displayId: screenBounds.displayId,
        validationErrorPx,
        accepted,
        model: serializeRegressionModel(result.model),
        screenBounds
      });
      setMessage(accepted
        ? `Calibration complete. Held-out 95th percentile error: ${Math.round(validationErrorPx)} px.`
        : `Calibration needs repeating. Held-out 95th percentile error: ${Math.round(validationErrorPx)} px.`);
      window.setTimeout(() => window.close(), accepted ? 1600 : 2600);
    } catch (error) {
      setFinished(false);
      setMessage(error instanceof Error ? error.message : "Calibration validation failed.");
      advancing.current = false;
    }
  }

  if (!bounds || targets.length === 0) return <main className="calibration-shell"><p>{message}</p></main>;
  const target = targets[targetIndex];
  const progress = Math.round((targetIndex / targets.length) * 100);
  const phaseLabel = target.phase === "fit" ? "Calibration" : "Validation";

  return (
    <main className="calibration-shell" style={{ width: bounds.width, height: bounds.height }}>
      <div className="calibration-topbar">
        <div><strong>EyeMouse</strong><span>{phaseLabel} · {targetIndex + 1} / {targets.length}</span></div>
        <button onClick={() => window.close()}>Cancel</button>
      </div>
      <div className="calibration-progress"><span style={{ width: `${progress}%` }} /></div>
      {!finished && <div className="calibration-target" style={{ left: `${target.normalized.x * 100}%`, top: `${target.normalized.y * 100}%` }} aria-label="Calibration target"><span /></div>}
      <div className="calibration-instructions">
        <p>{message}</p>
        {!finished && <small>{sampleCount}/{MIN_SAMPLES_PER_TARGET} stable samples</small>}
      </div>
    </main>
  );
}
