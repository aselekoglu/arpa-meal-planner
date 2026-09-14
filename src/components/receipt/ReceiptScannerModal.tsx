import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Check, Loader2, ReceiptText, Trash2, X } from 'lucide-react';
import type { ReceiptAnalysis, ReceiptCandidate, ReceiptImportResult } from '@/receipt/types';
import { apiFetch } from '@/src/lib/api';
import {
  defaultModelForProvider,
  loadAiSettings,
} from '@/src/lib/ai-settings';
import { APPROVED_MEASURE_LABELS } from '@/src/lib/units';
import { prepareReceiptImage, type PreparedReceiptImage } from '@/src/lib/receipt-image';
import {
  loadReceiptSettings,
  saveReceiptSettings,
  type ReceiptAiEnhancementMode,
  type ReceiptScannerEngine,
} from '@/src/lib/receipt-settings';
import { recognizeReceiptLocally } from '@/src/lib/tesseract-receipt';

type DraftItem = ReceiptCandidate & {
  include: boolean;
};

interface ReceiptScannerModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
  ingredientSuggestions: string[];
}

function draftFromAnalysis(analysis: ReceiptAnalysis): DraftItem[] {
  const rememberAliases = loadReceiptSettings().rememberAliases;
  return analysis.items.map((item) => ({
    ...item,
    include: item.status !== 'ignored',
    amount: item.amount ?? item.quantity,
    measure: item.measure ?? (item.quantity ? 'Unit' : undefined),
    rememberAlias: item.rememberAlias ?? rememberAliases,
  }));
}

