import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CalibrationApp } from "./CalibrationApp";
import { SettingsApp } from "./SettingsApp";
import { OnboardingApp } from "./OnboardingApp";
import "./styles.css";

const isCalibration = new URLSearchParams(window.location.search).get("calibration") === "1";
const params = new URLSearchParams(window.location.search);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isCalibration ? <CalibrationApp /> : params.get("settings") === "1" ? <SettingsApp /> : params.get("onboarding") === "1" ? <OnboardingApp /> : <App />}
  </React.StrictMode>
);
