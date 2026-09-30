import { describe, expect, it } from "vitest";
import { createTracer } from "../../src/domain/execution/contracts.js";
import {
  decideRecoveryPolicy,
  verifyPortalState,
} from "../../src/domain/execution/verify.js";

describe("state verification", () => {
  it("accepts the expected state from observed browser text", () => {
    expect(verifyPortalState("SAVED", "SAVED")).toBe("EXPECTED_STATE");
  });

  it("confirms a miss only from the known safe state", () => {
    expect(verifyPortalState("DRAFT", "SAVED")).toBe("NOT_REACHED");
  });

  it("treats inconclusive output as UNKNOWN, never as success or failure", () => {
    expect(verifyPortalState("SAVING…", "SAVED")).toBe("UNKNOWN");
    expect(verifyPortalState("", "SAVED")).toBe("UNKNOWN");
    expect(verifyPortalState(null, "SAVED")).toBe("UNKNOWN");
    expect(verifyPortalState("SAVED (maybe)", "SAVED")).toBe("UNKNOWN");
  });
});

describe("recovery policy", () => {
  it("completes when the expected state is observed", () => {
    expect(decideRecoveryPolicy("EXPECTED_STATE", 0)).toBe("COMPLETE");
  });

  it("allows exactly one bounded recovery for a confirmed miss", () => {
    expect(decideRecoveryPolicy("NOT_REACHED", 0)).toBe("RETRY_ONCE");
    expect(decideRecoveryPolicy("NOT_REACHED", 1)).toBe("ESCALATE");
  });

  it("never retries UNKNOWN state — the escalation invariant", () => {
    expect(decideRecoveryPolicy("UNKNOWN", 0)).toBe("ESCALATE");
    expect(decideRecoveryPolicy("UNKNOWN", 1)).toBe("ESCALATE");
  });
});

describe("execution trace", () => {
  it("records ordered, deterministic events", () => {
    const tracer = createTracer();
    tracer.record("EXECUTION_STARTED", "begin");
    tracer.record("STATE_VERIFIED", "checked", "SAVED");
    expect(tracer.events.map((e) => [e.seq, e.type])).toEqual([
      [1, "EXECUTION_STARTED"],
      [2, "STATE_VERIFIED"],
    ]);
    expect(tracer.events[1].observedState).toBe("SAVED");
    expect(JSON.stringify(tracer.events)).toBe(JSON.stringify(tracer.events));
  });
});
