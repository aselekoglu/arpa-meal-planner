import { useEffect, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/src/lib/api';

type ReceiptHistoryRow = {
  id: number;
  merchant?: string | null;
  purchase_date?: string | null;
  scanner_engine: string;
  total?: number | null;
  currency?: string | null;
  created_at: string;
  item_count: number;
};

interface ReceiptHistoryCardProps {
  refreshToken?: number;
}

export default function ReceiptHistoryCard({ refreshToken = 0 }: ReceiptHistoryCardProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ReceiptHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiFetch('/api/receipts')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load receipt history');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setRows(Array.isArray(data) ? data.slice(0, 5) : []);
        }
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const providerLabel = (engine: string) => {
    if (engine === 'openai') return 'OpenAI';
    if (engine === 'gemini') return 'Gemini';
    if (engine === 'tesseract') return 'Tesseract';
    return engine;
  };

  return (
    <div className="bg-surface-container-low rounded-[2rem] p-6 lg:p-7">
      <div className="flex items-center gap-2 mb-4">
        <ReceiptText className="w-4 h-4 text-primary-container dark:text-primary-fixed-dim" />
        <h3 className="font-display text-lg font-bold text-primary-container dark:text-primary-fixed-dim">
          {t('receiptHistory.title')}
        </h3>
      </div>

      {loading ? (
        <p className="text-xs text-on-surface-variant">{t('receiptHistory.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-on-surface-variant">{t('receiptHistory.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl bg-surface-container-lowest border border-outline-variant/15 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-display font-semibold text-on-surface truncate">
                    {row.merchant || t('receiptHistory.unknownStore')}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {row.purchase_date || new Date(row.created_at).toLocaleDateString()} ·{' '}
                    {t('receiptHistory.items', { count: Number(row.item_count) || 0 })}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-display font-bold text-outline">
                  {providerLabel(row.scanner_engine)}
                </span>
              </div>
              {Number.isFinite(Number(row.total)) && row.total != null ? (
                <p className="text-xs font-display font-semibold text-on-surface mt-2">
                  {row.currency ? `${row.currency} ` : ''}{Number(row.total).toFixed(2)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
