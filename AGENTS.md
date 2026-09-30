# Preflight — OpenCode Project Instructions

## Read first
Before implementation, read:
- `PRD.md`
- `ARCHITECTURE.md`
- `docs/CONTRACTS.md`
- `TASKS.md`

## Operating mode
You are an implementation agent, not the product owner. Work on exactly the task explicitly assigned by the human. Never invent the next feature.

For every task:
1. Inspect the existing code before editing.
2. State a small plan.
3. Respect the task's allowed areas and non-goals.
4. Implement the minimum coherent change.
5. Add/update tests and deterministic fixtures.
6. Run `npm run check`, `npm run test`, and any task-specific command.
7. Review the diff for scope creep.
8. Report results and STOP.

## Scope lock
Build only the synthetic scholarship workflow. No real portals, real PII, payments, voice, multilingual runtime, multi-agent swarm, production auth, or broad RAG.

## Architecture rules
- One TypeScript repository; no microservices.
- Domain code owns validation, readiness, approval, and submission authorization.
- Adapters own OCR/model/portal integrations.
- UI presents state; it does not authorize irreversible actions.
- LLM/OCR output is untrusted input.
- Preserve evidence provenance for critical facts.
- Unknown browser state must be verified before retry.
- Submit only through the domain submission invariant.
- Never blindly retry an irreversible action.
- AI providers must remain replaceable.
- No paid API dependency is mandatory.

## Contract discipline
Do not change `docs/CONTRACTS.md` or domain contracts without updating affected tests and fixtures in the same task.

## Failure handling
Use explicit states. Uncertainty becomes `BLOCKED`, `NEEDS_REVIEW`, or `UNKNOWN`; it never silently becomes success.

## Git
Use focused commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Never rewrite history without permission.

## Completion
A task is not complete because files exist. It is complete only when its tests/checks pass and the requested behavior is reproducible.

After every major checkpoint, ask: "Does README.md still describe what actually exists?" The workflow is BUILD → TEST → REVIEW → README UPDATE → GIT CHECKPOINT.
