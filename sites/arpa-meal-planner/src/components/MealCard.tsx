import { useState } from 'react';
import {
  MoreVertical,
  Edit2,
  Trash2,
  Tag as TagIcon,
  Image as ImageIcon,
  Clock,
  Flame,
} from 'lucide-react';
import { Meal } from '../types';
import ImageGenerator from './ImageGenerator';
import MealDetailsModal from './MealDetailsModal';
import { getMealBaseServings, getScaledMealNutritionTotals } from '../lib/meal-scaling';
import { useTranslation } from 'react-i18next';

interface MealCardProps {
  meal: Meal;
  onDelete: () => void;
  onEdit: () => void;
}

export default function MealCard({ meal, onDelete, onEdit }: MealCardProps) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const totals = getScaledMealNutritionTotals(meal, meal.servings);
  const totalCalories = totals.calories;
  const totalProtein = totals.protein;
  const servings = getMealBaseServings(meal);

  return (
    <>
      <article
        className="arpa-recipe-card bg-surface-container-lowest rounded-[2rem] overflow-hidden flex min-w-0 flex-col transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer border border-outline-variant/15 group"
        onClick={() => setShowDetails(true)}
      >
        <div className="arpa-recipe-card-image relative h-48 bg-surface-container-high flex items-center justify-center overflow-hidden">
          {meal.image_url ? (
            <img
              src={meal.image_url}
              alt={meal.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-outline flex flex-col items-center gap-2">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <span className="text-sm font-display font-medium">{t('mealCard.noImage')}</span>
            </div>
          )}

          <div className="absolute top-3 right-3">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="arpa-touch inline-flex items-center justify-center bg-surface/95 backdrop-blur-sm rounded-full text-on-surface hover:bg-surface transition-colors shadow-sm"
                aria-label={t('mobile.shell.recipeActions', { defaultValue: 'Recipe actions' })}
                aria-expanded={showMenu}
                aria-controls={`meal-actions-${meal.id}`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {meal.tag && (
            <div className="absolute bottom-3 left-3">
              <span className="bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-display font-bold uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <TagIcon className="w-3 h-3" />
                {meal.tag}
              </span>
            </div>
          )}
        </div>

        {showMenu && (
          <div
            id={`meal-actions-${meal.id}`}
            role="group"
            aria-label={t('mobile.shell.recipeActions', { defaultValue: 'Recipe actions' })}
            className="border-y border-outline-variant/20 bg-surface-container-lowest py-1 dark:border-outline-variant"
          >
            <button
              onClick={(event) => {
                event.stopPropagation();
                setShowMenu(false);
                onEdit();
              }}
              className="arpa-touch inline-flex w-full items-center gap-3 px-5 text-left text-sm text-on-surface hover:bg-surface-container-low dark:hover:bg-surface-container-highest"
            >
              <Edit2 className="h-4 w-4 shrink-0" />
              {t('mealCard.menu.edit')}
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setShowMenu(false);
                setShowImageGen(true);
              }}
              className="arpa-touch inline-flex w-full items-center gap-3 px-5 text-left text-sm text-on-surface hover:bg-surface-container-low dark:hover:bg-surface-container-highest"
            >
              <ImageIcon className="h-4 w-4 shrink-0" />
              {t('mealCard.menu.generateImage')}
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setShowMenu(false);
                onDelete();
              }}
              className="arpa-touch inline-flex w-full items-center gap-3 px-5 text-left text-sm text-secondary hover:bg-secondary/10"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              {t('mealCard.menu.delete')}
            </button>
          </div>
        )}

        <div className="p-5 flex-1 flex min-w-0 flex-col">
          <h3 className="arpa-recipe-card-title text-lg font-display font-extrabold text-on-surface mb-3 leading-tight">
            {meal.name}
          </h3>

          {(totalCalories > 0 || totalProtein > 0) && (
            <div className="flex flex-wrap gap-2 mb-4 text-xs font-display font-semibold">
              <div className="bg-primary-container/10 text-primary-container dark:bg-primary-fixed-dim/15 dark:text-primary-fixed-dim px-2.5 py-1.5 rounded-full inline-flex items-center gap-1">
                <Flame className="w-3 h-3" />
                {totalCalories.toFixed(0)} {t('mealCard.kcal')}
              </div>
              <div className="bg-surface-container-high text-on-surface-variant px-2.5 py-1.5 rounded-full inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('mealCard.count', {ingredients: meal.ingredients.length, servings})}
              </div>
            </div>
          )}

          <div className="flex-1">
            <h4 className="text-[10px] font-display font-bold text-outline uppercase tracking-widest mb-2">
              {t('mealCard.ingredients')}
            </h4>
            <ul className="space-y-1.5">
              {meal.ingredients.slice(0, 4).map((ing, i) => (
                <li
                  key={i}
                  className="arpa-recipe-card-ingredient text-sm text-on-surface-variant flex min-w-0 justify-between gap-3"
                >
                  <span className="min-w-0 truncate">{ing.name}</span>
                  <span className="arpa-recipe-card-amount shrink-0 text-outline whitespace-nowrap font-display font-semibold">
                    {ing.amount} {ing.measure}
                  </span>
                </li>
              ))}
              {meal.ingredients.length > 4 && (
                <li className="text-sm text-outline italic pt-1">
                  + {meal.ingredients.length - 4} {t('mealCard.more')}
                </li>
              )}
            </ul>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:hidden" aria-label={t('mobile.shell.recipeActions', { defaultValue: 'Recipe actions' })}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="arpa-touch inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-low px-3 text-sm font-display font-semibold text-on-surface"
            >
              <Edit2 className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{t('mealCard.menu.edit')}</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="arpa-touch inline-flex items-center justify-center gap-2 rounded-xl bg-secondary/10 px-3 text-sm font-display font-semibold text-secondary"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{t('mealCard.menu.delete')}</span>
            </button>
          </div>
        </div>
      </article>

      {showImageGen && (
        <ImageGenerator
          meal={meal}
          onClose={() => setShowImageGen(false)}
          onSuccess={() => {
            setShowImageGen(false);
            window.location.reload();
          }}
        />
      )}

      <MealDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        onEdit={() => {
          setShowDetails(false);
          onEdit();
        }}
        meal={meal}
      />
    </>
  );
}
