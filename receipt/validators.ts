import type {
  ReceiptAnalysis,
  ReceiptCandidate,
  ReceiptCandidateStatus,
  ReceiptImportRequest,
  ReceiptMatchSource,
  ReceiptScannerEngine,
} from './types.js';

const MAX_RECEIPT_ITEMS = 250;
const MAX_NAME_LEN = 300;
const MAX_TEXT_LEN = 40_000;

function optionalString(value: unknown, max = MAX_NAME_LEN): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function optionalFinite(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStatus(value: unknown): ReceiptCandidateStatus {
  return value === 'matched' ||
    value === 'suggested' ||
    value === 'unresolved' ||
    value === 'ignored'
    ? value
    : 'unresolved';
}

function candidateFromUnknown(value: unknown, index: number): ReceiptCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const rawName = optionalString(row.rawName) ?? optionalString(row.name);
  if (!rawName) return null;

  const id = optionalString(row.id, 100) ?? `receipt-item-${index + 1}`;
  const proposedName = optionalString(row.proposedName);
  const canonicalName = optionalString(row.canonicalName);

  return {
    id,
    rawName,
    ...(proposedName ? { proposedName } : {}),
    ...(canonicalName ? { canonicalName } : {}),
    ...(optionalFinite(row.quantity) !== undefined ? { quantity: optionalFinite(row.quantity) } : {}),
    ...(optionalFinite(row.amount) !== undefined ? { amount: optionalFinite(row.amount) } : {}),
    ...(optionalString(row.measure, 100) ? { measure: optionalString(row.measure, 100) } : {}),
    ...(optionalFinite(row.unitPrice) !== undefined ? { unitPrice: optionalFinite(row.unitPrice) } : {}),
    ...(optionalFinite(row.totalPrice) !== undefined ? { totalPrice: optionalFinite(row.totalPrice) } : {}),
    status: normalizeStatus(row.status),
    ...(typeof row.matchScore === 'number' && Number.isFinite(row.matchScore)
      ? { matchScore: Math.max(0, Math.min(1, row.matchScore)) }
      : {}),
  };
}

export function validateReceiptAnalysis(value: unknown): ReceiptAnalysis {
  if (!value || typeof value !== 'object') {
    throw new Error('Receipt analysis must be an object');
  }
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.items)) {
    throw new Error('Receipt analysis must contain an items array');
  }
  if (row.items.length > MAX_RECEIPT_ITEMS) {
    throw new Error('Receipt contains too many line items');
  }

  const items = row.items
    .map((item, index) => candidateFromUnknown(item, index))
    .filter((item): item is ReceiptCandidate => item !== null);

  if (items.length === 0) {
    throw new Error('No purchasable receipt items were detected');
  }

  const totalsRaw =
    row.totals && typeof row.totals === 'object'
      ? (row.totals as Record<string, unknown>)
      : undefined;
  const totals = totalsRaw
    ? {
        ...(optionalFinite(totalsRaw.subtotal) !== undefined
          ? { subtotal: optionalFinite(totalsRaw.subtotal) }
          : {}),
        ...(optionalFinite(totalsRaw.tax) !== undefined
          ? { tax: optionalFinite(totalsRaw.tax) }
          : {}),
        ...(optionalFinite(totalsRaw.total) !== undefined
          ? { total: optionalFinite(totalsRaw.total) }
          : {}),
      }
    : undefined;

  return {
    ...(optionalString(row.merchant) ? { merchant: optionalString(row.merchant) } : {}),
    ...(optionalString(row.purchaseDate, 50) ? { purchaseDate: optionalString(row.purchaseDate, 50) } : {}),
    ...(optionalString(row.currency, 10) ? { currency: optionalString(row.currency, 10) } : {}),
    ...(optionalString(row.rawText, MAX_TEXT_LEN) ? { rawText: optionalString(row.rawText, MAX_TEXT_LEN) } : {}),
    items,
    ...(totals && Object.keys(totals).length > 0 ? { totals } : {}),
  };
}

function isScannerEngine(value: unknown): value is ReceiptScannerEngine {
  return value === 'gemini' || value === 'openai' || value === 'tesseract';
}

function normalizeMatchSource(value: unknown): ReceiptMatchSource | undefined {
  if (
    value === 'alias' ||
    value === 'exact' ||
    value === 'fuzzy' ||
    value === 'ai' ||
    value === 'manual'
  ) {
    return value;
  }
  return undefined;
}

export function validateReceiptImportRequest(value: unknown): ReceiptImportRequest {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid receipt import payload');
  }
  const row = value as Record<string, unknown>;
  if (!isScannerEngine(row.scannerEngine)) {
    throw new Error('Invalid receipt scanner engine');
  }
  if (!Array.isArray(row.items) || row.items.length === 0) {
    throw new Error('Receipt import requires at least one item');
  }
  if (row.items.length > MAX_RECEIPT_ITEMS) {
    throw new Error('Receipt import contains too many items');
  }

  const items = row.items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid receipt item at index ${index}`);
    }
    const input = item as Record<string, unknown>;
    const rawName = optionalString(input.rawName);
    const canonicalName = optionalString(input.canonicalName);
    const amount = Number(input.amount);
    const measure = optionalString(input.measure, 100);
    if (!rawName || !canonicalName || !Number.isFinite(amount) || amount <= 0 || !measure) {
      throw new Error(`Receipt item ${index + 1} is incomplete`);
    }
    return {
      rawName,
      canonicalName,
      amount,
      measure,
      ...(optionalFinite(input.unitPrice) !== undefined
        ? { unitPrice: optionalFinite(input.unitPrice) }
        : {}),
      ...(optionalFinite(input.totalPrice) !== undefined
        ? { totalPrice: optionalFinite(input.totalPrice) }
        : {}),
      ...(normalizeMatchSource(input.matchSource)
        ? { matchSource: normalizeMatchSource(input.matchSource) }
        : {}),
      rememberAlias: input.rememberAlias === true,
    };
  });

  const totalsRaw =
    row.totals && typeof row.totals === 'object'
      ? (row.totals as Record<string, unknown>)
      : undefined;

  return {
    scannerEngine: row.scannerEngine,
    ...(optionalString(row.merchant) ? { merchant: optionalString(row.merchant) } : {}),
    ...(optionalString(row.purchaseDate, 50) ? { purchaseDate: optionalString(row.purchaseDate, 50) } : {}),
    ...(optionalString(row.currency, 10) ? { currency: optionalString(row.currency, 10) } : {}),
    ...(optionalString(row.rawText, MAX_TEXT_LEN) ? { rawText: optionalString(row.rawText, MAX_TEXT_LEN) } : {}),
    ...(totalsRaw
      ? {
          totals: {
            ...(optionalFinite(totalsRaw.subtotal) !== undefined
              ? { subtotal: optionalFinite(totalsRaw.subtotal) }
              : {}),
            ...(optionalFinite(totalsRaw.tax) !== undefined
              ? { tax: optionalFinite(totalsRaw.tax) }
              : {}),
            ...(optionalFinite(totalsRaw.total) !== undefined
              ? { total: optionalFinite(totalsRaw.total) }
              : {}),
          },
        }
      : {}),
    items,
  };
}
