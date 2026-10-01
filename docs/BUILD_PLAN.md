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

## Milestone log

- TASK-001: domain contracts, READY/BLOCKED decision, submission invariant.
- TASK-002: extraction contract, deterministic stub, profile assembly.
- TASK-003: deterministic validation engine (READY/BLOCKED over profile +
  evidence with explicit reference date); all fixture cases gated in eval.
- TASK-011: real local PaddleOCR ingestion (paddleocr 3.7.0 + paddlepaddle
  3.3.1, CPU, `requirements-ocr.txt`) behind the existing
  ExtractionProvider boundary; deterministic stub retained for fast tests;
  `npm run eval:ocr` measures the OCR layer separately from decision eval.
- TASK-012: semantic interpretation boundary (provider interface +
  deterministic dev provider + validating converter); untrusted candidates
  with provenance; fixture provider survives; no model inference, no paid
  API.
