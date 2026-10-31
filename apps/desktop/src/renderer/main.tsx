import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CalibrationApp } from "./CalibrationApp";
import "./styles.css";

const isCalibration = new URLSearchParams(window.location.search).get("calibration") === "1";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isCalibration ? <CalibrationApp /> : <App />}
  </React.StrictMode>
);
