// Preflight brand mark: geometric document + verification badge, drawn only
// in ink/canvas tokens so it stays monochrome in both themes. A rounded
// document tile with extracted lines, motion ticks at its left edge, and a
// check badge overlapping the lower-right corner. No gradients, no AI
// sparkles, no borrowed logos.
export function PreflightMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className="pf-mark">
      <path
        d="M1 10.5h3.6M0 15h4.6"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="7" y="2.5" width="17.5" height="23" rx="5" fill="var(--ink)" />
      <rect x="11" y="6.5" width="9.5" height="13" rx="1.2" fill="var(--canvas)" />
      <path
        d="M13 10.3h5.5M13 13.3h5.5M13 16.3h3.4"
        stroke="var(--ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="20.5" r="6" fill="var(--ink)" stroke="var(--canvas)" strokeWidth="2" />
      <path
        d="M17.6 20.5l2.1 2.1 3.9-4.1"
        fill="none"
        stroke="var(--canvas)"
        strokeWidth="2"
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
