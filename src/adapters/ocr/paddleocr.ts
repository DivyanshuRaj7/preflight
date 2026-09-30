import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OcrLine, OcrProvider, OcrResult } from "../../domain/ocr.js";

// Node side of the PaddleOCR boundary (TASK-011). Spawns the narrow Python
// worker and translates its JSON into domain-neutral OcrResult. Failures are
// typed and observable: an unavailable engine, a timeout, a worker crash, or
// an unreadable image can NEVER surface as a successful result.
export const PADDLEOCR_PROVIDER_NAME = "paddleocr";

export type PaddleOcrOptions = {
  pythonBin?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 300_000;

type WorkerLine = { text?: unknown; confidence?: unknown; bbox?: unknown };
type WorkerOutput = {
  engine?: unknown;
  engineVersion?: unknown;
  page?: unknown;
  lines?: unknown;
};

function toOcrLine(documentId: string, page: number, raw: WorkerLine): OcrLine | null {
  if (typeof raw.text !== "string" || raw.text.trim() === "") return null;
  const confidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence) ? raw.confidence : 0;
  let bbox: [number, number, number, number] | null = null;
  if (
    Array.isArray(raw.bbox) &&
    raw.bbox.length === 4 &&
    raw.bbox.every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    bbox = [raw.bbox[0], raw.bbox[1], raw.bbox[2], raw.bbox[3]];
  }
  return { text: raw.text.trim(), confidence, bbox, page };
}

export class PaddleOcrProvider implements OcrProvider {
  readonly name = PADDLEOCR_PROVIDER_NAME;
  private readonly workerPath: string;
  private readonly pythonBin: string;
  private readonly timeoutMs: number;

  constructor(options: PaddleOcrOptions = {}) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    this.workerPath = path.resolve(here, "paddle_worker.py");
    this.pythonBin = options.pythonBin ?? process.env.OCR_PYTHON_BIN ?? "python";
    this.timeoutMs = options.timeoutMs ?? Number(process.env.OCR_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  }

  recognizeDocument(documentId: string, imagePath: string): Promise<OcrResult> {
    const base = {
      documentId,
      engine: "paddleocr",
      engineVersion: "unknown",
      extractionMethod: "ocr" as const,
    };
    return new Promise((resolve) => {
      const child = execFile(
        this.pythonBin,
        [this.workerPath, imagePath, "1"],
        { timeout: this.timeoutMs, maxBuffer: 16 * 1024 * 1024 },
        (error, stdout) => {
          if (error && "killed" in error && (error as { killed?: boolean }).killed) {
            resolve({ ...base, status: "FAILED", lines: [], error: { code: "OCR_TIMEOUT", message: `OCR timed out after ${this.timeoutMs}ms.` } });
            return;
          }
          if (error) {
            const code = (error as NodeJS.ErrnoException).code === "ENOENT" ? "OCR_UNAVAILABLE" : "OCR_FAILED";
            resolve({
              ...base,
              status: "FAILED",
              lines: [],
              error: { code, message: code === "OCR_UNAVAILABLE" ? `Python binary not found: ${this.pythonBin}.` : `OCR worker failed: ${error.message}` },
            });
            return;
          }
          let parsed: WorkerOutput;
          try {
            parsed = JSON.parse(stdout) as WorkerOutput;
          } catch {
            resolve({ ...base, status: "FAILED", lines: [], error: { code: "OCR_FAILED", message: "OCR worker returned invalid JSON." } });
            return;
          }
          if (!parsed || !Array.isArray(parsed.lines)) {
            resolve({ ...base, status: "FAILED", lines: [], error: { code: "OCR_FAILED", message: "OCR worker returned an unexpected shape." } });
            return;
          }
          const page = typeof parsed.page === "number" ? parsed.page : 1;
          const lines = (parsed.lines as WorkerLine[])
            .map((line) => toOcrLine(documentId, page, line))
            .filter((line): line is OcrLine => line !== null);
          if (lines.length === 0) {
            resolve({ ...base, status: "FAILED", lines: [], error: { code: "OCR_UNREADABLE", message: "OCR returned no readable text." } });
            return;
          }
          resolve({
            ...base,
            status: "SUCCESS",
            engineVersion: typeof parsed.engineVersion === "string" ? parsed.engineVersion : "unknown",
            lines,
          });
        },
      );
      child.on("error", () => {
        // Spawn-level failure (e.g. missing binary); the callback above also
        // fires, so this only guards unhandled emissions.
      });
    });
  }
}
