import { useState } from 'react';
import { X, Search, Loader2, Link as LinkIcon } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ImportRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draftMeal: any) => void;
}

export default function ImportRecipeModal({ isOpen, onClose, onSave }: ImportRecipeModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/ai/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
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
      setError(err instanceof Error ? err.message : 'An error occurred while importing the recipe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 dark:bg-stone-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-stone-200 dark:border-stone-800">
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50 dark:bg-stone-800/50">
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            Import Recipe
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Enter a recipe name or URL. We'll search the web, extract the ingredients, and estimate the nutritional information for you.
          </p>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Recipe Search or URL</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Chocolate chip cookies or https://..."
                className="w-full pl-9 pr-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleImport();
                }}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/50">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-600 dark:text-stone-400 font-medium hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Import Recipe'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
