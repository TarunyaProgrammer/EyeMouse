import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { CameraStatus, Preferences, SessionState, SessionStatus } from "@eyemouse/shared-types";
import { CameraManager } from "./camera-manager";

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
  const cameraManager = useRef(new CameraManager());
  const cameraAttemptState = useRef<SessionState | null>(null);

  useEffect(() => {
    void Promise.all([window.eyemouse.getSessionStatus(), window.eyemouse.getPreferences()]).then(([nextStatus, nextPreferences]) => {
      setStatus(nextStatus);
      setPreferences(nextPreferences);
    });

    return window.eyemouse.onSessionStatusChanged(setStatus);
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
    if (status.state === "IDLE" || status.state === "STOPPED") cameraManager.current.release();
  }, [status]);

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
      cameraManager.current.release();
      await window.eyemouse.stopSession();
    }
  }

  async function toggleLaunchAtLogin(): Promise<void> {
    if (!preferences) return;
    const next = await window.eyemouse.setPreferences({ launchAtLogin: !preferences.launchAtLogin });
    setPreferences(next);
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
          <span>System input</span>
          <span className="value">{status.inputEnabled ? "Enabled" : "Disabled"}</span>
        </div>
      </section>

      {status.state === "CAMERA_READY" && (
        <div className="notice">
          <span className="notice-mark">i</span>
          <p>The camera boundary is working. Eye tracking and cursor control will be added after the vision pipeline is validated.</p>
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
