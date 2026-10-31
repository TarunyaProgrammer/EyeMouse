import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { CameraStatus, Preferences, SessionState, SessionStatus } from "@eyemouse/shared-types";
import { CameraManager } from "./camera-manager";
import { VisionPipeline } from "./vision-pipeline";
import { TrackingQualityEngine } from "@eyemouse/tracking-quality";
import { DwellRecognizer, WinkRecognizer } from "@eyemouse/interaction-engine";

const STATE_LABELS: Record<SessionState, string> = {
  IDLE: "Ready to start",
  INITIALIZING: "Preparing session",
  CAMERA_READY: "Camera ready",
  CALIBRATION_REQUIRED: "Calibration required",
  TRACKING_ACTIVE: "Tracking active",
  TRACKING_DEGRADED: "Tracking degraded",
  TRACKING_LOST: "Tracking lost",
  PAUSED: "Paused",
  STOPPED: "Stopped"
};

const CAMERA_LABELS: Record<CameraStatus, string> = {
  "not-requested": "Not in use",
  requesting: "Requesting access…",
  ready: "Available",
  denied: "Access denied",
  unavailable: "Unavailable",
  stopped: "Released"
};

function StatusDot({ state }: { state: SessionState }): JSX.Element {
  const tone = state === "TRACKING_ACTIVE" ? "live" : state === "TRACKING_DEGRADED" ? "warn" : state === "TRACKING_LOST" ? "bad" : "idle";
  return <span className={`status-dot status-dot-${tone}`} aria-hidden="true" />;
}

function EyeMark(): JSX.Element {
  return (
    <svg className="eye-mark" viewBox="0 0 28 20" aria-hidden="true">
      <path d="M2 10s3.7-7 12-7 12 7 12 7-3.7 7-12 7S2 10 2 10Z" />
      <circle cx="14" cy="10" r="3.2" />
    </svg>
  );
}

