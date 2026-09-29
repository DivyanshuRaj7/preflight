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
Fix the synthetic conflict. Re-run validation. Show READY.

**1:15–1:55 — Browser execution**  
Run the local portal and show semantic label drift handling.

**1:55–2:20 — Failure**  
Inject submit timeout. Show UNKNOWN → state verification, not blind retry.

**2:20–2:45 — Human approval**  
Show exact application version, evidence, trace, and approval boundary.

**2:45–3:00 — Proof**  
Show evaluation numbers from the real fixture suite.

## Fallback
Keep a clean recorded run and a second recording of the failure path. Never depend on an external service during the final demo.
