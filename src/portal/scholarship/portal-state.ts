// Portal-side application state (TASK-005A, extended TASK-007). This is the
// synthetic portal's OWN state — DRAFT, SAVED, or SUBMITTED. It knows nothing
// about Preflight evidence, findings, validation, profiles, or agent
// decisions. Pure and deterministic: the same interaction always yields the
// same visible state.
export type PortalApplicationState = "DRAFT" | "SAVED" | "SUBMITTED";

export function initialPortalState(): PortalApplicationState {
  return "DRAFT";
}

export function saveDraft(): PortalApplicationState {
  return "SAVED";
}

export function submitApplication(): PortalApplicationState {
  return "SUBMITTED";
}
