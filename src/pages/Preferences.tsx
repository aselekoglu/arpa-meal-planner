import { useEffect, useState } from 'react';
import AiProviderSelector from '../components/AiProviderSelector';
import {
  AiProviderId,
  AiProviderUiMode,
  defaultModelForProvider,
  loadAiSettings,
  saveAiProviderUiMode,
  saveAiSettings,
} from '../lib/ai-settings';
import {
  loadDefaultServings,
  loadThemeMode,
  loadWeekStartsOn,
  saveDefaultServings,
  saveThemeMode,
  saveWeekStartsOn,
  ThemeMode,
} from '../lib/preferences';

export default function Preferences() {
  const [defaultServings, setDefaultServings] = useState(() => loadDefaultServings());
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(() => loadWeekStartsOn());
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => loadThemeMode());
  const [providerUiMode, setProviderUiModeState] = useState<AiProviderUiMode>(
    () => loadAiSettings().providerUiMode ?? 'per_request',
  );
  const [provider, setProvider] = useState<AiProviderId>(() => loadAiSettings().provider);
  const [model, setModel] = useState(() => loadAiSettings().model);
  const [servingsSaved, setServingsSaved] = useState(false);

  useEffect(() => {
    const syncAi = () => {
      const s = loadAiSettings();
      setProvider(s.provider);
      setModel(s.model);
      setProviderUiModeState(s.providerUiMode ?? 'per_request');
    };
    window.addEventListener('arpa-ai-settings-updated', syncAi);
    return () => window.removeEventListener('arpa-ai-settings-updated', syncAi);
  }, []);

  const persistServings = () => {
    saveDefaultServings(defaultServings);
    setServingsSaved(true);
    window.setTimeout(() => setServingsSaved(false), 2000);
  };

  const handleWeekChange = (v: 0 | 1) => {
    setWeekStartsOn(v);
    saveWeekStartsOn(v);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeModeState(mode);
    saveThemeMode(mode);
  };

  const handleProviderUiModeChange = (mode: AiProviderUiMode) => {
    setProviderUiModeState(mode);
    saveAiProviderUiMode(mode);
  };

  const handleProviderChange = (next: AiProviderId) => {
    const nextSettings = {
      provider: next,
      model: model.trim() ? model : defaultModelForProvider(next),
      providerUiMode,
    };
    setProvider(nextSettings.provider);
    setModel(nextSettings.model);
    saveAiSettings(nextSettings);
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    saveAiSettings({ provider, model: next, providerUiMode });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-primary-container dark:text-primary-fixed-dim">
          Preferences
        </h1>
        <p className="text-on-surface-variant mt-2 font-medium">
          Defaults for new recipes, calendar layout, appearance, and AI behavior.
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/15 p-6 lg:p-8 space-y-4">
        <h2 className="text-lg font-display font-bold text-on-surface">Meals</h2>
        <p className="text-sm text-on-surface-variant">
          Applies when you add a new recipe or import without an explicit servings value.
        </p>
        <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline">
          Default servings (1–100)
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={1}
            max={100}
            value={defaultServings}
            onChange={(e) => setDefaultServings(Number(e.target.value))}
            className="w-28 px-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-2xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={persistServings}
            className="px-5 py-3 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Save servings
          </button>
          {servingsSaved ? (
            <span className="text-sm text-primary-container dark:text-primary-fixed-dim font-medium">
              Saved
            </span>
          ) : null}
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/15 p-6 lg:p-8 space-y-4">
        <h2 className="text-lg font-display font-bold text-on-surface">Calendar</h2>
        <p className="text-sm text-on-surface-variant">
          First day of the week for Dashboard previews, Planner, and grocery week ranges.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleWeekChange(1)}
            className={`px-5 py-2.5 rounded-full text-sm font-display font-semibold border transition-colors ${
              weekStartsOn === 1
                ? 'bg-primary-container/15 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim'
                : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container/40'
            }`}
          >
            Monday
          </button>
          <button
            type="button"
            onClick={() => handleWeekChange(0)}
            className={`px-5 py-2.5 rounded-full text-sm font-display font-semibold border transition-colors ${
              weekStartsOn === 0
                ? 'bg-primary-container/15 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim'
                : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container/40'
            }`}
          >
            Sunday
          </button>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/15 p-6 lg:p-8 space-y-4">
        <h2 className="text-lg font-display font-bold text-on-surface">Appearance</h2>
        <p className="text-sm text-on-surface-variant">
          System follows your OS light/dark setting. The desktop header and mobile bar theme icons switch between explicit Light and Dark (they leave System mode when used).
        </p>
        <div className="flex gap-2 flex-wrap">
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleThemeChange(mode)}
              className={`px-5 py-2.5 rounded-full text-sm font-display font-semibold border capitalize transition-colors ${
                themeMode === mode
                  ? 'bg-primary-container/15 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim'
                  : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container/40'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/15 p-6 lg:p-8 space-y-5">
        <h2 className="text-lg font-display font-bold text-on-surface">AI</h2>

        <div className="space-y-2">
          <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline">
            Provider UI
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-3 cursor-pointer text-sm text-on-surface">
              <input
                type="radio"
                name="providerUiMode"
                checked={providerUiMode === 'per_request'}
                onChange={() => handleProviderUiModeChange('per_request')}
                className="mt-1"
              />
              <span>
                <span className="font-display font-semibold">Choose provider per request</span>
                <span className="block text-on-surface-variant text-xs mt-0.5">
                  Show the provider picker on chat, import, plan generation, images, and grocery grouping.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer text-sm text-on-surface">
              <input
                type="radio"
                name="providerUiMode"
                checked={providerUiMode === 'global_only'}
                onChange={() => handleProviderUiModeChange('global_only')}
                className="mt-1"
              />
              <span>
                <span className="font-display font-semibold">Use one provider for everything</span>
                <span className="block text-on-surface-variant text-xs mt-0.5">
                  Hide inline pickers; all AI calls use the provider and model below.
                </span>
              </span>
            </label>
          </div>
        </div>

        <AiProviderSelector
          provider={provider}
          model={model}
          onProviderChange={handleProviderChange}
          onModelChange={handleModelChange}
        />

        <p className="text-[11px] text-outline leading-relaxed">
          Image generation always uses Google&apos;s image model. If your saved chat provider is Ollama or MLX, meal images still run on Google automatically.
        </p>
      </section>
    </div>
  );
}
