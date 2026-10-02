# 3-Minute Demo

## Fixed sequence

**0:00–0:20 — Problem**  
Completion is not correctness.

**0:20–0:55 — Evidence conflict**  
Run `name-mismatch`. Show evidence-backed BLOCKED state.

## UI flow (TASK-004)

1. `npm run dev`, open the printed local URL.
2. Select a synthetic case (CASE-001-clean … CASE-008-combined-failures).
3. Choose Run Preflight.
4. Read the READY/BLOCKED status header, then findings, evidence, and remediation.
5. Switching cases clears the previous result before the next run.

**0:55–1:15 — Revalidation**  
Switch to the corrected synthetic case and re-run Preflight. Show READY.
The demo uses separate deterministic synthetic cases rather than live document editing.

**1:15–1:55 — Browser execution**  
Run the live browser agent (own terminal, project root):

```bash
npm run demo:browser
```

It validates CASE-001, inspects the real portal, maps 6 fields, fills them,
independently reads every value back, saves the draft, and verifies SAVED —
printing only what actually happened. Add `-- --headed` to watch the
Chromium window, `--scenario=flaky-save` for the recovery path
(RECOVERED after one bounded retry), `--scenario=unknown-save` for the
escalation path (ESCALATED, no retry). For label drift, run the
`label-drift` E2E spec instead; the portal keeps no execution UI of its own.

**1:55–2:20 — Failure**  
Inject an unknown save/submit state. The agent checks the actual portal state instead of assuming failure or success. Because the state is inconclusive, it escalates rather than blindly retrying.

**2:20–2:45 — Human approval**  
Back in the console, click Review verified application. The modal shows the
exact reviewed state (READY · SAVED, applicant values, fingerprint). Click
Approve submission: the modal closes and the page shows APPROVED. Submission
itself stays unauthorized here — it additionally requires a verified browser
execution — and the UI says so explicitly.

**2:45–3:00 — Proof**  
Show evaluation numbers from the real fixture suite.

## Fallback
Keep a clean recorded run and a second recording of the failure path. Never depend on an external service during the final demo.
