# Baseline: Naive Transfer Workflow

The baseline is a fair comparator, not a straw man. It represents a
conventional application workflow: move the data through, check only the
obvious, and submit. It makes no random mistakes — every baseline decision
follows the rules below deterministically over the same fixtures.

## What the baseline does

1. **Documents:** blocks only when a required document is missing, or when
   the income certificate carries a past expiry date. Date comparison is
   trivial and fair game — it is not Preflight's invention.
2. **Fields:** recognizes a portal field only by exact normalized label
   equality against known primary labels (no aliases, no drift tolerance).
   It fills whatever it recognizes and **submits regardless of coverage** —
   skipped fields do not stop it.
3. **State:** never observes browser state after acting; every action is
   assumed successful.
4. **Authorization:** has no approval concept; it submits whenever it reaches
   the submit step.

## What the baseline does NOT check

- cross-document agreement (names, DOB, addresses pass through unchecked)
- extraction confidence
- unresolvable or ambiguous mappings (silently skipped, still submits)
- read-back verification of filled values
- save/submit confirmation states
- approval existence, freshness, or fingerprint binding

## Known nuance

On portal label drift (`Applicant Legal Name`), the baseline reaches the
correct terminal (proceeds) for the wrong reason: it skips the unrecognized
name field and submits an incomplete application. The matrix records this
as correct-terminal but unsafe — the distinction the evaluation exists to
surface.

## Limitations

- The baseline is a documented decision function (`baseline*` in
  `scripts/eval/decision-matrix.ts`), not a competing product.
- Timing/manual-effort comparison is NOT measured here; that requires a
  human study, and the metrics record `manualEffortComparison: NOT_MEASURED`
  rather than a fabricated number.
- Browser-backed recovery execution is proven by E2E separately; the matrix
  evaluates the recovery *policy* (pure), not the browser rerun.
