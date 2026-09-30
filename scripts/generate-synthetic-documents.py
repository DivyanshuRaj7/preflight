"""Generate deterministic synthetic document images for OCR testing.

Only synthetic data. Fixed layout, fixed text, no randomness: the same
script always produces byte-comparable images on the same Pillow version.
Run: python scripts/generate-synthetic-documents.py
Output: fixtures/documents/*.png (+ manifest written by hand, see below).
"""
from PIL import Image, ImageDraw, ImageFont
import os

WIDTH, HEIGHT = 1200, 900
BG = (255, 255, 255)
INK = (20, 20, 20)
ACCENT = (30, 58, 138)

DOCUMENTS = {
    "doc-identity": [
        ("SYNTHETIC IDENTITY DOCUMENT", True),
        ("Full Name: Rina Das", False),
        ("Date of Birth: 2004-05-17", False),
        ("Address: 14 Lake Road, Kolkata 700029", False),
    ],
    "doc-marksheet": [
        ("SYNTHETIC MARKSHEET", True),
        ("Name: Rina Das", False),
        ("Date of Birth: 2004-05-17", False),
    ],
    "doc-income-certificate": [
        ("SYNTHETIC INCOME CERTIFICATE", True),
        ("Name: Rina Das", False),
        ("Annual Family Income: 180000", False),
        ("Valid Until: 2027-03-31", False),
    ],
    "doc-bank-proof": [
        ("SYNTHETIC BANK PASSBOOK", True),
        ("Name: Rina Das", False),
        ("Bank Account Number: SYNTHETIC-001234", False),
        ("Address: 14 Lake Road, Kolkata 700029", False),
    ],
}


def main() -> None:
    os.makedirs("fixtures/documents", exist_ok=True)
    try:
        title_font = ImageFont.load_default(size=44)
        body_font = ImageFont.load_default(size=36)
    except TypeError:
        title_font = ImageFont.load_default()
        body_font = ImageFont.load_default()
    for doc_id, lines in DOCUMENTS.items():
        img = Image.new("RGB", (WIDTH, HEIGHT), BG)
        draw = ImageDraw.Draw(img)
        draw.rectangle([8, 8, WIDTH - 8, HEIGHT - 8], outline=(180, 180, 180), width=3)
        y = 90
        for text, is_title in lines:
            draw.text((90, y), text, fill=ACCENT if is_title else INK,
                      font=title_font if is_title else body_font)
            y += 110 if is_title else 80
        out = f"fixtures/documents/{doc_id}.png"
        img.save(out)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
