import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeMetrics, type MatrixRow } from "../../scripts/eval/decision-matrix.js";

// Read-only evaluation source for the UI. Every number is DERIVED from the
// artifacts the existing harnesses write (eval/results.json from
// `npm run eval`, eval/ocr-results.json from `npm run eval:ocr`) using the
// harness's own computeMetrics. Nothing here restates a metric, invents a
// value, or re-runs a case. If an artifact is missing the API reports the
// section as unavailable instead of substituting numbers.
export type EvaluationCase = {
  caseId: string;
  category: string;
  expected: string;
  preflight: string;
  baseline: string;
  preflightCorrect: boolean;
  baselineCorrect: boolean;
  notes: string;
};

export type EvaluationSummary = {
  generatedBy: string;
  standard: { correct: number; total: number; baselineCorrect: number; unsafePrevented: number; unsafeTotal: number };
  safety: { probesDenied: number; probesTotal: number; unauthorizedSubmissions: number };
  full: { correct: number; total: number; uniformFalseDetected: number; uniformFalseTotal: number };
  falsePositiveBlocks: number;
  boundary: { caseId: string; expected: string; actual: string; note: string } | null;
  ocr: { passed: number; total: number } | null;
  cases: EvaluationCase[];
};

type ResultsArtifact = {
  generatedBy?: string;
  rows: MatrixRow[];
  metrics?: Record<string, unknown>;
};

type OcrArtifact = { passed: number; total: number };

const UNIFORM_FALSE_CATEGORY = "uniform-false-evidence";
const SAFETY_PROBE_CATEGORY = "safety-probe";

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function loadEvaluationSummary(root = process.cwd()): EvaluationSummary | null {
  const resultsPath = join(root, "eval", "results.json");
  const results = readJson<ResultsArtifact>(resultsPath);
  if (!results || !Array.isArray(results.rows) || results.rows.length === 0) return null;

  const rows = results.rows;
  const standardRows = rows.filter((r) => r.category !== UNIFORM_FALSE_CATEGORY);
  const preflightStandard = computeMetrics(standardRows, "preflight");
  const preflightFull = computeMetrics(rows, "preflight");
  const probes = rows.filter((r) => r.category === SAFETY_PROBE_CATEGORY);

  const uniformRow = rows.find((r) => r.category === UNIFORM_FALSE_CATEGORY);
  const ocrPath = join(root, "eval", "ocr-results.json");
  const ocr = existsSync(ocrPath) ? readJson<OcrArtifact>(ocrPath) : null;

  return {
    generatedBy: results.generatedBy ?? "unknown",
    standard: {
      correct: standardRows.filter((r) => r.preflightCorrect).length,
      total: standardRows.length,
      baselineCorrect: standardRows.filter((r) => r.baselineCorrect).length,
      unsafePrevented: preflightStandard.unsafePrevented,
      unsafeTotal: preflightStandard.unsafeTotal,
    },
    safety: {
      probesDenied: probes.filter((r) => r.preflight !== "SUCCESS").length,
      probesTotal: probes.length,
      // A probe that reached SUCCESS would be an unauthorized submission.
      unauthorizedSubmissions: probes.filter((r) => r.preflight === "SUCCESS").length,
    },
    full: {
      correct: rows.filter((r) => r.preflightCorrect).length,
      total: rows.length,
      uniformFalseDetected: preflightFull.uniformFalseEvidenceDetected,
      uniformFalseTotal: preflightFull.uniformFalseEvidenceTotal,
    },
    falsePositiveBlocks: preflightFull.falsePositiveBlocks,
    boundary: uniformRow
      ? {
          caseId: uniformRow.caseId,
          expected: uniformRow.expected,
          actual: uniformRow.preflight,
          note: uniformRow.notes,
        }
      : null,
    ocr: ocr ? { passed: ocr.passed, total: ocr.total } : null,
    cases: rows.map((r) => ({
      caseId: r.caseId,
      category: r.category,
      expected: r.expected,
      preflight: r.preflight,
      baseline: r.baseline,
      preflightCorrect: r.preflightCorrect,
      baselineCorrect: r.baselineCorrect,
      notes: r.notes,
    })),
  };
}