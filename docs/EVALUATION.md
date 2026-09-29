# Evaluation

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

## Rules
- Never invent final numbers.
- Targets are targets until measured.
- Evaluate against the same ground-truth cases every time.
- Keep baseline and assisted measurements on comparable synthetic cases.

## Command

```bash
npm run eval
```
