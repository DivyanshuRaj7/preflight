import type { PreflightResult } from "../domain/contracts.js";

export type BadgeState = PreflightResult["status"] | "NOT_RUN";

const META: Record<BadgeState, { label: string; className: string; icon: "check" | "cross" | "dot" }> = {
  READY: { label: "READY", className: "pf-badge-ready", icon: "check" },
  BLOCKED: { label: "BLOCKED", className: "pf-badge-blocked", icon: "cross" },
  NOT_RUN: { label: "NOT RUN", className: "pf-badge-neutral", icon: "dot" },
};

function Icon({ kind }: { kind: "check" | "cross" | "dot" }) {
  if (kind === "check") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5.5 8.2l1.8 1.8 3.2-3.8" />
      </svg>
    );
  }
  if (kind === "cross") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M6 6l4 4M10 6l-4 4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Status is never color alone: icon + uppercase text label + status color.
export function StatusBadge({ status }: { status: BadgeState }) {
  const meta = META[status];
  return (
    <span className={`pf-badge ${meta.className}`} translate="no">
      <Icon kind={meta.icon} />
      {meta.label}
    </span>
  );
}
