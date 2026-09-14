import { parseReceiptText, sanitizeReceiptOcrText } from '@/receipt/text-parser';
import type { ReceiptAnalysis } from '@/receipt/types';
import type { PreparedReceiptImage } from './receipt-image';

export interface ReceiptOcrProgress {
  status: string;
  progress: number;
}

export interface LocalReceiptOcrResult {
  analysis: ReceiptAnalysis;
  rawOcrText: string;
  sanitizedOcrText: string;
  confidence?: number;
}

function assetUrl(path: string): string {
  return new URL(`/tesseract/${path}`, window.location.origin).toString();
}

export async function recognizeReceiptLocally(
  image: PreparedReceiptImage,
  onProgress?: (progress: ReceiptOcrProgress) => void,
): Promise<LocalReceiptOcrResult> {
  const { createWorker, OEM, PSM } = await import('tesseract.js');

  const worker = await createWorker(['eng', 'fra'], OEM.LSTM_ONLY, {
    workerPath: assetUrl('worker.min.js'),
    corePath: assetUrl('core'),
    langPath: assetUrl('lang'),
    gzip: true,
    workerBlobURL: false,
    logger: (message) => {
      onProgress?.({
        status: message.status,
        progress: Number.isFinite(message.progress) ? message.progress : 0,
      });
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    });

    const source = `data:${image.mimeType};base64,${image.imageData}`;
    const result = await worker.recognize(source);
    const rawOcrText = result.data.text?.trim() || '';
    if (!rawOcrText) {
      throw new Error('Local OCR did not detect any text');
    }

    return {
      analysis: parseReceiptText(rawOcrText),
      rawOcrText,
      sanitizedOcrText: sanitizeReceiptOcrText(rawOcrText),
      ...(Number.isFinite(result.data.confidence)
        ? { confidence: result.data.confidence }
        : {}),
    };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
