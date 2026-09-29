# Preflight Build Plan

The implementation order is intentionally irreversible enough to prevent architectural drift while keeping every layer replaceable.

```text
Contracts + test harness
→ deterministic fixtures
→ extraction adapter + stub
→ profile assembly
→ validation engine
→ preflight UI
→ local portal
→ Playwright fill + verify
→ approval + submit verification
→ controlled failures
→ evaluation + demo polish
```

## Why extraction starts with a stub

The product must be testable even when OCR/model access is unavailable, rate-limited, or wrong. Real OCR and multimodal providers plug into the same adapter later.

## Milestone rule

A milestone is complete only when:
- its tests are green;
- its fixture cases are deterministic;
- its documented contract is satisfied;
- `npm run check` is green;
- no unrelated refactor is included.
