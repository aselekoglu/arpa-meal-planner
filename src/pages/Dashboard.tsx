import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Tag as TagIcon,
  Utensils,
  Globe,
  ArrowRight,
  Sparkles,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Meal, PlannerItem, PantryItem } from '../types';
import MealCard from '../components/MealCard';
import AddMealModal from '../components/AddMealModal';
import ImportRecipeModal from '../components/ImportRecipeModal';
import { apiFetch } from '../lib/api';
import { addDays, format, startOfWeek } from 'date-fns';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Dashboard() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | Partial<Meal> | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const fetchMeals = async () => {
    try {
      const res = await apiFetch('/api/meals');
      const data = await res.json();
      setMeals(data);
    } catch (error) {
      console.error('Failed to fetch meals', error);
    }
  };

  const fetchPlanner = async () => {
    try {
      const res = await apiFetch('/api/planner');
      const data = await res.json();
      setPlannerItems(data);
    } catch (error) {
      console.error('Failed to fetch planner', error);
    }
  };

  const fetchPantry = async () => {
    try {
      const res = await apiFetch('/api/pantry');
      const data = await res.json();
      setPantryItems(data);
    } catch (error) {
      console.error('Failed to fetch pantry', error);
    }
  };

  useEffect(() => {
    fetchMeals();
    fetchPlanner();
    fetchPantry();
  }, []);

  const tags = Array.from(new Set(meals.map((m) => m.tag).filter(Boolean)));
  const ingredientNameSuggestions = Array.from(
    new Map(
      [
        ...meals.flatMap((meal) => meal.ingredients.map((ingredient) => ingredient.name?.trim() || '')),
        ...pantryItems.map((item) => item.name?.trim() || ''),
      ]
        .filter(Boolean)
        .map((name) => [name.toLowerCase(), name] as const),
    ).values(),
  ).sort((a, b) => a.localeCompare(b));

  const filteredMeals = meals.filter((meal) => {
    const matchesSearch = meal.name.toLowerCase().includes(search.toLowerCase());
    const matchesTag = selectedTag ? meal.tag === selectedTag : true;
    return matchesSearch && matchesTag;
  });

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekDates = Array.from({ length: 7 }).map((_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  const weekMeals = plannerItems
    .filter((item) => weekDates.includes(item.date))
    .map((item) => {
      const meal = meals.find((m) => m.id === item.meal_id);
      return meal ? { meal, dayIndex: weekDates.indexOf(item.date) } : null;
    })
    .filter((m): m is { meal: Meal; dayIndex: number } => Boolean(m));

  const previewMeals = (
    weekMeals.length > 0
      ? weekMeals.slice(0, 6)
      : meals.slice(0, 6).map((meal, i) => ({ meal, dayIndex: i % 7 }))
  );

  const summary = weekMeals.reduce(
    (acc, { meal }) => {
      meal.ingredients.forEach((ing) => {
        acc.calories += ing.calories || 0;
        acc.protein += ing.protein || 0;
        acc.carbs += ing.carbs || 0;
        acc.fat += ing.fat || 0;
      });
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const dailyCalories = Math.round((summary.calories || 0) / 7);
  const dailyProtein = Math.round((summary.protein || 0) / 7);
  const dailyCarbs = Math.round((summary.carbs || 0) / 7);
  const dailyFat = Math.round((summary.fat || 0) / 7);

  const proteinPct = Math.min(100, Math.round((dailyProtein / 150) * 100));
  const carbsPct = Math.min(100, Math.round((dailyCarbs / 300) * 100));
  const fatPct = Math.min(100, Math.round((dailyFat / 80) * 100));

  const pantryLookup = new Set(pantryItems.map((item) => item.name.toLowerCase()));
  const groceryPreview = weekMeals
    .flatMap(({ meal }) => meal.ingredients)
    .filter((ing) => !pantryLookup.has(ing.name.toLowerCase()))
    .slice(0, 6);
  const pantryAlerts = pantryItems.filter((item) => item.amount <= 1).slice(0, 3);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this meal?')) return;
    try {
      await apiFetch(`/api/meals/${id}`, { method: 'DELETE' });
      fetchMeals();
    } catch (error) {
      console.error('Failed to delete meal', error);
    }
  };

  const handleEdit = (meal: Meal) => {
    setEditingMeal(meal);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl xl:text-5xl font-display font-extrabold tracking-tight text-primary-container dark:text-primary-fixed-dim">
            Welcome back, Gourmet.
          </h1>
          <p className="text-on-surface-variant dark:text-stone-400 mt-2 font-medium">
            Nutrition and meals for {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 bg-surface-container-low dark:bg-stone-900 rounded-full p-1.5">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              className="p-2 rounded-full hover:bg-surface-container-lowest dark:hover:bg-stone-800 transition-colors active:scale-90"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
            </button>
            <div className="px-3 text-sm font-display font-semibold text-on-surface dark:text-stone-100 whitespace-nowrap">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
            </div>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              className="p-2 rounded-full hover:bg-surface-container-lowest dark:hover:bg-stone-800 transition-colors active:scale-90"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            </button>
          </div>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-4 py-3 bg-surface-container-highest dark:bg-stone-800 hover:bg-surface-dim dark:hover:bg-stone-700 text-on-surface dark:text-stone-200 font-display font-semibold text-sm rounded-full transition-colors active:scale-95"
          >
            Current Week
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-5 py-3 bg-surface-container-highest dark:bg-stone-800 hover:bg-surface-dim dark:hover:bg-stone-700 text-on-surface dark:text-stone-200 font-display font-semibold text-sm rounded-full flex items-center gap-2 transition-colors active:scale-95"
          >
            <Globe className="w-4 h-4" />
            Import Recipe
          </button>
          <button
            onClick={() => {
              setEditingMeal(null);
              setIsAddModalOpen(true);
            }}
            className="px-5 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm rounded-full flex items-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Meal
          </button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6 lg:gap-8">
        {/* Main column */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Nutrition bento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard label="Calories" value={dailyCalories.toLocaleString()} unit="kcal / daily" />
            <MetricCard label="Protein" value={`${dailyProtein}g`} barPct={proteinPct} barClass="bg-primary" />
            <MetricCard label="Carbs" value={`${dailyCarbs}g`} barPct={carbsPct} barClass="bg-secondary-container" />
            <MetricCard label="Fat" value={`${dailyFat}g`} barPct={fatPct} barClass="bg-tertiary-container" />
          </div>

          {/* Weekly Overview - horizontal scroll */}
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-display font-bold text-primary-container dark:text-primary-fixed-dim">
                Weekly Overview
              </h2>
              <Link
                to="/planner"
                className="text-sm font-display font-semibold text-primary-container dark:text-primary-fixed-dim hover:underline inline-flex items-center gap-1"
              >
                View Calendar <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {previewMeals.length > 0 ? (
              <div className="flex gap-5 overflow-x-auto pb-3 hide-scrollbar -mx-5 px-5 lg:mx-0 lg:px-0 snap-x snap-mandatory">
                {previewMeals.map(({ meal, dayIndex }) => (
                  <article
                    key={meal.id}
                    className="min-w-[260px] sm:min-w-[280px] snap-start bg-surface-container-lowest dark:bg-stone-900 rounded-[2rem] overflow-hidden border border-outline-variant/15 dark:border-stone-800 group"
                  >
                    <div className="relative h-40 bg-surface-container-high dark:bg-stone-800 overflow-hidden">
                      {meal.image_url ? (
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-outline">
                          <Utensils className="w-8 h-8 opacity-50" />
                        </div>
                      )}
                      <div
                        className={`absolute top-4 left-4 px-3 py-1 text-[10px] font-display font-bold uppercase tracking-tight rounded-full ${
                          dayIndex === 0
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-highest text-primary-container'
                        }`}
                      >
                        {DAY_LABELS[dayIndex] ?? 'Today'}
                      </div>
                    </div>
                    <div className="p-5">
                      <h4 className="font-display font-bold text-on-surface dark:text-stone-100 mb-1 leading-tight">
                        {meal.name}
                      </h4>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {meal.tag && (
                          <span className="text-[10px] px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full font-bold">
                            {meal.tag}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded-full font-bold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {meal.ingredients.length} ingredients
                        </span>
                      </div>
                      <Link
                        to="/planner"
                        className="text-xs font-display font-bold text-primary-container dark:text-primary-fixed-dim inline-flex items-center gap-1 group/btn"
                      >
                        Recipe Details
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-outline-variant p-10 text-center text-outline dark:text-stone-500">
                Add meals to your planner to see your weekly overview here.
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-surface-container-low dark:bg-stone-900 rounded-[2rem] p-6 lg:p-7">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-display font-bold text-primary-container dark:text-primary-fixed-dim">
                Grocery List
              </h3>
              <Link
                to="/grocery"
                className="p-2 bg-surface-container-lowest dark:bg-stone-800 rounded-full text-primary-container dark:text-primary-fixed-dim shadow-sm transition-transform active:scale-95"
                aria-label="Open grocery list"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            {groceryPreview.length > 0 ? (
              <ul className="space-y-3">
                {groceryPreview.map((item, i) => (
                  <li key={`${item.name}-${i}`} className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded border border-outline-variant flex-shrink-0" />
                    <span className="text-sm font-medium text-on-surface dark:text-stone-100 flex-grow truncate">
                      {item.name}
                    </span>
                    <span className="text-xs text-outline whitespace-nowrap">
                      {item.amount} {item.measure}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant dark:text-stone-400">
                No grocery items needed for this week.
              </p>
            )}
          </div>

          <div className="bg-surface-container-low dark:bg-stone-900 rounded-[2rem] p-6 lg:p-7">
            <h3 className="text-lg font-display font-bold text-primary-container dark:text-primary-fixed-dim mb-5">
              Pantry Stock Alerts
            </h3>
            {pantryAlerts.length > 0 ? (
              <div className="space-y-3">
                {pantryAlerts.map((item, i) => (
                  <div
                    key={item.id}
                    className={`p-4 bg-surface-container-lowest dark:bg-stone-800 rounded-2xl flex items-start gap-3 border-l-4 shadow-sm ${
                      i === 0 ? 'border-secondary' : 'border-tertiary-container'
                    }`}
                  >
                    {i === 0 ? (
                      <AlertTriangle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                    ) : (
                      <Bell className="w-5 h-5 text-tertiary-container flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface dark:text-stone-100 leading-tight">
                        Low on {item.name}
                      </p>
                      <p className="text-xs text-on-surface-variant dark:text-stone-400 mt-0.5">
                        Only {item.amount} {item.measure} remaining
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant dark:text-stone-400">
                Pantry levels look healthy.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hero promo */}
      <section className="relative rounded-[2rem] overflow-hidden bg-primary-container text-on-primary-container">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary via-primary-container to-primary-container/70 opacity-90" />
        <div className="relative z-10 px-8 lg:px-12 py-10 lg:py-14 max-w-2xl">
          <h3 className="text-2xl md:text-3xl xl:text-4xl font-display font-extrabold leading-tight mb-3">
            Master the Art of Meal Prep.
          </h3>
          <p className="text-on-primary-container/80 text-base md:text-lg mb-7 max-w-xl">
            Our AI analyzes your pantry and cravings to generate a bespoke weekly menu that reduces waste and elevates your kitchen.
          </p>
          <Link
            to="/planner"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-on-primary-container text-primary-container font-display font-bold rounded-full shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            Optimize My Weekly Plan
          </Link>
        </div>
      </section>

      {/* Library */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-xl md:text-2xl font-display font-bold text-primary-container dark:text-primary-fixed-dim">
            Recipe Library
          </h2>
          <span className="text-sm text-on-surface-variant dark:text-stone-400">
            {filteredMeals.length} {filteredMeals.length === 1 ? 'meal' : 'meals'}
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
          <input
            type="text"
            placeholder="Search recipes, ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-surface-container-low dark:bg-stone-900 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface dark:text-stone-100 placeholder:text-outline"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-4 py-2 rounded-full text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              selectedTag === null
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low dark:bg-stone-900 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-stone-800'
            }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-full text-xs font-display font-bold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
                selectedTag === tag
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                  : 'bg-surface-container-low dark:bg-stone-900 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-stone-800'
              }`}
            >
              <TagIcon className="w-3 h-3" />
              {tag}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6">
          {filteredMeals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onDelete={() => handleDelete(meal.id)}
              onEdit={() => handleEdit(meal)}
            />
          ))}
        </div>

        {filteredMeals.length === 0 && (
          <div className="text-center py-14 bg-surface-container-low dark:bg-stone-900 rounded-[2rem]">
            <Utensils className="w-12 h-12 text-outline mx-auto mb-3" />
            <h3 className="text-lg font-display font-bold text-on-surface dark:text-stone-100">
              No meals found
            </h3>
            <p className="text-on-surface-variant dark:text-stone-400 mt-1">
              Try adjusting your search or add a new meal.
            </p>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <AddMealModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingMeal(null);
          }}
          onSave={() => {
            setIsAddModalOpen(false);
            setEditingMeal(null);
            fetchMeals();
          }}
          editingMeal={editingMeal}
          ingredientNameSuggestions={ingredientNameSuggestions}
        />
      )}

      {isImportModalOpen && (
        <ImportRecipeModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSave={(draftMeal) => {
            setIsImportModalOpen(false);
            setEditingMeal(draftMeal);
            setIsAddModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string;
  unit?: string;
  barPct?: number;
  barClass?: string;
}

function MetricCard({ label, value, unit, barPct, barClass = 'bg-primary' }: MetricProps) {
  return (
    <div className="bg-surface-container-lowest dark:bg-stone-900 p-5 lg:p-6 rounded-[2rem] border border-outline-variant/15 dark:border-stone-800 flex flex-col items-center text-center">
      <span className="text-[10px] font-display font-bold uppercase tracking-widest text-primary-container/70 dark:text-primary-fixed-dim/70 mb-2">
        {label}
      </span>
      <span className="text-2xl lg:text-3xl font-display font-extrabold text-primary-container dark:text-primary-fixed-dim">
        {value}
      </span>
      {unit ? (
        <span className="text-[10px] text-on-surface-variant dark:text-stone-400 mt-1">{unit}</span>
      ) : null}
      {typeof barPct === 'number' && (
        <div className="w-full h-1 bg-surface-container mt-3 rounded-full overflow-hidden">
          <div className={`${barClass} h-full transition-[width]`} style={{ width: `${barPct}%` }} />
        </div>
      )}
    </div>
  );
}
