// Preflight brand mark: geometric only — an ink tile carrying a verification
// check whose long arm overshoots into a flight path. Own identity; no
// borrowed logos, no gradients, no AI sparkles.
export function PreflightMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className="pf-mark">
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" fill="var(--ink)" />
      <path
        d="M8 14.5l4.8 4.8L21 9.5"
        fill="none"
        stroke="var(--canvas)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="3.2" />
      <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" strokeLinejoin="round" />
    </svg>
  );
}
