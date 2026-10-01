# Evaluation

Measured results live in `docs/EVALUATION_REPORT.md` (generated from
`eval/results.json` via `npm run eval`). The sections below describe
methodology; numbers live in the report, never the reverse.

READY verdict semantics: in this evaluation, READY records that no
blocking condition was detected under the defined rules — never that the
underlying facts are objectively true. CASE-011 pins the distinction.

## Dataset
The evaluation suite is deterministic synthetic data with ground-truth expected outcomes in `fixtures/manifest.json` and `fixtures/expected/`.

Initial cases:
- clean
- name mismatch
- DOB mismatch
- missing income certificate
- expired certificate
- low-confidence extraction

Add portal drift and timeout to the execution/e2e suite when those layers exist.

## Metrics
- Extraction accuracy
- Conflict recall
- False-positive rate
- Required-document accuracy
- Freshness/expiry detection
- Failure recovery rate
- Portal completion rate
- Unsafe/unapproved submission prevention
- Manual vs assisted completion time

## OCR layer evaluation (separate from decision evaluation)

`npm run eval:ocr` measures the OCR layer only: documents processed,
OCR success/failure rate, expected-key-text detection, low-confidence
cases, and typed processing failures. Current: 4/4 synthetic documents
SUCCESS with all expected key texts detected. These are layer metrics —
they do not replace the 28/29 decision evaluation, and no accuracy
percentage beyond the measured per-document outcomes is claimed.

Semantic interpretation is exercised by unit/integration tests, not by a
model-accuracy metric: the deterministic provider runs by default, and live
OpenRouter inference is opt-in only — so no "AI accuracy" is reported
unless a measured live run exists.

## Adversarial and boundary evaluation

Beyond the manifest cases, `npm run eval` runs an adversarial gate over
`fixtures/adversarial/cases.json`: ambiguous/unseen/unsupported portal
labels must resolve to refusal (never to a match), and unexpected,
missing, or stuck browser states must resolve to UNKNOWN or a confirmed
miss — never to success.

Evaluation must measure, separately:

- correct success decisions (READY/VERIFIED on clean inputs)
- correct block decisions (BLOCKED with the right rule)
- correct recovery decisions (exactly one bounded retry, then verified)
- correct escalation decisions (UNKNOWN preserved, no retry)
- unsafe-submit prevention (no path from uncertainty to submission)
- decision coverage across the failure taxonomy (`docs/FAILURE_COVERAGE.md`)

Distinguish "handled correctly" from "recognized as outside supported
coverage". The latter is a valid and desirable result: a system that
reports UNSUPPORTED instead of guessing is working as designed. Never
report unsupported coverage as 100%, and never present test counts as
accuracy metrics.

## Rules
- Never invent final numbers.
- Targets are targets until measured.
- Evaluate against the same ground-truth cases every time.
- Keep baseline and assisted measurements on comparable synthetic cases.

## Command

```bash
npm run eval
```
