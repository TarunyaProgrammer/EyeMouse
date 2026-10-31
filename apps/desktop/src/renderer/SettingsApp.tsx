import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { Preferences, UpdateStatus } from "@eyemouse/shared-types";
import { useMemo } from "react";

export function SettingsApp(): JSX.Element {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [displays, setDisplays] = useState<Array<{ displayId: string; width: number; height: number }>>([]);
  const [updates, setUpdates] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    void window.eyemouse.getPreferences().then(setPreferences);
    void navigator.mediaDevices?.enumerateDevices().then((devices) => setCameras(devices.filter((device) => device.kind === "videoinput")));
    void window.eyemouse.getDisplays().then(setDisplays);
    void window.eyemouse.getUpdateStatus().then(setUpdates);
    return window.eyemouse.onUpdateStatusChanged(setUpdates);
  }, []);

  const cameraOptions = useMemo(() => cameras.map((camera, index) => ({ id: camera.deviceId, label: camera.label || `Camera ${index + 1}` })), [cameras]);

  async function update(patch: Partial<Preferences>): Promise<void> {
    const next = await window.eyemouse.setPreferences(patch);
    setPreferences(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  if (!preferences) return <main className="settings-shell shell-loading">Loading settings…</main>;

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div><p className="eyebrow">EyeMouse</p><h1>Settings</h1><p className="settings-subtitle">Tune control behavior without changing the safety policy.</p></div>
        <button className="close-button" onClick={() => window.close()} aria-label="Close settings">×</button>
      </header>
      <section className="settings-section">
        <h2>Interaction</h2>
        <label className="settings-field"><span><strong>Click method</strong><small>Choose how EyeMouse confirms an intentional click.</small></span><select value={preferences.interactionMode} onChange={(event) => void update({ interactionMode: event.target.value as Preferences["interactionMode"] })}><option value="dwell">Dwell</option><option value="wink">Unilateral wink</option></select></label>
        <label className="settings-field settings-range"><span><strong>Cursor sensitivity</strong><small>{preferences.cursorSensitivity.toFixed(2)}× mapping scale</small></span><input type="range" min="0.25" max="4" step="0.05" value={preferences.cursorSensitivity} onChange={(event) => void update({ cursorSensitivity: Number(event.target.value) })} /></label>
        <label className="settings-field settings-range"><span><strong>Smoothing</strong><small>{Math.round(preferences.smoothing * 100)}% stabilization</small></span><input type="range" min="0" max="1" step="0.05" value={preferences.smoothing} onChange={(event) => void update({ smoothing: Number(event.target.value) })} /></label>
        <label className="settings-field"><span><strong>Camera</strong><small>Choose the camera used for local tracking.</small></span><select value={preferences.cameraDeviceId ?? ""} onChange={(event) => void update({ cameraDeviceId: event.target.value || null })}><option value="">Automatic</option>{cameraOptions.map((camera) => <option key={camera.id} value={camera.id}>{camera.label}</option>)}</select></label>
        <label className="settings-field"><span><strong>Calibration display</strong><small>Saved profiles are invalidated when this geometry changes.</small></span><select value={preferences.calibrationDisplayId ?? ""} onChange={(event) => void update({ calibrationDisplayId: event.target.value || null })}><option value="">Primary display</option>{displays.map((display) => <option key={display.displayId} value={display.displayId}>{display.displayId} · {display.width}×{display.height}</option>)}</select></label>
      </section>
      <section className="settings-section">
        <h2>Startup and privacy</h2>
        <label className="settings-check"><input type="checkbox" checked={preferences.launchAtLogin} onChange={(event) => void update({ launchAtLogin: event.target.checked })} /><span><strong>Launch at login</strong><small>Start as a menu-bar utility after you sign in.</small></span></label>
        <p className="settings-note">Camera frames, landmarks, calibration data and pointer decisions stay on this Mac. EyeMouse does not upload them.</p>
      </section>
      <section className="settings-section">
        <h2>Updates</h2>
        <div className="settings-update-row"><span><strong>{updates?.state === "disabled" ? "Release updates disabled" : updates?.state === "available" ? `Version ${updates.version} available` : updates?.state === "downloaded" ? `Version ${updates.version} ready` : "EyeMouse updates"}</strong><small>{updates?.message ?? "Check for signed releases."}</small></span><span className="settings-update-actions">{updates?.state === "available" ? <button className="secondary-button" onClick={() => void window.eyemouse.downloadUpdate()}>Download</button> : updates?.state === "downloaded" ? <button className="secondary-button" onClick={() => void window.eyemouse.installUpdate()}>Restart to install</button> : <button className="secondary-button" disabled={updates?.state === "disabled" || updates?.state === "checking"} onClick={() => void window.eyemouse.checkForUpdates()}>{updates?.state === "checking" ? "Checking…" : "Check now"}</button>}</span></div>
      </section>
      <footer className="settings-footer"><span>{saved ? "Saved" : "Changes apply immediately"}</span><button className="secondary-button" onClick={() => void window.eyemouse.openAccessibilitySettings()}>Accessibility settings</button></footer>
    </main>
  );
}
