import { useState, useEffect, useRef } from 'react';
import { X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Meal } from '../types';
import { apiFetch } from '../lib/api';
import AiProviderSelector from './AiProviderSelector';
import {
  AiProviderId,
  defaultModelForProvider,
  loadAiSettings,
  saveAiSettings,
  showAiProviderPickerInModals,
} from '../lib/ai-settings';
import { aiJobModelLabel, useAiJobQueue } from '../context/AiJobQueueContext';

interface ImageGeneratorProps {
  meal: Meal;
  onClose: () => void;
  onSuccess: (imageUrl: string) => void;
}

export default function ImageGenerator({ meal, onClose, onSuccess }: ImageGeneratorProps) {
  const { runWithAiJob } = useAiJobQueue();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [size, setSize] = useState('1K');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<AiProviderId>('gemini');
  const [model, setModel] = useState(() => {
    const s = loadAiSettings();
    return s.provider === 'gemini' ? s.model : defaultModelForProvider('gemini');
  });

  useEffect(() => {
    const sync = () => {
      const s = loadAiSettings();
      setProvider('gemini');
      setModel(s.provider === 'gemini' ? s.model : defaultModelForProvider('gemini'));
    };
    sync();
    window.addEventListener('arpa-ai-settings-updated', sync);
    return () => window.removeEventListener('arpa-ai-settings-updated', sync);
  }, []);

  const handleGenerate = async () => {
    if (provider !== 'gemini') {
      setError('Image generation currently supports only the Google provider.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      await runWithAiJob(
        {
          kind: 'generate-meal-image',
          title: 'Generate meal image',
          relatedLabel: meal.name,
          providerId: provider,
          modelLabel: aiJobModelLabel(provider, model),
          buildRestore: (result: { mealId: number; imageUrl: string }) => ({
            path: '/',
            state: {
              addMealRestore: {
                mealId: result.mealId,
                partial: { image_url: result.imageUrl },
                scrollToIngredients: false,
              },
            },
          }),
        },
        async () => {
          const res = await apiFetch('/api/ai/generate-meal-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mealId: meal.id,
              size,
              provider,
              model: model.trim() || undefined,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || 'Image generation failed');
          }
          if (!data.imageUrl) {
            throw new Error('No image returned');
          }
          const imageUrl = data.imageUrl as string;
          if (mountedRef.current) {
            onSuccess(imageUrl);
          }
          return { mealId: meal.id, imageUrl };
        },
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (next: AiProviderId) => {
    setProvider(next);
    if (showAiProviderPickerInModals()) saveAiSettings({ provider: next, model });
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    if (showAiProviderPickerInModals()) saveAiSettings({ provider, model: next });
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-outline-variant/15">
        <div className="px-6 py-5 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold text-primary-container dark:text-primary-fixed-dim tracking-tight">
                Generate Image
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Powered by Nano Banana Pro
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
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Generate a custom illustration for{' '}
            <strong className="text-on-surface font-display font-bold">
              {meal.name}
            </strong>
            .
          </p>

          {showAiProviderPickerInModals() ? (
            <div>
              <AiProviderSelector
                provider={provider}
                model={model}
                onProviderChange={handleProviderChange}
                onModelChange={handleModelChange}
                disableImageProviders
              />
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant">
              Meal images always use Google. Model follows your Gemini settings when applicable; otherwise the Google default applies.
            </p>
          )}

          <div>
            <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline mb-2">
              Image quality
            </label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
            >
              <option value="1K">1K · Standard</option>
              <option value="2K">2K · High Quality</option>
              <option value="4K">4K · Ultra HQ</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-error-container text-on-error-container text-sm rounded-2xl border border-error/20">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 mt-4 bg-surface-container-low/95 flex justify-end gap-3 border-t border-outline-variant/15">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-on-surface-variant font-display font-semibold text-sm rounded-full hover:bg-surface-container-high dark:hover:bg-surface-container-highest transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Image'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
