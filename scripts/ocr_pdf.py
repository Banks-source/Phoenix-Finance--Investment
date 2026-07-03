#!/usr/bin/env python3
"""OCR a scanned PDF to out/<name>.ocr.txt with page markers.
Usage: python3 scripts/ocr_pdf.py <pdf_path> [start_page] [end_page] [dpi]
Pages are 1-indexed. Renders with PyMuPDF, OCRs with tesseract. Writes to out/ (gitignored).
"""
import sys, os, subprocess, tempfile
import fitz  # PyMuPDF

def ocr_page(page, dpi, psm):
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        tmp = tf.name
        pix.save(tmp)
    try:
        out = subprocess.run(
            ["tesseract", tmp, "stdout", "--psm", str(psm)],
            capture_output=True, text=True,
        )
        return out.stdout
    finally:
        os.remove(tmp)

def main():
    path = sys.argv[1]
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    end = int(sys.argv[3]) if len(sys.argv) > 3 else None
    dpi = int(sys.argv[4]) if len(sys.argv) > 4 else 300
    psm = int(sys.argv[5]) if len(sys.argv) > 5 else 6
    doc = fitz.open(path)
    n = doc.page_count
    end = end or n
    os.makedirs("out", exist_ok=True)
    base = os.path.splitext(os.path.basename(path))[0]
    suffix = "" if (start == 1 and end == n) else f"_p{start}-{end}"
    outpath = f"out/{base}{suffix}.ocr.txt"
    with open(outpath, "w") as f:
        for i in range(start - 1, min(end, n)):
            txt = ocr_page(doc[i], dpi, psm)
            f.write(f"\n===== PAGE {i+1} / {n} =====\n")
            f.write(txt)
            print(f"  page {i+1}/{end} ({len(txt)} chars)", file=sys.stderr)
    print(f"{path}: OCR pages {start}-{end} of {n} -> {outpath} ({os.path.getsize(outpath)} bytes)")

if __name__ == "__main__":
    main()
