# Preflight — Product Requirements Document

## Product
**Preflight — The Application Compiler**  
BFWAI/HACK 26 · PS-01 Autonomous Agents for Everyday Apps

## Thesis
Most agents optimize for completion. Preflight optimizes for correctness before submission.

> AI for ambiguity. Code for correctness.

## Locked MVP
- One application: synthetic scholarship renewal
- One local synthetic portal
- English only
- 4–6 synthetic document types
- Synthetic/generated data only
- No real government portals, PII, payments, voice, multilingual runtime, multi-agent swarm, production auth, or broad RAG

## Must-have acceptance table
| Capability | Acceptance evidence |
|---|---|
| Evidence ingestion | Synthetic documents become structured evidence with provenance |
| Profile | Critical facts exist in one canonical profile |
| Validation | Planted mismatch/missing/expired cases become BLOCKED with findings |
| Preflight | Clean fixture becomes READY |
| Portal | Local scholarship portal can be filled deterministically |
| Browser agent | Playwright fills and verifies expected portal state |
| Recovery | Label drift and timeout have explicit safe handling |
| Approval | Submission is impossible without explicit approval for the exact version |
| Verification | Successful submission is confirmed by observed portal state |
| Evaluation | Ground-truth fixtures produce real metrics |
| Reproducibility | Clean checkout can install, test, evaluate and run demo |

## Demo cases
1. Name mismatch: Aadhaar `Rina Das`, bank proof `Rina Dey` → BLOCKED with evidence.
2. Portal drift: `Full Name` becomes `Applicant Legal Name` → semantic mapping or safe stop.
3. Timeout: submit times out → inspect actual state before any retry; never blindly double-submit.

## AI boundary
AI: semantic extraction, ambiguity, classification, portal-label interpretation.  
Code: identity/date/expiry/required-document/schema validation, approval enforcement, state machine, metrics.

## Success metrics
Extraction accuracy, conflict recall, false-positive rate, missing-document accuracy, recovery rate, portal completion rate, manual vs assisted time, unsafe/unapproved submissions.

## Definition of done
A synthetic application runs end-to-end, planted conflicts are detected with evidence, Playwright fills the portal, at least two failures are handled safely, approval is mandatory, submission is verified, real evaluation numbers exist, and README setup works from a clean checkout.
