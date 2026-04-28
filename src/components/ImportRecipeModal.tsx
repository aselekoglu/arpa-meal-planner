import { useState } from 'react';
import { X, Search, Loader2, Link as LinkIcon, Globe } from 'lucide-react';
import { Meal } from '../types';
import { apiFetch } from '../lib/api';
import AiProviderSelector from './AiProviderSelector';
import { AiProviderId, defaultModelForProvider, loadAiSettings, saveAiSettings } from '../lib/ai-settings';

interface ImportRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draftMeal: Partial<Meal>) => void;
}

export default function ImportRecipeModal({ isOpen, onClose, onSave }: ImportRecipeModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<AiProviderId>(() => loadAiSettings().provider);
  const [model, setModel] = useState(() => loadAiSettings().model);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/ai/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          provider,
          model: model.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      if (!data.name || !data.ingredients) {
        throw new Error('Failed to parse recipe data. Please try another query.');
      }

      onSave(data);
    } catch (err: unknown) {
      console.error('Import error:', err);
      setError(
        err instanceof Error ? err.message : 'An error occurred while importing the recipe.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (next: AiProviderId) => {
    const nextSettings = {
      provider: next,
      model: model.trim() ? model : defaultModelForProvider(next),
    };
    setProvider(nextSettings.provider);
    setModel(nextSettings.model);
    saveAiSettings(nextSettings);
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    saveAiSettings({ provider, model: next });
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface dark:bg-stone-900 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-outline-variant/15 dark:border-stone-800">
        <div className="px-6 py-5 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold text-primary-container dark:text-primary-fixed-dim tracking-tight">
                Import Recipe
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Find a recipe anywhere on the web.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-outline hover:bg-surface-container-high transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-2 space-y-4">
          <p className="text-sm text-on-surface-variant dark:text-stone-400 leading-relaxed">
            Enter a recipe name or URL. Bebü Bot will search the web, extract ingredients, and estimate nutrition for you.
          </p>

          <div>
            <AiProviderSelector
              provider={provider}
              model={model}
              onProviderChange={handleProviderChange}
              onModelChange={handleModelChange}
            />
          </div>

          <div>
            <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline mb-2">
              Recipe search or URL
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Chocolate chip cookies or https://..."
                className="w-full pl-11 pr-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface dark:text-stone-100 placeholder:text-outline"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleImport();
                }}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-error-container text-on-error-container text-sm rounded-2xl border border-error/20">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 mt-4 bg-surface-container-low dark:bg-stone-800/40 flex justify-end gap-3 border-t border-outline-variant/15 dark:border-stone-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-on-surface-variant dark:text-stone-300 font-display font-semibold text-sm rounded-full hover:bg-surface-container-high dark:hover:bg-stone-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Import Recipe
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
