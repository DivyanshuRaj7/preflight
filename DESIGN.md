# Preflight DESIGN.md — Visual Source of Truth

> Product: **Preflight — The Application Compiler**
> Promise: **Verify before you submit.**
> Principle: **AI for ambiguity. Code for correctness.**
>
> This file is the sole visual reference for UI implementation (TASK-004+).
> Priority order: PRD → this DESIGN.md → Taste skill → UI/UX Pro Max →
> Vercel Web Design Guidelines (audit checklist).
>
> Reference lineage: Linear's *principles* (hierarchy, restraint, spacing
> discipline, dense-but-readable findings) — never its brand, logo, lavender
> accent, or exact identity. Preflight owns its status palette and voice.

## 1. Product Identity

Preflight is a **reliability/control interface for high-stakes applications**.
It is NOT a chatbot, a generic AI dashboard, a marketing landing page, a
flashy AI product, or a Linear clone.

Every screen must answer, in order:

1. What is wrong?
2. Why does Preflight believe it is wrong?
3. Which evidence supports it?
4. What should the user fix?
5. Can the application proceed?

Core information hierarchy:

```text
Evidence → Finding → Impact → Remediation → Decision → Action
```

## 2. Theme

- **Default: dark** (neutral near-black `#0a0a0b`) — the primary presentation
  for the console, where READY/BLOCKED status colors read most clearly. Light
  remains fully supported (`#faf9f7` canvas) for evidence-heavy reading.
- **Dark mode is first-class**, not an afterthought: same semantic tokens on
  a neutral near-black canvas (`#0a0a0b`), verified contrast both ways.
- **Manual toggle** in the masthead (sun/moon geometric icons) overrides the
  OS preference via `data-theme`. The choice is persisted and restored on
  every visit; first-time visitors get dark. A pre-paint boot script applies
  the stored theme before first render, so there is no flash of the wrong
  theme. One theme per screen; never invert sections mid-page.

## 3. Color System

### 3.1 Neutrals (light default / dark value)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--canvas` | `#faf9f7` | `#0a0a0b` | Page background |
| `--surface-1` | `#ffffff` | `#131416` | Raised panels, finding cards |
| `--surface-2` | `#f3f2ef` | `#1a1c1f` | Hovered rows, selected tabs |
| `--hairline` | `#e7e3da` | `#26262b` | 1px borders, dividers |
| `--hairline-strong` | `#d5d0c4` | `#37373e` | Input borders, focused rings base |
| `--ink` | `#16181d` | `#f4f5f6` | Headlines, primary text |
| `--ink-muted` | `#3f444d` | `#c9ced6` | Secondary text (≥ 4.5:1) |
| `--ink-subtle` | `#5f646b` | `#9aa0aa` | Meta, captions (≥ 4.5:1) |
| `--ink-faint` | `#8a8f98` | `#6b7078` | Disabled, footnotes only — never body |

One neutral family per theme. No mixing warm and cool grays.

### 3.2 Preflight Status Palette (product-owned, never Linear lavender)

| State | Color (light/dark) | Icon | Meaning |
|---|---|---|---|
| `READY` | green `#178a4c` / `#3fb96f` | check-circle | Safe to proceed toward approval |
| `BLOCKED` | red `#c4322b` / `#e5605a` | octagon-x | Must fix; submission impossible |
| `AWAITING APPROVAL` | amber `#b7791f` / `#d9a13b` | pause-circle | Filled and verified; human decision pending |
| `APPROVED` | teal `#0e7c7b` / `#3fb3b2` | stamp-check | Human authorized this exact version |
| `SUBMITTED` / `VERIFIED` | blue-gray `#3b5bdb` / `#7d9bf5` | arrow-up-circle / badge-check | Terminal success states |
| Pipeline (`DRAFT`, `EXTRACTING`, `VALIDATING`, `EXECUTING`, `VERIFYING`, `RECOVERING`) | gray `--ink-subtle` | spinner / dot | Transient; never success-colored |

Rules:

- **Never color alone.** Every status pairs color with text label + icon.
- **No AI purple.** No purple/blue gradients or glows anywhere. No second
  chromatic accent beyond the status palette above.
- Status colors are reserved for status. Do not reuse green/red/amber for
  decoration, charts, or branding.

## 4. Typography

- **Primary sans:** Inter (weights 400 / 500 / 600). Linear-style neutral
  engineering voice; explicitly chosen, not defaulted.
- **Mono:** Geist Mono (fallback JetBrains Mono, `ui-monospace`) for
  evidence IDs, document IDs, profile versions, finding rule IDs, hashes.
- **No serif.** No display-serif emphasis. Emphasis = weight or italic of
  the same family.

