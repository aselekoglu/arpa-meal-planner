export type ReceiptScannerEngine = 'gemini' | 'openai' | 'tesseract';
export type ReceiptAiEnhancementMode = 'off' | 'follow-ai-provider';

export interface ReceiptSettings {
  scannerEngine: ReceiptScannerEngine;
  tesseractAiEnhancement: ReceiptAiEnhancementMode;
  rememberAliases: boolean;
}

const STORAGE_KEY = 'receiptSettings';

const DEFAULT_SETTINGS: ReceiptSettings = {
  scannerEngine: 'gemini',
  tesseractAiEnhancement: 'off',
  rememberAliases: true,
};

export function loadReceiptSettings(): ReceiptSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReceiptSettings>;
    return {
      scannerEngine:
        parsed.scannerEngine === 'openai'
          ? 'openai'
          : parsed.scannerEngine === 'tesseract'
            ? 'tesseract'
            : 'gemini',
      tesseractAiEnhancement:
        parsed.tesseractAiEnhancement === 'follow-ai-provider'
          ? 'follow-ai-provider'
          : 'off',
      rememberAliases: parsed.rememberAliases !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveReceiptSettings(settings: ReceiptSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('arpa-receipt-settings-updated'));
}
