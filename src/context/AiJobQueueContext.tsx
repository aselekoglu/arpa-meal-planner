import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AiProviderId } from '../lib/ai-settings';
import { defaultModelForProvider } from '../lib/ai-settings';
import type { AiJobRestorePayload } from '../lib/ai-job-nav-state';

const MINIMIZED_KEY = 'aiJobQueueMinimized';
const DONE_REMOVE_MS = 10_000;

export type AiJobKind =
  | 'import-recipe'
  | 'generate-meal-image'
  | 'estimate-nutrition'
  | 'fetch-instructions'
  | 'generate-plan'
  | 'grocery-group';

export type AiJobStatus = 'running' | 'done' | 'error';

export interface AiJob {
  id: string;
  kind: AiJobKind;
  title: string;
  relatedLabel?: string;
  providerId: AiProviderId;
  modelLabel: string;
  status: AiJobStatus;
  error?: string;
  createdAt: number;
  /** Present when done and user can navigate to apply results in the app. */
  restore?: AiJobRestorePayload;
}

export type AiJobCreateMeta = Pick<
  AiJob,
  'kind' | 'title' | 'relatedLabel' | 'providerId' | 'modelLabel'
>;

export type AiJobRunMeta<T> = AiJobCreateMeta & {
  buildRestore?: (result: T) => AiJobRestorePayload | undefined;
};

function providerDisplayName(id: AiProviderId): string {
  if (id === 'gemini') return 'Google';
  if (id === 'ollama') return 'Ollama';
  return 'MLX';
}

/** Model string for display + API meta (matches “optional model” semantics). */
export function aiJobModelLabel(provider: AiProviderId, model: string): string {
  const t = model.trim();
  if (t) return t;
  const d = defaultModelForProvider(provider).trim();
  return d || 'Provider default';
}

export function formatAiServiceLine(providerId: AiProviderId, modelLabel: string): string {
  return `${providerDisplayName(providerId)} · ${modelLabel}`;
}

interface AiJobQueueContextValue {
  jobs: AiJob[];
  isMinimized: boolean;
  setMinimized: (value: boolean) => void;
  dismissJob: (id: string) => void;
  clearCompleted: () => void;
  runWithAiJob: <T>(meta: AiJobRunMeta<T>, fn: () => Promise<T>) => Promise<T>;
}

const AiJobQueueContext = createContext<AiJobQueueContextValue | null>(null);

export function AiJobQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [isMinimized, setIsMinimizedState] = useState(() => {
    try {
      return localStorage.getItem(MINIMIZED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const doneTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearDoneTimer = useCallback((id: string) => {
    const t = doneTimers.current.get(id);
    if (t) {
      clearTimeout(t);
      doneTimers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    return () => {
      doneTimers.current.forEach((t) => clearTimeout(t));
      doneTimers.current.clear();
    };
  }, []);

  const setMinimized = useCallback((value: boolean) => {
    setIsMinimizedState(value);
    try {
      localStorage.setItem(MINIMIZED_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  const dismissJob = useCallback((id: string) => {
    clearDoneTimer(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, [clearDoneTimer]);

  const clearCompleted = useCallback(() => {
    setJobs((prev) => {
      for (const j of prev) {
        if (j.status === 'done') clearDoneTimer(j.id);
      }
      return prev.filter((j) => j.status !== 'done');
    });
  }, [clearDoneTimer]);

  const runWithAiJob = useCallback(
    async <T,>(meta: AiJobRunMeta<T>, fn: () => Promise<T>): Promise<T> => {
      const id = crypto.randomUUID();
      const job: AiJob = {
        ...meta,
        id,
        status: 'running',
        createdAt: Date.now(),
      };
      setJobs((prev) => [job, ...prev]);
      try {
        const result = await fn();
        const restore = meta.buildRestore?.(result);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === id ? { ...j, status: 'done' as const, ...(restore ? { restore } : {}) } : j,
          ),
        );
        clearDoneTimer(id);
        if (!restore) {
          const t = setTimeout(() => {
            setJobs((prev) => prev.filter((j) => j.id !== id));
            doneTimers.current.delete(id);
          }, DONE_REMOVE_MS);
          doneTimers.current.set(id, t);
        }
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong';
        setJobs((prev) =>
          prev.map((j) => (j.id === id ? { ...j, status: 'error' as const, error: message } : j)),
        );
        throw e;
      }
    },
    [clearDoneTimer],
  );

  const value = useMemo(
    () => ({
      jobs,
      isMinimized,
      setMinimized,
      dismissJob,
      clearCompleted,
      runWithAiJob,
    }),
    [jobs, isMinimized, setMinimized, dismissJob, clearCompleted, runWithAiJob],
  );

  return <AiJobQueueContext.Provider value={value}>{children}</AiJobQueueContext.Provider>;
}

export function useAiJobQueue(): AiJobQueueContextValue {
  const ctx = useContext(AiJobQueueContext);
  if (!ctx) {
    throw new Error('useAiJobQueue must be used within AiJobQueueProvider');
  }
  return ctx;
}
