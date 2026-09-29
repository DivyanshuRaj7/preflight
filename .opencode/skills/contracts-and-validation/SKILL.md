# Contracts and Validation

Use when implementing domain types, evidence provenance, deterministic validation, readiness, approval, or submission authorization.

Rules:
- Read `docs/CONTRACTS.md` first.
- Keep validation deterministic.
- Treat model output as untrusted.
- Add tests for every new invariant.
- Never put authorization logic in UI code.
