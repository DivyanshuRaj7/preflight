# Preflight Failure Taxonomy

Preflight does not try to handle every possible failure. It explicitly
defines what it knows about, what it decides for each, and where its model
ends. Anything outside the model stops the system instead of guessing.

The machine-readable source of this taxonomy is
`src/domain/safety/taxonomy.ts` (`CATEGORY_POLICY`, `RULE_CATEGORY`).
If this document and that table disagree, the table governs and this
document is stale — fix it, do not work around it.

## A. EVIDENCE_FAILURE

- **Definition:** source material is missing, invalid, expired,
  untrustworthy, or self-contradictory.
- **Examples:** missing/invalid/expired required document, low-confidence
  extraction, conflicting evidence, dangling evidence provenance.
- **Detection:** `validateProfile` evidence rules.
- **Resulting state:** `BLOCKED` with blocking findings.
- **Retry:** never (re-running the same evidence changes nothing).
- **Human review:** required (supply or correct the source material).
- **Submission:** never.

## B. PROFILE_FAILURE

- **Definition:** assembled identity facts disagree across documents.
- **Examples:** name / DOB / address mismatch, including contradictions
  inside a single document.
- **Detection:** `validateProfile` agreement rules.
- **Resulting state:** `BLOCKED` with blocking findings.
- **Retry:** never.
- **Human review:** required (correct the source documents).
- **Submission:** never.

## C. MAPPING_FAILURE

- **Definition:** portal wording cannot be safely resolved to a canonical field.
- **Examples:** unmapped label, ambiguous label, unsupported extra field.
- **Detection:** deterministic baseline mapper statuses `AMBIGUOUS` / `UNMAPPED`.
- **Resulting state:** execution refused before any browser interaction.
- **Retry:** never (the wording did not change).
- **Human review:** required (extend the alias model deliberately, with tests).
- **Submission:** never.

## D. EXECUTION_FAILURE

- **Definition:** a browser action observably failed to change state.
- **Examples:** save did not occur, filled value did not persist.
- **Detection:** independent DOM read-back in `finalizeExecution`.
- **Resulting state:** `FAILED`; Save Draft forbidden with expected-vs-observed.
- **Retry:** exactly once, and only for a *confirmed* miss (`NOT_REACHED`).
- **Human review:** required after the single recovery is spent.
- **Submission:** never.

## E. STATE_VERIFICATION_FAILURE

- **Definition:** observed browser state is not the expected state, or is
  inconclusive (empty, stuck transitional text, unrecognized content).
- **Detection:** `verifyPortalState` → `EXPECTED_STATE` / `NOT_REACHED` / `UNKNOWN`.
- **Resulting state:** `RECOVERED` (one bounded retry then verified),
  `FAILED` (budget spent), or `ESCALATED` (inconclusive).
- **Retry:** only for confirmed `NOT_REACHED`, at most once. `UNKNOWN`
  never retries.
- **Human review:** required on `FAILED` and always on `ESCALATED`.
- **Submission:** never.

## F. AUTHORIZATION_FAILURE

- **Definition:** approval is missing, stale, void, or bound to a different state.
- **Examples:** no approval, fingerprint mismatch after a state change,
  approval for a different profile version.
- **Detection:** `checkApproval` + `authorizeSubmission` typed denials.
- **Resulting state:** submission refused with an explicit reason.
- **Retry:** never (a new explicit human approval is the only path).
- **Human review:** required — it IS the missing piece.
- **Submission:** never.

## G. MODEL_BOUNDARY_FAILURE

- **Definition:** the situation falls outside the supported schema,
  workflow, or evidence model — Preflight cannot establish a trustworthy
  conclusion at all.
- **Examples:** unrecognized detector output, unsupported document
  condition, unsupported portal shape, contradictory observations the
  model cannot adjudicate, any state the verifier does not understand.
- **Detection:** `SafetyDecision` with uncertainty `UNCERTAIN`; unknown rule
  IDs map here by construction.
- **Resulting state:** `BLOCK` or `ESCALATE` onto an existing terminal
  (`BLOCKED`, `ESCALATED`, `INVALIDATED`, `UNMAPPED`, `AMBIGUOUS`, `UNKNOWN`).
  Never a success state — enforced structurally, not by convention.
- **Measured gap:** uniformly false but internally consistent evidence
  (CASE-011) is NOT SUPPORTED: with no independent signal, the pipeline
  concludes READY. The authorization boundary still holds (explicit approval
  remains mandatory), but the READY itself is false. See §14 of the
  evaluation report.
- **Retry:** never.
- **Human review:** required.
- **Submission:** never.

## Out of scope — explicit boundary

Preflight does NOT claim to understand arbitrary documents, arbitrary
portals, arbitrary semantic mappings, or arbitrary application workflows.
When assumptions fall outside the supported model, Preflight stops rather
than guesses. This is a product reliability boundary, not a weakness to
hide: a system that says "I cannot verify this" is safer than one that
pretends it did.