export function App(): JSX.Element {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [diagnostics, setDiagnostics] = useState({ faceVisible: false, eyesVisible: false, fps: 0, error: null as string | null });
  const cameraManager = useRef(new CameraManager());
  const visionPipeline = useRef(new VisionPipeline());
  const qualityEngine = useRef(new TrackingQualityEngine());
  const winkRecognizer = useRef(new WinkRecognizer());
  const dwellRecognizer = useRef(new DwellRecognizer());
  const interactionMode = useRef<Preferences["interactionMode"]>("dwell");
  const frameTimes = useRef<number[]>([]);
  const cameraAttemptState = useRef<SessionState | null>(null);

  useEffect(() => {
    void Promise.all([window.eyemouse.getSessionStatus(), window.eyemouse.getPreferences()]).then(([nextStatus, nextPreferences]) => {
        setStatus(nextStatus);
        setPreferences(nextPreferences);
        interactionMode.current = nextPreferences.interactionMode;
    });

    return window.eyemouse.onSessionStatusChanged(setStatus);
  }, []);

  useEffect(() => () => {
    visionPipeline.current.stop();
    cameraManager.current.release();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && status && status.state !== "IDLE" && status.state !== "STOPPED") {
        cameraManager.current.release();
        void window.eyemouse.stopSession();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status]);

  useEffect(() => {
    if (!status) return;

    if (status.state === "INITIALIZING" && cameraAttemptState.current !== "INITIALIZING") {
      cameraAttemptState.current = "INITIALIZING";
      void startCamera();
    }

    if (status.state !== "INITIALIZING") cameraAttemptState.current = null;
    if (status.state === "IDLE" || status.state === "STOPPED") {
      visionPipeline.current.stop();
      cameraManager.current.release();
    }
  }, [status]);

  useEffect(() => {
    if (!status || !["CAMERA_READY", "CALIBRATION_REQUIRED", "TRACKING_ACTIVE"].includes(status.state)) return;
    if (!cameraManager.current.getVideo()) {
      if (status.state !== "TRACKING_ACTIVE") return;
      const reacquireTimer = window.setTimeout(() => {
        void cameraManager.current.requestAccess().then(() => startVisionPipeline()).catch(() => {
          setDiagnostics((current) => ({ ...current, error: "Camera could not be reacquired after calibration." }));
        });
      }, 1800);
      return () => window.clearTimeout(reacquireTimer);
    }
    startVisionPipeline();
  }, [status?.state, status?.calibrationStatus]);

  useEffect(() => {
    if (status?.state === "TRACKING_ACTIVE") void window.eyemouse.checkNativeInput();
  }, [status?.state]);

  useEffect(() => {
    if (preferences) interactionMode.current = preferences.interactionMode;
  }, [preferences]);

  function startVisionPipeline(): void {
    const video = cameraManager.current.getVideo();
    if (!video) return;
    void visionPipeline.current.start(video, (observation) => {
      const now = performance.now();
      frameTimes.current = [...frameTimes.current.filter((time) => now - time < 1000), now];
      const quality = qualityEngine.current.evaluate({
        nowMs: now,
        timestampMs: observation.timestampMs,
        cameraConnected: true,
        faceVisible: observation.faceVisible,
        eyesVisible: observation.leftEyeVisible && observation.rightEyeVisible,
        landmarkStability: observation.landmarkStability,
        headPoseStability: observation.headPose ? 1 : null,
        estimatedErrorPx: status?.estimatedErrorPx ?? null,
        calibrationValid: status?.calibrationStatus === "valid",
        gestureConfidence: null
      });
      setDiagnostics({
        faceVisible: observation.faceVisible,
        eyesVisible: observation.leftEyeVisible && observation.rightEyeVisible,
        fps: frameTimes.current.length,
        error: quality.state === "lost" ? quality.recoveryRecommendation : null
      });
      void window.eyemouse.publishObservation(observation).then((update) => {
        if (!update) return;
        const gestureObservation = {
          timestampMs: observation.timestampMs,
          leftEyeOpen: observation.leftEyeOpen,
          rightEyeOpen: observation.rightEyeOpen,
          qualityState: update.quality.state,
          point: update.prediction?.point ?? null,
          fixationStable: update.quality.state === "good" && (observation.landmarkStability ?? 0) >= 0.65
        } as const;
        const events = interactionMode.current === "wink"
          ? winkRecognizer.current.observe(gestureObservation)
          : dwellRecognizer.current.observe(gestureObservation);
        for (const event of events) void window.eyemouse.publishInteraction(event);
      }).catch((error: unknown) => {
        setDiagnostics((current) => ({ ...current, error: error instanceof Error ? error.message : "Tracking update failed." }));
      });
    }, (message) => {
      setDiagnostics((current) => ({ ...current, error: message }));
    });
  }

  async function startCamera(): Promise<void> {
    await window.eyemouse.setCameraRequesting();
    try {
      await cameraManager.current.requestAccess();
      await window.eyemouse.setCameraReady();
    } catch (error) {
      cameraManager.current.release();
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Camera access was denied. Allow camera access in System Settings, then try again."
        : error instanceof Error
          ? error.message
          : "Camera access could not be initialized.";
      await window.eyemouse.setCameraFailure(message);
    }
  }

  async function toggleSession(): Promise<void> {
    if (!status || status.state === "IDLE" || status.state === "STOPPED") {
      await window.eyemouse.startSession();
    } else {
      winkRecognizer.current.reset();
      dwellRecognizer.current.reset();
      cameraManager.current.release();
      await window.eyemouse.stopSession();
    }
  }

  async function toggleLaunchAtLogin(): Promise<void> {
    if (!preferences) return;
    const next = await window.eyemouse.setPreferences({ launchAtLogin: !preferences.launchAtLogin });
    setPreferences(next);
  }

  async function openCalibration(): Promise<void> {
    visionPipeline.current.stop();
    cameraManager.current.release();
    await window.eyemouse.openCalibration();
  }

  if (!status || !preferences) return <main className="shell shell-loading">Loading EyeMouse…</main>;

  const canStart = status.state === "IDLE" || status.state === "STOPPED";

  return (
    <main className="shell">
      <header className="header">
        <div className="brand-lockup">
          <div className="brand-icon"><EyeMark /></div>
          <div>
            <h1>EyeMouse</h1>
            <p>Precision-first eye control</p>
          </div>
        </div>
        <div className="window-light" aria-hidden="true" />
      </header>

      <section className="hero-status" aria-live="polite">
        <div className="status-title"><StatusDot state={status.state} />{STATE_LABELS[status.state]}</div>
        <p>{status.message}</p>
      </section>

      <button className={`primary-action ${canStart ? "" : "secondary-action"}`} onClick={() => void toggleSession()}>
        <span>{canStart ? "Start session" : "Stop session"}</span>
      </button>

      <section className="status-list" aria-label="Session details">
        <div className="status-row">
          <span>Camera</span>
          <span className={`value value-${status.cameraStatus}`}>{CAMERA_LABELS[status.cameraStatus]}</span>
        </div>
        <div className="status-row">
          <span>Tracking quality</span>
          <span className="value">{status.trackingQuality === "unknown" ? "Not measured" : status.trackingQuality}</span>
        </div>
        <div className="status-row">
          <span>Calibration</span>
          <span className="value">{status.calibrationStatus.replace("-", " ")}</span>
        </div>
        <div className="status-row">
          <span>System input</span>
          <span className="value">{status.inputEnabled ? "Enabled" : "Disabled"}</span>
        </div>
        <div className="status-row">
          <span>Face visibility</span>
          <span className="value">{diagnostics.faceVisible ? "Detected" : "Not detected"}</span>
        </div>
        <div className="status-row">
          <span>Both eyes</span>
          <span className="value">{diagnostics.eyesVisible ? "Visible" : "Not confirmed"}</span>
        </div>
        <div className="status-row">
          <span>Vision pipeline</span>
          <span className="value">{diagnostics.fps > 0 ? `${diagnostics.fps} FPS` : "Starting…"}</span>
        </div>
      </section>

      {status.state === "CALIBRATION_REQUIRED" && (
        <div className="notice">
          <span className="notice-mark">i</span>
          <p>{diagnostics.error ?? "Live face landmarks are running locally. Calibration is required before cursor control can be enabled."}</p>
          <button className="notice-action" onClick={() => void openCalibration()}>Calibrate</button>
        </div>
      )}

      {status.state === "TRACKING_ACTIVE" && !status.nativeInputAuthorized && (
        <div className="notice">
          <span className="notice-mark">!</span>
          <p>Calibration is valid, but macOS Accessibility permission is required before EyeMouse can move the cursor.</p>
          <button className="notice-action" onClick={() => void window.eyemouse.openAccessibilitySettings()}>Open Settings</button>
          <button className="notice-action" onClick={() => void window.eyemouse.checkNativeInput()}>Check</button>
        </div>
      )}

      <footer className="footer">
        <label className="setting-toggle">
          <input type="checkbox" checked={preferences.launchAtLogin} onChange={() => void toggleLaunchAtLogin()} />
          <span className="toggle-track" aria-hidden="true"><span /></span>
          <span>Launch at login</span>
        </label>
        <span className="footer-version">v0.1</span>
      </footer>
    </main>
  );
}
