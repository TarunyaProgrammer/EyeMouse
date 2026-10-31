import { describe, expect, it } from "vitest";
import { InvalidSessionTransitionError, SessionMachine } from "./session-machine";

describe("SessionMachine", () => {
  it("allows the explicit startup path", () => {
    const machine = new SessionMachine();
    expect(machine.transition("INITIALIZING")).toBe("INITIALIZING");
    expect(machine.transition("CAMERA_READY")).toBe("CAMERA_READY");
    expect(machine.transition("CALIBRATION_REQUIRED")).toBe("CALIBRATION_REQUIRED");
    expect(machine.transition("TRACKING_ACTIVE")).toBe("TRACKING_ACTIVE");
  });

  it("rejects contradictory transitions", () => {
    const machine = new SessionMachine();
    expect(() => machine.transition("TRACKING_ACTIVE")).toThrow(InvalidSessionTransitionError);
    expect(machine.state).toBe("IDLE");
  });

  it("requires stable recovery from lost tracking", () => {
    const machine = new SessionMachine();
    machine.transition("INITIALIZING");
    machine.transition("CAMERA_READY");
    machine.transition("TRACKING_ACTIVE");
    machine.transition("TRACKING_LOST");
    expect(machine.canTransitionTo("TRACKING_ACTIVE")).toBe(true);
    expect(machine.canTransitionTo("LEFT_CLICK" as never)).toBe(false);
  });
});
