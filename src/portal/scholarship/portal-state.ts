// Portal-side application state (TASK-005A). This is the synthetic portal's
// OWN state — DRAFT or SAVED. It knows nothing about Preflight evidence,
// findings, validation, profiles, or agent decisions. Pure and deterministic:
// the same interaction always yields the same visible state.
export type PortalApplicationState = "DRAFT" | "SAVED";

export function initialPortalState(): PortalApplicationState {
  return "DRAFT";
}

export function saveDraft(): PortalApplicationState {
  return "SAVED";
}
