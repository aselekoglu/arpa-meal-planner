import { useState, useEffect } from 'react';
import { X, Search, Link as LinkIcon, Globe } from 'lucide-react';
import type { Meal } from '../types';
import { apiFetch } from '../lib/api';
import AiProviderSelector from './AiProviderSelector';
import ResponseLanguageSelector from './ResponseLanguageSelector';
import {
  AiProviderId,
  ResponseLanguageCode,
  aiJobLanguageLabel,
  defaultModelForProvider,
  loadAiSettings,
  saveAiSettings,
  showAiProviderPickerInModals,
  showLanguagePickerInModals,
  structuredAiLanguagePayload,
} from '../lib/ai-settings';
import { aiJobModelLabel, useAiJobQueue } from '../context/AiJobQueueContext';
import { useTranslation } from 'react-i18next';

interface ImportRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportRecipeModal({ isOpen, onClose }: ImportRecipeModalProps) {
  const { t } = useTranslation();
  const { runWithAiJob } = useAiJobQueue();
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<AiProviderId>(() => loadAiSettings().provider);
  const [model, setModel] = useState(() => loadAiSettings().model);
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguageCode>(
    () => loadAiSettings().responseLanguage ?? 'auto',
  );

  useEffect(() => {
    const sync = () => {
      const s = loadAiSettings();
      setProvider(s.provider);
      setModel(s.model);
      setResponseLanguage(s.responseLanguage ?? 'auto');
    };
    sync();
    window.addEventListener('arpa-ai-settings-updated', sync);
    return () => window.removeEventListener('arpa-ai-settings-updated', sync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const s = loadAiSettings();
    setProvider(s.provider);
    setModel(s.model);
    setResponseLanguage(s.responseLanguage ?? 'auto');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImport = () => {
    if (!query.trim()) return;

    const q = query.trim();
    const related = q.length > 72 ? `${q.slice(0, 72)}…` : q;
    const job = runWithAiJob(
      {
        kind: 'import-recipe',
        title: t('importRecipeModal.title'),
        relatedLabel: related,
        providerId: provider,
        modelLabel: aiJobModelLabel(provider, model),
        languageLabel: aiJobLanguageLabel(responseLanguage),
        buildRestore: (meal: Partial<Meal>) => ({
          path: '/',
          state: {
            addMealRestore: {
              mealId: null,
              partial: meal,
              scrollToIngredients: true,
            },
          },
        }),
      },
      async () => {
        const res = await apiFetch('/api/ai/import-recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: q,
            provider,
            model: model.trim() || undefined,
            ...structuredAiLanguagePayload(responseLanguage),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || t('importRecipeModal.errors.importFailed'));
        }

        if (!data.name || !data.ingredients) {
          throw new Error(t('importRecipeModal.errors.parse'));
        }

        return data;
      },
    );
    onClose();
    void job.catch((err: unknown) => console.error('Import error:', err));
  };

  const handleProviderChange = (next: AiProviderId) => {
    const nextSettings = {
      provider: next,
      model: model.trim() ? model : defaultModelForProvider(next),
    };
    setProvider(nextSettings.provider);
    setModel(nextSettings.model);
    if (showAiProviderPickerInModals()) saveAiSettings(nextSettings);
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    if (showAiProviderPickerInModals()) saveAiSettings({ provider, model: next });
  };

  const handleResponseLanguageChange = (next: ResponseLanguageCode) => {
    setResponseLanguage(next);
    if (showLanguagePickerInModals()) saveAiSettings({ provider, model, responseLanguage: next });
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-md min-w-0 overflow-hidden border border-outline-variant/15">
        <div className="px-4 sm:px-6 py-5 flex justify-between items-start gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-display font-extrabold text-primary-container dark:text-primary-fixed-dim tracking-tight">
                {t('importRecipeModal.title')}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {t('importRecipeModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 shrink-0 rounded-full text-outline hover:bg-surface-container-high transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 pb-2 space-y-4">
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {t('importRecipeModal.text')}
          </p>

          {showAiProviderPickerInModals() ? (
            <div>
              <AiProviderSelector
                provider={provider}
                model={model}
                onProviderChange={handleProviderChange}
                onModelChange={handleModelChange}
              />
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant">
              {t('grocery.smartGroupPopup.AItext')}
            </p>
          )}

          {showLanguagePickerInModals() ? (
            <ResponseLanguageSelector value={responseLanguage} onChange={handleResponseLanguageChange} />
          ) : (
            <p className="text-xs text-on-surface-variant">
              {t('grocery.smartGroupPopup.langText')}
            </p>
          )}

          <div>
            <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline mb-2">
              {t('importRecipeModal.fields.search.label')}
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('importRecipeModal.fields.search.placeholder')}
                className="w-full pl-11 pr-4 py-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleImport();
                }}
              />
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 mt-4 bg-surface-container-low/95 flex flex-wrap justify-end gap-3 border-t border-outline-variant/15">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-on-surface-variant font-display font-semibold text-sm rounded-full hover:bg-surface-container-high dark:hover:bg-surface-container-highest transition-colors"
          >
            {t('importRecipeModal.buttons.cancel')}
          </button>
          <button
            onClick={handleImport}
            disabled={!query.trim()}
            className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm"
          >
            <Search className="w-4 h-4" />
            {t('importRecipeModal.buttons.import')}
          </button>
        </div>
      </div>
    </div>
  );
}
