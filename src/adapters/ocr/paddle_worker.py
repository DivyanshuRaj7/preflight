"""Narrow PaddleOCR worker: image path in, structured JSON out.

Usage: python src/adapters/ocr/paddle_worker.py <image-path> [<page>]

No business logic here — only OCR. Node/TypeScript owns all application
behavior. Output schema (stdout, single JSON object):
  {"engine": "paddleocr", "engineVersion": str, "page": int,
   "lines": [{"text": str, "confidence": float,
              "bbox": [x1, y1, x2, y2] | null}]}
Bounding boxes are axis-aligned rectangles derived from PaddleOCR polygons.
Non-zero exit always means failure (message on stderr).
"""
import json
import sys
from typing import NoReturn


def die(message: str) -> NoReturn:
    print(f"paddle_worker error: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if len(sys.argv) < 2:
        die("usage: paddle_worker.py <image-path> [page]")
    image_path = sys.argv[1]
    page = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    try:
        from paddleocr import PaddleOCR
    except Exception as exc:
        die(f"paddleocr import failed: {exc}")

    try:
        # Disable OneDNN: its PIR instruction conversion rejects some OCR
        # model ops on this runtime (ConvertPirAttribute2RuntimeAttribute).
        # Plain CPU inference is deterministic and sufficient here.
        try:
            import paddle
            paddle.set_flags({"FLAGS_use_mkldnn": False})
        except Exception:
            pass
        # Orientation/unwarping stages are unnecessary for clean synthetic
        # pages and are skipped to keep the worker fast and robust.
        engine = PaddleOCR(
            lang="en",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            enable_mkldnn=False,
        )
        import paddleocr
        engine_version = getattr(paddleocr, "__version__", "unknown")
    except Exception as exc:
        die(f"engine init failed: {exc}")

    try:
        raw = engine.predict(image_path)
    except Exception as exc:
        die(f"ocr predict failed: {exc}")

    lines = []
    try:
        pages = raw if isinstance(raw, list) else [raw]
        for entry in pages:
            texts = entry.get("rec_texts", []) or []
            scores = entry.get("rec_scores", []) or []
            polys = entry.get("rec_polys", None) or entry.get("rec_boxes", None) or []
            for i, text in enumerate(texts):
                text = str(text).strip()
                if not text:
                    continue
                try:
                    confidence = float(scores[i]) if i < len(scores) else 0.0
                except (TypeError, ValueError):
                    confidence = 0.0
                bbox = None
                if i < len(polys):
                    try:
                        xs = [float(p[0]) for p in polys[i]]
                        ys = [float(p[1]) for p in polys[i]]
                        bbox = [min(xs), min(ys), max(xs), max(ys)]
                    except (TypeError, ValueError, IndexError):
                        bbox = None
                lines.append({"text": text, "confidence": confidence, "bbox": bbox})
    except Exception as exc:
        die(f"result parse failed: {exc}")

    print(json.dumps({"engine": "paddleocr", "engineVersion": engine_version, "page": page, "lines": lines}))


main()