| Token | Size | Weight | Line-height | Tracking | Use |
|---|---|---|---|---|---|
| `display` | 32px | 600 | 1.2 | -0.02em | Page titles (e.g. application name + status) |
| `h2` | 22px | 600 | 1.25 | -0.01em | Section headings |
| `h3` | 16px | 600 | 1.3 | 0 | Finding titles, panel headings |
| `body` | 15px | 400 | 1.55 | 0 | Default reading, evidence text |
| `body-sm` | 13.5px | 400 | 1.5 | 0 | Secondary rows, metadata |
| `caption` | 12px | 400 | 1.4 | 0 | Meta, timestamps, provenance lines |
| `mono` | 12.5px | 400 | 1.5 | 0 | IDs, rule IDs, evidence refs |
| `button` | 14px | 500 | 1.2 | 0 | All button labels |

Body measure: max ~70ch on evidence-heavy screens. Minimum body size 13.5px;
captions never carry essential meaning alone.

## 5. Spacing & Shape

- **Base unit 4px.** Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Section gaps 64.
- **Radius rule (locked):** buttons/inputs `6px`, badges/pills `9999px`,
  finding cards `8px`, panels `8px`. No other radii without a documented rule.
- **Elevation:** flat surfaces + 1px `--hairline` borders. No drop shadows
  except a restrained popover/menu shadow. Cards only where grouping needs a
  container; otherwise `border-top` / `divide-y` rows and whitespace.
- **Density:** finding and evidence rows are compact (12–16px padding) but
  never cramped: one finding per visual block, generous line-height.

## 6. Layout

### 6.1 Application shell (refined TASK-004A)

```text
┌──────────────────────────────────────────────┐
│ Masthead 60px: [mark] Preflight · compiler   │
│   SYNTHETIC · ref date · theme toggle        │
├──────────────────────────────────────────────┤
│ WorkspaceHeader: eyebrow · Scholarship       │
│   Renewal · CASE-001 · CLEAN                 │
│   [active application] [Run Preflight]       │
│   Documents → Validation → Decision          │
├──────────────────────────────────────────────┤
│ StatusPanel: WORD + counts + version         │
├───────────────────────────────────┬──────────┤
│ FindingList (primary)             │ Evidence │
│ Documents                         │ Panel    │
└───────────────────────────────────┴──────────┘
```

- TopBar 56px, single line, no mega-nav.
- **Brand mark:** monochrome document tile with extracted lines, motion ticks
  at its left edge, and a verification check badge overlapping the corner,
  plus "Preflight" wordmark and "The Application Compiler" descriptor. Own
  identity; no borrowed marks, no gradients.
- **No sidebar.** Rationale: Preflight is a single-workspace verification
  tool, not a multi-section app. A sidebar of anchor links adds chrome
  without function; section order (findings → documents, evidence aside)
  carries navigation. If later tasks add genuinely separate areas (portal
  run, approval queue), a sidebar may return.
- Max content width 1120px, centered. Two-column work area collapses to one
  column below 1024px (findings first, evidence panel inline below).
- **WorkspaceHeader** (in-flow, not sticky): eyebrow, case title, case/version
  meta, case selector + the single Run Preflight action, and an honest
  three-stage stepper (Application → Validation → Decision) reflecting only
  observable states.
- **StatusPanel**: giant status word with icon (never color alone), one-line
  verdict, and counts computed from the run (documents, evidenced critical
  fields, blocking findings). Technical metadata (profile version) stays out
  of the primary UI; it remains in domain output and fixtures. No sticky
  positioning, so focused elements are never covered.
- **Pipeline panel** (refinement): the decision word first (READY: verified-
  against-evidence copy with computed counts plus the human-approval note;
  BLOCKED: cannot-proceed copy with the issue count), then a single segmented
  Documents → Extraction → Validation row with hairline separators (no cards),
  then a labeled Document-coverage bar (coverage only, never overall
  completion), then real actions. Stage statuses are computed from the run —
  never staged animation. Profile metadata stays faint and last.

### 6.2 Finding layout (the core block)

```text
[spine] [StatusBadge] RULE_ID (mono)
Title: human-readable message (h3)
Why: severity · blocking · field (body-sm)
Compared values (when cited values differ):
  identity · doc-identity ......... Rina Das
  bank-proof · doc-bank-proof ..... Rina Dey
Evidence: [ev-id → doc] [ev-id → doc]    (mono chips, clickable)
Remediation: action text + target        (remediation area)
```

Findings carry a 3px status spine (red when blocking) alongside the badge —
still never color alone. The compared-values block groups cited evidence by
source document so conflicts read in ~2 seconds; it renders only when cited
values actually differ and encodes no rule knowledge.

### 6.3 Evidence layout

EvidencePanel shows the selected finding's evidence: document thumbnail or
extracted-text excerpt, field name, extracted value, confidence, page/bbox
reference, extraction method. Every evidence item links back to its source
document row. Confidence shown as plain text (`0.42 — below 0.75 threshold`),
never as a decorative gauge.

### 6.4 Remediation area

Inside each BLOCKED finding: imperative action text, the exact target
(document/field), and (when applicable) the control to fix or re-supply it.
No remediation = incomplete finding UI.

## 7. Component Principles

- **StatusBadge:** pill, mono-uppercase 12px label + icon + status color.
  Always text, never dot-only.
- **Finding / FindingList:** one finding per bordered block, `divide-y`
  list, sorted in engine order. List header shows counts
  (`3 blocking · 0 warnings`). Empty state: explicit "No findings — all
  checks passed" (never blank space).
