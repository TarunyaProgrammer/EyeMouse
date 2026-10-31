import { useState } from "react";
import type { JSX } from "react";

export function OnboardingApp(): JSX.Element {
  const [step, setStep] = useState(0);
  const steps = [
    { eyebrow: "A private control layer", title: "Control your Mac with your eyes.", body: "EyeMouse processes camera frames locally. Nothing is uploaded, and cursor control never starts without an explicit session start." },
    { eyebrow: "Two permissions, two reasons", title: "Camera sees your gaze. Accessibility moves the cursor.", body: "macOS keeps these permissions separate. EyeMouse explains each request and remains disabled until tracking is calibrated and stable." },
    { eyebrow: "You stay in control", title: "Start from the menu bar when you are ready.", body: "After setup, open the EyeMouse menu-bar icon, start a session, complete calibration, then choose dwell or wink clicking in Settings." }
  ];
  const current = steps[step];

  async function finish(): Promise<void> {
    await window.eyemouse.setPreferences({ onboardingComplete: true });
    window.close();
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-mark" aria-hidden="true">◉</div>
      <p className="eyebrow">{current.eyebrow}</p><h1>{current.title}</h1><p className="onboarding-body">{current.body}</p>
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>{steps.map((_, index) => <span key={index} className={index === step ? "active" : ""} />)}</div>
      <div className="onboarding-actions">{step > 0 && <button className="secondary-button" onClick={() => setStep((value) => value - 1)}>Back</button>}{step < steps.length - 1 ? <button className="primary-action" onClick={() => setStep((value) => value + 1)}>Continue</button> : <button className="primary-action" onClick={() => void finish()}>Finish setup</button>}</div>
    </main>
  );
}
