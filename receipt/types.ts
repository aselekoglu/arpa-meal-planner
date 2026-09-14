export type ReceiptScannerEngine = 'gemini' | 'openai' | 'tesseract';

export type ReceiptCandidateStatus =
  | 'matched'
  | 'suggested'
  | 'unresolved'
  | 'ignored';

export type ReceiptMatchSource =
  | 'alias'
  | 'exact'
  | 'fuzzy'
  | 'ai'
  | 'manual';

export interface ReceiptTotals {
  subtotal?: number;
  tax?: number;
  total?: number;
}

export interface ReceiptCandidate {
  id: string;
  rawName: string;
  proposedName?: string;
  canonicalName?: string;
  quantity?: number;
  amount?: number;
  measure?: string;
  unitPrice?: number;
  totalPrice?: number;
  status: ReceiptCandidateStatus;
  matchSource?: ReceiptMatchSource;
  matchScore?: number;
  rememberAlias?: boolean;
}

export interface ReceiptAnalysis {
  merchant?: string;
  purchaseDate?: string;
  currency?: string;
  rawText?: string;
  items: ReceiptCandidate[];
  totals?: ReceiptTotals;
}

export interface ReceiptImportItem {
  rawName: string;
  canonicalName: string;
  amount: number;
  measure: string;
  unitPrice?: number;
  totalPrice?: number;
  matchSource?: ReceiptMatchSource;
  rememberAlias?: boolean;
}

export interface ReceiptImportRequest {
  merchant?: string;
  purchaseDate?: string;
  currency?: string;
  scannerEngine: ReceiptScannerEngine;
  rawText?: string;
  totals?: ReceiptTotals;
  items: ReceiptImportItem[];
}

export interface ReceiptImportResult {
  success: true;
  receiptId: number;
  importedItems: number;
  mergedItems: number;
  createdItems: number;
  rememberedAliases: number;
}
