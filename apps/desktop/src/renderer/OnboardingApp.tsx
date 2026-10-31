import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { SessionStatus } from "@eyemouse/shared-types";

type OnboardingStep = 0 | 1 | 2 | 3 | 4;

export function OnboardingApp(): JSX.Element {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void window.eyemouse.getSessionStatus().then(setStatus);
    const timer = window.setInterval(() => void window.eyemouse.getSessionStatus().then(setStatus), 600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (step === 3 && status?.state === "TRACKING_ACTIVE") {
      setStep(4);
      setMessage("Calibration is valid. Check Accessibility before enabling cursor input.");
    }
  }, [status?.state, step]);

  async function checkCamera(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This Mac does not expose a compatible camera API.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      for (const track of stream.getTracks()) track.stop();
      setCameraReady(true);
      setMessage("Camera access is ready. Frames remain on this Mac.");
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "NotAllowedError" ? "Camera access was denied. Allow it in System Settings, then try again." : error instanceof Error ? error.message : "Camera access could not be checked.");
    } finally {
      setBusy(false);
    }
  }

  async function startCalibration(): Promise<void> {
    setBusy(true);
    setMessage("Starting the session from the menu-bar control layer…");
    try {
      const current = await window.eyemouse.getSessionStatus();
      if (current.state === "IDLE" || current.state === "STOPPED") await window.eyemouse.startSession();
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const next = await window.eyemouse.getSessionStatus();
        setStatus(next);
        if (next.state === "CALIBRATION_REQUIRED") {
          await window.eyemouse.openCalibration();
          setMessage("Complete the calibration targets, then return here.");
          return;
        }
        if (next.state === "TRACKING_ACTIVE") {
          setStep(4);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      setMessage("The camera session did not become ready. Open the menu-bar controls for details.");
    } finally {
      setBusy(false);
    }
  }

  async function checkAccessibility(): Promise<void> {
    setBusy(true);
    const next = await window.eyemouse.checkNativeInput();
    setStatus(next);
    setMessage(next.nativeInputAuthorized ? "Accessibility access is enabled." : "Accessibility access is still required for cursor control.");
    setBusy(false);
  }

  async function finish(): Promise<void> {
    await window.eyemouse.setPreferences({ onboardingComplete: true });
    window.close();
  }

  const content = step === 0
    ? { eyebrow: "A private control layer", title: "Control your Mac with your eyes.", body: "EyeMouse processes camera frames locally. Nothing is uploaded, and cursor control never starts without an explicit session start." }
    : step === 1
      ? { eyebrow: "Step 1 · Camera", title: "Check your camera.", body: cameraReady ? "Camera access is available. EyeMouse will release the stream when the session stops." : "The camera is used only during an explicit session. Check access before continuing." }
      : step === 2
        ? { eyebrow: "Step 2 · Position", title: "Sit comfortably and keep both eyes visible.", body: "Place the camera near eye level, avoid strong backlighting, and keep your head steady during calibration." }
        : step === 3
          ? { eyebrow: "Step 3 · Calibration", title: "Personalize the gaze mapping.", body: "EyeMouse will collect stable samples across the selected display and validate them on separate targets." }
          : { eyebrow: "Step 4 · Accessibility", title: "Allow cursor control only when you are ready.", body: "Camera permission and Accessibility permission are separate. EyeMouse remains unable to move the cursor until Accessibility is granted." };

  return (
    <main className="onboarding-shell">
      <div className="onboarding-mark" aria-hidden="true">◉</div>
      <p className="eyebrow">{content.eyebrow}</p>
      <h1>{content.title}</h1>
      <p className="onboarding-body">{content.body}</p>
      {message && <p className="onboarding-message" role="status">{message}</p>}
      {step === 4 && <p className="onboarding-status">{status?.nativeInputAuthorized ? "Accessibility enabled" : "Accessibility not enabled"}</p>}
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of 5`}>{[0, 1, 2, 3, 4].map((index) => <span key={index} className={index === step ? "active" : index < step ? "complete" : ""} />)}</div>
      <div className="onboarding-actions">
        {step > 0 && <button className="secondary-button" disabled={busy} onClick={() => setStep((value) => (value - 1) as OnboardingStep)}>Back</button>}
        {step === 0 && <button className="primary-action" onClick={() => setStep(1)}>Continue</button>}
        {step === 1 && <><button className="secondary-button" disabled={busy} onClick={() => void checkCamera()}>{busy ? "Checking…" : "Check camera"}</button><button className="primary-action" disabled={!cameraReady || busy} onClick={() => setStep(2)}>Continue</button></>}
        {step === 2 && <button className="primary-action" disabled={busy} onClick={() => setStep(3)}>Continue</button>}
        {step === 3 && <button className="primary-action" disabled={busy} onClick={() => void startCalibration()}>{busy ? "Preparing…" : "Start calibration"}</button>}
        {step === 4 && <><button className="secondary-button" disabled={busy} onClick={() => void window.eyemouse.openAccessibilitySettings()}>Open Accessibility</button><button className="secondary-button" disabled={busy} onClick={() => void checkAccessibility()}>Check access</button><button className="primary-action" disabled={busy} onClick={() => void finish()}>Finish setup</button></>}
      </div>
    </main>
  );
}