export default function ReceiptScannerModal({
  open,
  onClose,
  onImported,
  ingredientSuggestions,
}: ReceiptScannerModalProps) {
  const { t } = useTranslation();
  const [scannerEngine, setScannerEngine] = useState<ReceiptScannerEngine>(
    () => loadReceiptSettings().scannerEngine,
  );
  const [tesseractAiEnhancement, setTesseractAiEnhancement] =
    useState<ReceiptAiEnhancementMode>(
      () => loadReceiptSettings().tesseractAiEnhancement,
    );
  const [prepared, setPrepared] = useState<PreparedReceiptImage | null>(null);
  const [analysis, setAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ status: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptImportResult | null>(null);

  useEffect(() => {
    if (open) {
      const configured = loadReceiptSettings();
      setScannerEngine(configured.scannerEngine);
      setTesseractAiEnhancement(configured.tesseractAiEnhancement);
      return;
    }
    if (prepared?.previewUrl) URL.revokeObjectURL(prepared.previewUrl);
    setPrepared(null);
    setAnalysis(null);
    setItems([]);
    setError(null);
    setResult(null);
    setIsPreparing(false);
    setIsScanning(false);
    setIsImporting(false);
    setOcrProgress(null);
  }, [open]);

  const importableItems = useMemo(
    () => items.filter((item) => item.include),
    [items],
  );

  const canImport =
    importableItems.length > 0 &&
    importableItems.every(
      (item) =>
        Boolean(item.canonicalName?.trim()) &&
        Number.isFinite(Number(item.amount)) &&
        Number(item.amount) > 0 &&
        Boolean(item.measure) &&
        APPROVED_MEASURE_LABELS.includes(
          item.measure as (typeof APPROVED_MEASURE_LABELS)[number],
        ),
    );

  if (!open) return null;

  const changeScannerEngine = (next: ReceiptScannerEngine) => {
    setScannerEngine(next);
    setAnalysis(null);
    setItems([]);
    setError(null);
    saveReceiptSettings({
      ...loadReceiptSettings(),
      scannerEngine: next,
    });
  };

  const updateItem = (id: string, patch: Partial<DraftItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleImage = async (file?: File) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setAnalysis(null);
    setItems([]);
    setIsPreparing(true);
    try {
      if (prepared?.previewUrl) URL.revokeObjectURL(prepared.previewUrl);
      setPrepared(await prepareReceiptImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('receiptScanner.errors.prepare'));
    } finally {
      setIsPreparing(false);
    }
  };

  const scanReceipt = async () => {
    if (!prepared) return;
    setError(null);
    setOcrProgress(null);
    setIsScanning(true);

    try {
      let next: ReceiptAnalysis;

      if (scannerEngine === 'tesseract') {
        const local = await recognizeReceiptLocally(prepared, setOcrProgress);

        if (tesseractAiEnhancement === 'follow-ai-provider') {
          const ai = loadAiSettings();
          const model = ai.model.trim() || defaultModelForProvider(ai.provider);
          const response = await apiFetch('/api/ai/parse-receipt-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: ai.provider,
              model,
              rawText: local.sanitizedOcrText,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || 'Receipt OCR interpretation failed');
          }
          next = data as ReceiptAnalysis;
        } else {
          if (local.analysis.items.length === 0) {
            throw new Error(t('receiptScanner.errors.noLocalItems'));
          }

          const response = await apiFetch('/api/receipts/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(local.analysis),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || 'Receipt matching failed');
          }
          next = data as ReceiptAnalysis;
        }
      } else {
        const ai = loadAiSettings();
        const provider = scannerEngine;
        const model =
          ai.provider === provider && ai.model.trim()
            ? ai.model.trim()
            : defaultModelForProvider(provider);

        const response = await apiFetch('/api/ai/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            model,
            mimeType: prepared.mimeType,
            imageData: prepared.imageData,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Receipt scan failed');
        }
        next = data as ReceiptAnalysis;
      }

      setAnalysis(next);
      setItems(draftFromAnalysis(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('receiptScanner.errors.scan'));
    } finally {
      setIsScanning(false);
      setOcrProgress(null);
    }
  };

  const importReceipt = async () => {
    if (!analysis || !canImport) return;
    setError(null);
    setIsImporting(true);
    try {
      const response = await apiFetch('/api/receipts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: analysis.merchant,
          purchaseDate: analysis.purchaseDate,
          currency: analysis.currency,
          scannerEngine,
          rawText: analysis.rawText,
          totals: analysis.totals,
          items: importableItems.map((item) => ({
            rawName: item.rawName,
            canonicalName: item.canonicalName!.trim(),
            amount: Number(item.amount),
            measure: item.measure,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            matchSource: item.matchSource ?? 'manual',
            rememberAlias: item.rememberAlias === true,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Receipt import failed');
      }
      setResult(data as ReceiptImportResult);
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('receiptScanner.errors.import'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-[2rem] bg-surface-container-lowest border border-outline-variant/20 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-5 bg-surface-container-lowest/95 backdrop-blur border-b border-outline-variant/15">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-container/10 text-primary-container dark:bg-primary-fixed-dim/10 dark:text-primary-fixed-dim">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-xl text-on-surface">{t('receiptScanner.title')}</h2>
              <p className="text-xs text-on-surface-variant">
                {t('receiptScanner.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
            aria-label={t('receiptScanner.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {result ? (
            <div className="rounded-[1.5rem] bg-primary-container/10 p-6 space-y-3">
              <div className="flex items-center gap-2 text-primary-container dark:text-primary-fixed-dim">
                <Check className="w-5 h-5" />
                <h3 className="font-display font-bold">{t('receiptScanner.imported.title')}</h3>
              </div>
              <p className="text-sm text-on-surface-variant">
                {t('receiptScanner.imported.summary', { count: result.importedItems, merged: result.mergedItems, created: result.createdItems })}
              </p>
              <p className="text-xs text-on-surface-variant">
                {t('receiptScanner.imported.aliases', { count: result.rememberedAliases })}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-display font-semibold text-sm"
              >
                {t('receiptScanner.imported.done')}
              </button>
            </div>
          ) : (
            <>
              <section className="rounded-[1.5rem] bg-surface-container-low p-5 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-outline font-display font-bold">
                    {t('receiptScanner.provider.label')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['gemini', 'openai', 'tesseract'] as const).map((engine) => (
                      <button
                        key={engine}
                        type="button"
                        onClick={() => changeScannerEngine(engine)}
                        className={`px-4 py-2 rounded-full text-xs font-display font-bold border transition-colors ${
                          scannerEngine === engine
                            ? 'bg-primary-container/10 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim'
                            : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant'
                        }`}
                      >
                        {engine === 'gemini'
                          ? t('receiptScanner.provider.gemini')
                          : engine === 'openai'
                            ? t('receiptScanner.provider.openai')
                            : t('receiptScanner.provider.tesseract')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <label className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-primary text-on-primary font-display font-semibold text-sm cursor-pointer hover:opacity-90">
                    <Camera className="w-4 h-4" />
                    {t('receiptScanner.choose')}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => void handleImage(event.target.files?.[0])}
                    />
                  </label>
                  {isPreparing ? (
                    <span className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('receiptScanner.preparing')}
                    </span>
                  ) : null}
                </div>

                {prepared ? (
                  <div className="grid sm:grid-cols-[180px_1fr] gap-4 items-start">
                    <img
                      src={prepared.previewUrl}
                      alt="Receipt preview"
                      className="w-full max-h-56 object-contain rounded-xl bg-white"
                    />
                    <div className="space-y-3">
                      <p className="text-sm text-on-surface-variant">
                        {scannerEngine === 'tesseract'
                          ? tesseractAiEnhancement === 'off'
                            ? t('receiptScanner.privacyLocal')
                            : ['ollama', 'mlx'].includes(loadAiSettings().provider)
                              ? t('receiptScanner.privacyLocalEnhancedLocal', {
                                  provider: loadAiSettings().provider === 'ollama' ? 'Ollama' : 'MLX',
                                })
                              : t('receiptScanner.privacyLocalEnhancedCloud', {
                                  provider:
                                    loadAiSettings().provider === 'openai'
                                      ? t('receiptScanner.provider.openai')
                                      : t('receiptScanner.provider.gemini'),
                                })
                          : scannerEngine === 'openai'
                            ? t('receiptScanner.privacyOpenAI')
                            : t('receiptScanner.privacyGemini')}
                      </p>
                      <button
                        type="button"
                        onClick={() => void scanReceipt()}
                        disabled={isScanning}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm disabled:opacity-50"
                      >
                        {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ReceiptText className="w-4 h-4" />}
                        {isScanning
                          ? scannerEngine === 'tesseract'
                            ? t('receiptScanner.localProgress', {
                                progress: Math.round((ocrProgress?.progress ?? 0) * 100),
                              })
                            : t('receiptScanner.reading')
                          : scannerEngine === 'tesseract'
                            ? t('receiptScanner.readLocal')
                            : t('receiptScanner.readWith', {
                                provider:
                                  scannerEngine === 'openai'
                                    ? t('receiptScanner.provider.openai')
                                    : t('receiptScanner.provider.gemini'),
                              })}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              {analysis ? (
                <section className="space-y-4">
                  <div>
                    <h3 className="font-display font-extrabold text-lg text-on-surface">
                      {analysis.merchant ? t('receiptScanner.review.titleMerchant', { merchant: analysis.merchant }) : t('receiptScanner.review.title')}
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      {t('receiptScanner.review.subtitle')}
                    </p>
                  </div>

                  <datalist id="receipt-ingredient-suggestions">
                    {ingredientSuggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>

                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-[1.5rem] border p-4 space-y-3 ${
                          item.include
                            ? 'border-outline-variant/20 bg-surface-container-lowest'
                            : 'border-outline-variant/10 bg-surface-container-low opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-outline font-display font-bold">
                              {t('receiptScanner.review.line')}
                            </p>
                            <p className="font-mono text-sm text-on-surface">{item.rawName}</p>
                            {item.proposedName && item.proposedName !== item.canonicalName ? (
                              <p className="text-xs text-on-surface-variant mt-1">
                                {t('receiptScanner.review.suggestion', { name: item.proposedName })}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { include: !item.include })}
                            className="p-2 rounded-full hover:bg-surface-container-high"
                            aria-label={item.include ? t('receiptScanner.review.ignore') : t('receiptScanner.review.include')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {item.include ? (
                          <>
                            <div className="grid md:grid-cols-[1fr_120px_190px] gap-3">
                              <div>
                                <label className="block text-[10px] uppercase tracking-widest text-outline font-display font-bold mb-1">
                                  {t('receiptScanner.review.product')}
                                </label>
                                <input
                                  value={item.canonicalName ?? ''}
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      canonicalName: event.target.value,
                                      matchSource: 'manual',
                                    })
                                  }
                                  list="receipt-ingredient-suggestions"
                                  placeholder={t('receiptScanner.review.productPlaceholder')}
                                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase tracking-widest text-outline font-display font-bold mb-1">
                                  {t('receiptScanner.review.amount')}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.amount ?? ''}
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      amount:
                                        event.target.value === ''
                                          ? undefined
                                          : Number(event.target.value),
                                    })
                                  }
                                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase tracking-widest text-outline font-display font-bold mb-1">
                                  {t('receiptScanner.review.unit')}
                                </label>
                                <select
                                  value={item.measure ?? ''}
                                  onChange={(event) =>
                                    updateItem(item.id, { measure: event.target.value || undefined })
                                  }
                                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm"
                                >
                                  <option value="">{t('receiptScanner.review.selectUnit')}</option>
                                  {APPROVED_MEASURE_LABELS.map((measure) => (
                                    <option key={measure} value={measure}>
                                      {measure}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                              <input
                                type="checkbox"
                                checked={item.rememberAlias === true}
                                onChange={(event) =>
                                  updateItem(item.id, { rememberAlias: event.target.checked })
                                }
                              />
                              {t('receiptScanner.review.remember', { raw: item.rawName, name: item.canonicalName || t('receiptScanner.review.thisProduct') })}
                            </label>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
                    <p className="text-xs text-on-surface-variant">
                      {t('receiptScanner.review.selected', { count: importableItems.length })}
                    </p>
                    <button
                      type="button"
                      onClick={() => void importReceipt()}
                      disabled={!canImport || isImporting}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm disabled:opacity-50"
                    >
                      {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {isImporting ? t('receiptScanner.review.updating') : t('receiptScanner.review.confirm')}
                    </button>
                  </div>
                </section>
              ) : null}
            </>
          )}

          {error ? (
            <div className="rounded-xl bg-error-container/20 text-error p-4 text-sm">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
