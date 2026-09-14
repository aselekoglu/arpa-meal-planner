# Vendored Tesseract runtime

These files are intentionally served by Arpa itself so Local OCR can run without fetching
Tesseract worker/core/language assets from a third-party CDN at runtime.

Pinned sources:
- tesseract.js 7.0.0 (Apache-2.0)
- tesseract.js-core 7.0.0 (Apache-2.0)
- @tesseract.js-data/eng 1.0.0 (MIT)
- @tesseract.js-data/fra 1.0.0 (MIT)

Regenerate from npm rather than editing the generated assets manually.
