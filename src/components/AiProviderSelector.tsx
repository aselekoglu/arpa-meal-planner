import { AiProviderId } from '../lib/ai-settings';

interface AiProviderSelectorProps {
  provider: AiProviderId;
  model: string;
  onProviderChange: (provider: AiProviderId) => void;
  onModelChange: (model: string) => void;
  disableImageProviders?: boolean;
}

export default function AiProviderSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
  disableImageProviders = false,
}: AiProviderSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-display font-bold uppercase tracking-widest text-outline">
        AI Provider
      </label>
      <div className="grid grid-cols-3 gap-2">
        <ProviderButton
          active={provider === 'gemini'}
          onClick={() => onProviderChange('gemini')}
          label="Google"
        />
        <ProviderButton
          active={provider === 'ollama'}
          onClick={() => onProviderChange('ollama')}
          label="Ollama"
          disabled={disableImageProviders}
        />
        <ProviderButton
          active={provider === 'mlx'}
          onClick={() => onProviderChange('mlx')}
          label="MLX"
          disabled={disableImageProviders}
        />
      </div>
      <div>
        <label className="block text-[10px] font-display font-bold uppercase tracking-widest text-outline mb-2">
          Model (optional)
        </label>
        <input
          type="text"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="Use provider default"
          className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline text-sm"
        />
      </div>
      {disableImageProviders && (
        <p className="text-[11px] text-outline">Image generation currently supports Google provider only.</p>
      )}
    </div>
  );
}

function ProviderButton({
  active,
  label,
  onClick,
  disabled = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-xl border text-xs font-display font-bold transition-colors ${
        active
          ? 'bg-primary-container/10 border-primary-container text-primary-container dark:bg-primary-fixed-dim/15 dark:border-primary-fixed-dim dark:text-primary-fixed-dim'
          : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:border-primary-container/40'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  );
}
