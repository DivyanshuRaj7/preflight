# Preflight Failure Coverage Matrix

Each row connects a failure to its detector, its mandated decision, the
evidence behind it, recovery policy, human involvement, and the fixture
that proves it. Coverage is claimed honestly:

- **SUPPORTED** — detected, decided, and proven by a fixture + test.
- **PARTIAL** — handled safely (refusal/escalation) but coarsely: the
  decision is correct, the diagnosis may need a human to refine it.
- **NOT SUPPORTED** — outside the model; the only correct behavior is to
  stop, and fixtures prove we stop.

| Failure | Detector | Decision | Evidence | Recovery | Human | Case | Coverage |
|---|---|---|---|---|---|---|---|
| Missing required document | REQUIRED_DOCUMENT rule | BLOCKED | cited doc type | none | fix + resubmit | CASE-004 | SUPPORTED |
| Expired document | DOCUMENT_EXPIRY rule | BLOCKED | expiry evidence | none | renew | CASE-005 | SUPPORTED |
| Invalid document | DOCUMENT_INVALID rule | BLOCKED | doc status | none | replace | unit | SUPPORTED |
| Low-confidence critical field | LOW_CONFIDENCE rule | BLOCKED | evidence + confidence | none | re-capture/verify | CASE-006 | SUPPORTED |
| Dangling evidence provenance | EVIDENCE_PROVENANCE rule | BLOCKED | cited ids | none | attach evidence | unit | SUPPORTED |
| Cross-document name conflict | NAME_MISMATCH rule | BLOCKED | both evidences | none | correct source | CASE-002 | SUPPORTED |
| Cross-document DOB conflict | DOB_MISMATCH rule | BLOCKED | both evidences | none | correct source | CASE-003 | SUPPORTED |
| Cross-document address conflict | ADDRESS_MISMATCH rule | BLOCKED | both evidences | none | correct source | CASE-007 | SUPPORTED |
| Self-contradictory document | NAME_MISMATCH rule | BLOCKED | same-doc evidences | none | correct source | CASE-009 | SUPPORTED |
| Ambiguous portal label | baseline mapper | refuse (AMBIGUOUS) | portal label | none | extend alias model | ADV-006 | SUPPORTED |
| Unseen portal label | baseline mapper | refuse (UNMAPPED) | portal label | none | extend alias model | ADV-007 | SUPPORTED |
| Unsupported extra portal field | baseline mapper | refuse (UNMAPPED) | portal label | none | extend alias model | ADV-011 | SUPPORTED |
| Portal label drift (known alias) | baseline mapper | MATCHED, execute | portal label | n/a | none | drift E2E | SUPPORTED |
| Confirmed save miss | read-back + verifier | one retry → SAVED | observed DRAFT | once | only if retry spent | flaky E2E | SUPPORTED |
| Unexpected portal state | verifyPortalState | UNKNOWN → escalate | observed text | never | review | ADV-008 | SUPPORTED |
| Save confirmation unavailable | verifyPortalState | UNKNOWN → escalate | empty read | never | review | ADV-009 | SUPPORTED |
| Post-submit confirmation unavailable | verifyPortalState | UNKNOWN → escalate | stuck text | never | review | ADV-010 | SUPPORTED |
| Missing/stale approval | checkApproval | refuse INVALIDATED | fingerprint diff | never (re-approve) | approve exact state | unit + E2E | SUPPORTED |
| Non-ISO expiry text | DOCUMENT_EXPIRY rule | BLOCKED as unverifiable | raw text | none | supply ISO date | unit | PARTIAL |
| Diacritic/case-fold edge cases | agreement normalizers | BLOCKED, possibly coarse | both evidences | none | human adjudicates | — | PARTIAL |
| Arbitrary document types | model boundary | stop (no schema) | n/a | never | out of scope | — | NOT SUPPORTED |
| Arbitrary portals/workflows | model boundary | stop (no mapping) | n/a | never | out of scope | — | NOT SUPPORTED |
| Real-world submission | scope lock | refused by design | n/a | never | out of scope | — | NOT SUPPORTED |
| Multilingual runtime | scope lock | stop | n/a | never | out of scope | — | NOT SUPPORTED |
| Production auth/fraud signals | scope lock | stop | n/a | never | out of scope | — | NOT SUPPORTED |

Rules: never report NOT SUPPORTED rows as covered. A row marked PARTIAL is
safe but coarse — the decision is correct, the explanation may need a human.
"Recognized as outside supported coverage" is a valid, desirable evaluation
result, not a failure.