- **EvidenceReference:** mono chip `ev-id → documentId`, keyboard-focusable,
  activates the EvidencePanel. Shows confidence on hover/focus, not by default.
- **EvidencePanel:** contextual detail pane; document excerpt, field/value,
  confidence vs threshold, method, page reference.
- **DocumentRow:** document type, status (`present/missing/expired/invalid`),
  field count, link to evidence. Missing documents render as explicit empty
  rows with remediation affordance.
- **ValidationSummary:** counts by severity, reference date used, engine
  version/profile version (mono), re-validate trigger.
- **Remediation:** action-first copy, target-identified, single CTA.
- **Step/Progress indicator:** pipeline states as a labeled stepper
  (DRAFT → … → VERIFIED); current step text-labeled, failures branch visibly
  to RECOVER/ESCALATE. No animated progress-bar theater.
- **ApprovalGate (future):** version-pinned summary, explicit approve/reject,
  identity of approver, irreversible-action warning. Never pre-checked.
- **Timeline/Trace (future):** append-only event log, mono timestamps,
  state transitions with actor (user/system).

TASK-004 implements only what it needs; future components follow these
principles when built.

## 8. Motion

Restrained. Allowed only to communicate state transition, progress, loading,
or confirmation:

- Finding expand/collapse: ≤160ms ease-out, opacity + translateY ≤8px.
- Status change: badge crossfade, no bounce, no confetti.
- Loading: skeleton blocks matching finding-row shape (never spinners or
  "AI thinking" animations).
- `prefers-reduced-motion: reduce` → all motion becomes instant. No
  exceptions. Animate `transform`/`opacity` only.

## 9. Responsive Design

| Breakpoint | Behavior |
|---|---|
| Desktop ≥1024px | Workspace header, status panel, two-column work area |
| Tablet 768–1023px | Single column, evidence panel inline below findings |
| Mobile <768px | TopBar condensed (ref date hidden); controls stack full-width; one column; finding blocks full-width; compared-values stack; evidence chips wrap; tap targets ≥44px |

Evidence and findings stay fully readable at 360px: no truncated rule IDs
(wrap, don't clip), no hover-only affordances, tables become stacked rows.

## 10. Accessibility (Vercel-guidelines audit bar)

- Keyboard: full task completion without a pointer; visible `:focus-visible`
  rings (2px, status-neutral outline + offset); logical focus order
  StatusHeader → findings → evidence → actions; no keyboard traps.
- Semantics: `header/nav/main/aside`, findings as `article` in a `list`,
  status as `role="status"` live region (polite) so READY/BLOCKED changes
  announce; buttons are `<button>`, never divs.
- Labels: every icon-only control has `aria-label`; evidence chips expose
  full `ev-id, document, field` text; form inputs labeled above, errors below.
- Contrast: body ≥ 4.5:1, large text ≥ 3:1, UI components/focus ≥ 3:1 —
  verified in both themes. No essential gray-on-gray text.
- Non-color status: icon + text + position always accompany color.
- Reduced motion honored (see §8). Touch targets ≥44px on coarse pointers.

## 11. Anti-Patterns (prohibited)

Purple AI gradients/glows · glassmorphism · giant heroes · chatbot-first UI ·
excessive rounded cards · decorative dashboards · meaningless metrics · fake
AI thinking/typing animations · heavy shadows · low-contrast gray body text ·
color-only status · unmotivated animation · marketing UI inside the app ·
centered hero over mesh · three-equal-feature-card grids · infinite micro-
animation loops · custom cursors · div-based fake screenshots · placeholder-
as-label · duplicate CTA intents · serif display type · emoji as iconography.

## 12. Design Read (Taste-skill declaration)

*Reading this as: trust-first reliability tool for applicants/operators facing
high-stakes submission, with a restrained engineering language, leaning toward
Linear-grade density + spacing discipline with a Preflight-owned status
palette and light-first evidence surfaces.*
Dials: VARIANCE 4 · MOTION 2 · DENSITY 6.

## 12b. Copy Voice

User-operated software, not a test harness. Prefer "Verify an application
before it is submitted" over implementation wording ("deterministic
extraction and validation pipeline"). Application context leads ("Scholarship
Renewal"); case IDs, profile versions, and method names stay secondary
metadata. Implementation details keep no visual prominence.

## 13. Reviews

- **PRD:** hierarchy Evidence→…→Action serves "correctness before submission";
  READY/BLOCKED unmistakable; approval gate explicit; no portals/PII/demos
  affected — presentation only.
- **Linear reference:** hierarchy, restraint, 4px scale, hairline surfaces,
  mono IDs, pill badges, dense finding rows adopted; lavender, logo, dark-
  only canvas, marketing patterns left behind.
- **Vercel audit:** §10 encodes keyboard/focus/semantics/contrast/motion
  requirements for TASK-004 review.
- **Identity preserved:** status palette, light-first evidence canvas, and
  "Verify before you submit" voice are Preflight-owned.
