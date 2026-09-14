# Receipt Scanner Implementation Plan

Branch: `feature/receipt-scanner`

## Goal

Add a receipt ingestion flow that can turn a receipt image into reviewed pantry updates while keeping extraction, matching, user confirmation, and mutation as separate stages.

## Delivery slices

### PR slice 1 — Foundation + Gemini Vision vertical slice
- [x] Shared receipt types and runtime validation
- [x] Reusable ingredient matching helpers
- [x] Receipt settings scaffold
- [x] Gemini multimodal JSON input support in the AI provider abstraction
- [x] `scan-receipt` AI task
- [x] Receipt scan + alias/history schema migrations
- [x] Gemini receipt analysis endpoint
- [x] Canonical ingredient/alias matching
- [x] Transactional receipt import endpoint
- [x] Pantry “Scan receipt” UI
- [x] Review/edit/ignore before mutation
- [x] Pantry refresh after import so computed grocery requirements reconcile automatically
- [x] EN/TR strings

### PR slice 2 — Alias learning + receipt history polish
- [x] Store normalization
- [x] Family/store alias precedence
- [x] Remember accepted/manual corrections
- [x] Receipt history read APIs and recent-receipts summary card
- [ ] Import summary and matched-grocery summary

### PR slice 3 — Tesseract.js local OCR
- [x] Lazy-loaded Tesseract worker
- [x] Self-hosted OCR language data
- [x] Image preprocessing / client resize path
- [x] Deterministic receipt text parser
- [x] Local-only mode
- [x] Optional interpretation through current AI provider
- [x] Privacy disclosure based on selected provider

### Future — Barcode / Open Food Facts
- [ ] Camera barcode scanning
- [ ] Open Food Facts v3 product lookup
- [ ] Convert barcode result to the same receipt candidate contract
- [ ] Reuse matching/review/import pipeline

## Architecture

```
receipt image
    |
    +--> Gemini Vision ------------------+
    |                                    |
    +--> Tesseract.js -> text parser ----+
                                         v
                                  ReceiptAnalysis
                                         |
                                  alias resolution
                                         |
                                ingredient matching
                                         |
                                    user review
                                         |
                               transactional import
                                         |
                                      pantry
                                         |
                          existing grocery recomputation
```

## Rules

1. No scan result mutates pantry before explicit user confirmation.
2. Preserve the raw receipt line separately from the canonical product name.
3. AI-only suggestions are never silently persisted as aliases.
4. Alias learning requires user acceptance/correction.
5. Receipt images are not persisted by default.
6. Tesseract local-only mode must make no AI/cloud request.
7. The downstream pipeline is engine-agnostic so barcode/PaddleOCR can plug in later.

## Initial API

- `POST /api/ai/scan-receipt` — Gemini image -> structured receipt candidates
- `POST /api/receipts/import` — transactional reviewed pantry import + alias persistence
- `GET /api/receipts` — history (slice 2)
- `GET /api/receipts/:id` — history detail (slice 2)

Tesseract text analysis endpoints land in slice 3.

## Initial data model

- `receipt_item_aliases`
- `receipt_scans`
- `receipt_scan_items`

The existing pantry table remains the source of truth for inventory.

## Testing focus

- runtime receipt schema validation
- exact/fuzzy matching
- alias precedence
- unit-safe pantry merging
- incompatible-unit fallback to separate rows
- transactional import rollback behaviour
- Gemini response fixtures rather than live API calls in CI
- repeated receipt alias resolution

## Current branch status

Implemented and ready for local verification:
- Gemini Vision receipt image analysis
- OpenAI Responses API receipt image analysis with stateless `store: false` requests
- OpenAI as a first-class Arpa AI provider for chat/structured tasks/web-backed recipe workflows
- runtime-safe receipt contract
- canonical ingredient + learned alias resolution
- review/edit/ignore UI before mutation
- unit-safe transactional pantry updates
- store-scoped alias persistence
- receipt scan/item persistence without storing the original image
- automatic grocery recomputation through the existing pantry-derived grocery model
- EN/TR receipt scanner UI

Implemented in the current branch:
- Tesseract.js 7 local OCR with vendored worker/WASM runtime
- vendored English + French traineddata (no third-party OCR CDN at runtime)
- deterministic local receipt parser and payment/account-line sanitization
- Local-only mode with no AI provider request
- optional text-only enhancement through the current Gemini/OpenAI/Ollama/MLX provider
- provider-aware privacy disclosure
- receipt history read APIs and recent-receipts summary card

Still future work:
- full receipt history detail screen
- richer local parser templates per retailer
- barcode/Open Food Facts integration
- PaddleOCR evaluation

Tesseract is intentionally a separate slice because adding it correctly requires the npm dependency/lockfile plus local/self-hosted OCR language assets; the Gemini slice does not expose a non-working Tesseract switch.

## OpenAI configuration

Server-side only:

```bash
OPENAI_API_KEY="..."
AI_OPENAI_MODEL="gpt-5.6-luna"
AI_OPENAI_VISION_MODEL="gpt-5.6-luna"
```

The OpenAI integration uses the Responses API directly via server-side `fetch`; no OpenAI SDK dependency is required. Requests set `store: false`. The model field remains user-editable in Preferences, so newer compatible OpenAI models can be selected without code changes.

A safe `GET /api/ai/provider-status` endpoint reports whether Gemini/OpenAI server credentials are present without returning secrets.

## Latest CI gate

The current implementation has passed the GitHub Actions validation pipeline:

- `npm ci`
- `npm run lint` (TypeScript)
- `npm run check:i18n`
- `npm run test:unit`
- `npm run build`

## Automated validation

The branch includes:
- receipt matcher/validator unit tests
- OpenAI provider request-shape tests with mocked network calls
- GitHub Actions CI for `npm ci`, TypeScript, i18n validation, unit tests, and production build

## Local verification checklist

After pulling the branch:

```bash
npm ci
npm run lint
npm run build
npm run dev
```

Manual flow:
1. Open Pantry.
2. Scan/upload a receipt.
3. Verify extracted items before import.
4. Correct at least one abbreviation and enable “remember”.
5. Import.
6. Confirm pantry quantities changed.
7. Confirm grocery requirements recalculate.
8. Scan the same abbreviation again and confirm learned resolution (slice 2).
