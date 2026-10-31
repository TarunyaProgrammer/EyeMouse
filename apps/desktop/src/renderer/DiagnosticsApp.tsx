import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { DiagnosticsSnapshot, SessionStatus } from "@eyemouse/shared-types";

const EMPTY: DiagnosticsSnapshot = { fps: 0, frameAgeMs: null, observations: 0, acceptedInteractions: 0, suppressedInteractions: 0, qualityState: "unknown", lastRecoveryRecommendation: null };

export function DiagnosticsApp(): JSX.Element {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState(EMPTY);

  useEffect(() => {
    const refresh = () => void Promise.all([window.eyemouse.getSessionStatus(), window.eyemouse.getDiagnostics()]).then(([nextStatus, nextDiagnostics]) => { setStatus(nextStatus); setDiagnostics(nextDiagnostics); });
    refresh();
    const timer = window.setInterval(refresh, 500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="settings-shell diagnostics-shell">
      <header className="settings-header"><div><p className="eyebrow">EyeMouse</p><h1>Diagnostics</h1><p className="settings-subtitle">Runtime signals for troubleshooting and extended-session evaluation.</p></div><button className="close-button" onClick={() => window.close()} aria-label="Close diagnostics">×</button></header>
      <section className="settings-section"><h2>Current session</h2><div className="diagnostics-grid"><div><span>State</span><strong>{status?.state ?? "—"}</strong></div><div><span>Quality</span><strong>{diagnostics.qualityState}</strong></div><div><span>Frame rate</span><strong>{diagnostics.fps} FPS</strong></div><div><span>Frame age</span><strong>{diagnostics.frameAgeMs === null ? "—" : `${Math.round(diagnostics.frameAgeMs)} ms`}</strong></div><div><span>Observations</span><strong>{diagnostics.observations}</strong></div><div><span>Input</span><strong>{status?.inputEnabled ? "Enabled" : "Disabled"}</strong></div></div></section>
      <section className="settings-section"><h2>Interaction safety</h2><div className="diagnostics-grid"><div><span>Accepted actions</span><strong>{diagnostics.acceptedInteractions}</strong></div><div><span>Suppressed actions</span><strong>{diagnostics.suppressedInteractions}</strong></div><div><span>Calibration error</span><strong>{status?.estimatedErrorPx === null || status?.estimatedErrorPx === undefined ? "Unknown" : `${Math.round(status.estimatedErrorPx)} px`}</strong></div><div><span>Native authorization</span><strong>{status?.nativeInputAuthorized ? "Granted" : "Not granted"}</strong></div></div><p className="settings-note">{diagnostics.lastRecoveryRecommendation ?? "No runtime recommendation is available until a session produces observations."}</p></section>
      <footer className="settings-footer"><span>Diagnostics are local and are not uploaded.</span><button className="secondary-button" onClick={() => void window.eyemouse.openSettings()}>Settings</button></footer>
    </main>
  );
}
