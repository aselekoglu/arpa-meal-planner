import { useState } from 'react';
import { format } from 'date-fns';
import { Clock, Minus, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Meal, PlannerItem } from '../types';
import { getMealBaseServings, resolveEffectiveServings } from '../lib/meal-scaling';
import { dateLocaleFor } from '../lib/date-locale';

interface MobilePlannerProps {
  weekDays: Date[];
  selectedDate: Date;
  dayMeals: Array<{ planner: PlannerItem; meal: Meal | undefined }>;
  meals: Meal[];
  onSelectDate: (date: Date) => void;
  onAddMeal: (mealId: number) => Promise<boolean>;
  onMoveMeal: (plannerId: number, date: string) => void;
  onUpdateServings: (plannerId: number, servings: number | null) => void;
  onRemoveMeal: (plannerId: number) => void;
  addError: string | null;
}

function dateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export default function MobilePlanner({
  weekDays,
  selectedDate,
  dayMeals,
  meals,
  onSelectDate,
  onAddMeal,
  onMoveMeal,
  onUpdateServings,
  onRemoveMeal,
  addError,
}: MobilePlannerProps) {
  const { t, i18n } = useTranslation();
  const locale = dateLocaleFor(i18n.resolvedLanguage);
  const selectedKey = dateKey(selectedDate);
  const [isAdding, setIsAdding] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState('');

  return (
    <section className="lg:hidden min-w-0 space-y-4" aria-label={t('mobile.planner.daySelectionLabel')}>
      <div className="arpa-mobile-scroll flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('mobile.planner.daySelectionLabel')}>
        {weekDays.map((day) => {
          const key = dateKey(day);
          const selected = key === selectedKey;
          const isToday = key === dateKey(new Date());

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setIsAdding(false);
                onSelectDate(day);
              }}
              aria-pressed={selected}
              aria-label={format(day, 'EEEE, MMMM d', { locale })}
              className={`arpa-touch min-w-[3.75rem] min-h-14 shrink-0 rounded-2xl border px-2 py-1.5 flex flex-col items-center justify-center transition-colors ${
                selected
                  ? 'border-primary bg-primary text-on-primary shadow-sm'
                  : 'border-outline-variant/50 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wide">{format(day, 'EEE', { locale })}</span>
              <span className="text-base font-display font-extrabold leading-5">{format(day, 'd')}</span>
              {isToday && <span className="sr-only">{t('planner.today')}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 text-lg font-display font-bold text-on-surface">
          {format(selectedDate, 'EEEE, MMMM d', { locale })}
        </h2>
        <button
          type="button"
          onClick={() => setIsAdding((value) => !value)}
          className="arpa-touch inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('mobile.planner.addMeal')}
        </button>
      </div>

      {isAdding && (
        <div className="rounded-2xl border border-primary/25 bg-surface-container-low p-3">
          <label className="sr-only" htmlFor="mobile-planner-meal-select">
            {t('mobile.planner.selectMeal')}
          </label>
          <select
            id="mobile-planner-meal-select"
            autoFocus
            className="arpa-mobile-input min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            onChange={(event) => {
              const mealId = Number(event.target.value);
              if (!mealId) return;
              setSelectedMealId(event.target.value);
              setIsSavingMeal(true);
              void onAddMeal(mealId).then((saved) => {
                if (saved) setIsAdding(false);
                setSelectedMealId('');
              }).finally(() => setIsSavingMeal(false));
            }}
            value={selectedMealId}
            disabled={isSavingMeal}
          >
            <option value="">{t('mobile.planner.selectMeal')}</option>
            {meals.map((meal) => (
              <option key={meal.id} value={meal.id}>
                {meal.name} ({t('planner.mealOptionServings', { count: getMealBaseServings(meal) })})
              </option>
            ))}
          </select>
        </div>
      )}

      {addError && (
        <p role="alert" className="rounded-xl border border-error/30 bg-error-container/40 px-3 py-2 text-sm text-on-surface lg:hidden">
          {addError}
        </p>
      )}

      {dayMeals.length ? (
        <div className="space-y-3">
          {dayMeals.map(({ planner, meal }) => {
            const effectiveServings = meal
              ? resolveEffectiveServings(meal, planner.servings_override)
              : planner.servings_override ?? 1;

            return (
              <article
                key={planner.id}
                className="flex min-w-0 items-stretch gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-3 shadow-sm"
                aria-label={t('planner.moveAria', { name: planner.meal_name })}
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-container-high">
                  {meal?.image_url ? (
                    <img src={meal.image_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-display font-bold leading-snug text-on-surface">
                      {planner.meal_name}
                    </h3>
                    {meal?.tag ? <p className="mt-1 truncate text-xs text-outline">{meal.tag}</p> : null}
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {effectiveServings} {t('planner.servings')}
                    </span>
                    {weekDays.length > 0 && (
                      <label className="sr-only" htmlFor={`mobile-planner-move-${planner.id}`}>
                        {t('mobile.planner.moveToDay', { name: planner.meal_name })}
                      </label>
                    )}
                    <select
                      id={`mobile-planner-move-${planner.id}`}
                      value={planner.date}
                      onChange={(event) => onMoveMeal(planner.id, event.target.value)}
                      className="arpa-mobile-input min-h-11 min-w-0 max-w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-2 text-xs text-on-surface"
                    >
                      {weekDays.map((day) => (
                        <option key={dateKey(day)} value={dateKey(day)}>
                          {format(day, 'EEE d', { locale })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-center justify-between gap-1">
                  {meal && (
                    <div className="flex items-center rounded-full bg-surface-container-low" aria-label={t('mobile.planner.servingsForRecipe', { name: planner.meal_name, count: effectiveServings })}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(1, effectiveServings - 1);
                          const base = getMealBaseServings(meal);
                          onUpdateServings(planner.id, next === base ? null : next);
                        }}
                        disabled={effectiveServings <= 1}
                        aria-label={t('planner.buttons.decrease')}
                        className="arpa-touch h-11 w-11 rounded-full text-on-surface-variant disabled:opacity-40"
                      >
                        <Minus className="mx-auto h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.min(100, effectiveServings + 1);
                          const base = getMealBaseServings(meal);
                          onUpdateServings(planner.id, next === base ? null : next);
                        }}
                        disabled={effectiveServings >= 100}
                        aria-label={t('planner.buttons.increase')}
                        className="arpa-touch h-11 w-11 rounded-full text-on-surface-variant disabled:opacity-40"
                      >
                        <Plus className="mx-auto h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveMeal(planner.id)}
                    aria-label={t('planner.buttons.remove')}
                    className="arpa-touch flex h-11 w-11 items-center justify-center rounded-full text-secondary hover:bg-secondary-container/40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-outline-variant/60 px-4 py-6 text-center text-sm text-on-surface-variant">
          {t('mobile.planner.noMeals')}
        </p>
      )}
    </section>
  );
}
