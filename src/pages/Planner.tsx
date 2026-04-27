import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import {
  Plus,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
  GripVertical,
  Clock,
} from 'lucide-react';
import { Meal, PlannerItem } from '../types';
import GeneratePlanModal from '../components/GeneratePlanModal';
import { apiFetch } from '../lib/api';

export default function Planner() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [discoverySearch, setDiscoverySearch] = useState('');
  const [discoveryFilter, setDiscoveryFilter] = useState<string | null>(null);

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

  useEffect(() => {
    fetchMeals();
    fetchPlanner();
  }, []);

  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const tags = Array.from(new Set(meals.map((m) => m.tag).filter(Boolean)));

  const filteredDiscovery = meals.filter((meal) => {
    const matchesSearch = meal.name.toLowerCase().includes(discoverySearch.toLowerCase());
    const matchesFilter = discoveryFilter ? meal.tag === discoveryFilter : true;
    return matchesSearch && matchesFilter;
  });

  const handleAddMeal = async (dateStr: string, mealId: number) => {
    try {
      await apiFetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, meal_id: mealId }),
      });
      fetchPlanner();
      setIsAdding(null);
    } catch (error) {
      console.error('Failed to add meal to planner', error);
    }
  };

  const handleDragStart = (e: React.DragEvent, mealId: number) => {
    e.dataTransfer.setData('mealId', mealId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const mealId = e.dataTransfer.getData('mealId');
    if (mealId) {
      handleAddMeal(dateStr, parseInt(mealId));
    }
  };

  const handleRemoveMeal = async (id: number) => {
    try {
      await apiFetch(`/api/planner/${id}`, { method: 'DELETE' });
      fetchPlanner();
    } catch (error) {
      console.error('Failed to remove meal from planner', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-primary-container dark:text-primary-fixed-dim">
            Weekly Planner
          </h1>
          <p className="text-on-surface-variant dark:text-stone-400 mt-1 font-medium">
            Drag recipes from the discovery panel onto your week.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-low dark:bg-stone-900 rounded-full p-1.5">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              className="p-2 rounded-full hover:bg-surface-container-lowest dark:hover:bg-stone-800 transition-colors active:scale-90"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
            </button>
            <div className="px-3 text-sm font-display font-semibold text-on-surface dark:text-stone-100 whitespace-nowrap">
              {format(startDate, 'MMM d')} – {format(addDays(startDate, 6), 'MMM d')}
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
            className="px-5 py-2.5 rounded-full bg-surface-container-highest dark:bg-stone-800 text-on-surface dark:text-stone-100 font-display font-semibold text-sm hover:bg-surface-dim dark:hover:bg-stone-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="px-5 py-2.5 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm flex items-center gap-2 transition-opacity hover:opacity-90 active:scale-95 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Generate Plan</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar grid */}
        <section className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 lg:gap-4">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
            const dayMeals = plannerItems.filter((item) => item.date === dateStr);
            const dayMealsWithImg = dayMeals.map((p) => ({
              planner: p,
              meal: meals.find((m) => m.id === p.meal_id),
            }));

            return (
              <div
                key={dateStr}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, dateStr)}
                className="flex flex-col gap-3 group"
              >
                <div className="text-center py-2">
                  <p
                    className={`font-display text-[11px] uppercase tracking-widest font-bold ${
                      isToday ? 'text-primary-container dark:text-primary-fixed-dim' : 'text-outline'
                    }`}
                  >
                    {format(day, 'EEE')}
                  </p>
                  <p
                    className={`font-display text-xl font-extrabold ${
                      isToday
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-on-surface dark:text-stone-100'
                    }`}
                  >
                    {format(day, 'd')}
                  </p>
                </div>

                {dayMealsWithImg.length > 0 ? (
                  dayMealsWithImg.map(({ planner, meal }) => (
                    <article
                      key={planner.id}
                      className="aspect-[4/5] rounded-[1.5rem] overflow-hidden relative group/card cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-surface-container dark:bg-stone-800"
                    >
                      {meal?.image_url ? (
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                          className="w-full h-full object-cover group-hover/card:grayscale-0 grayscale-[0.15] transition-all duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-container/30 to-secondary-container/30" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-3 flex flex-col justify-end">
                        <h4 className="text-white font-display font-bold text-sm leading-tight line-clamp-2">
                          {planner.meal_name}
                        </h4>
                        {meal?.tag && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-white/80">
                            <span className="px-1.5 py-0.5 bg-white/15 backdrop-blur-sm rounded-full font-bold">
                              {meal.tag}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMeal(planner.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white/85 hover:bg-white text-secondary rounded-full opacity-0 group-hover/card:opacity-100 transition-all"
                        aria-label="Remove from planner"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </article>
                  ))
                ) : null}

                {isAdding === dateStr ? (
                  <div className="aspect-[4/5] rounded-[1.5rem] border-2 border-primary/40 bg-surface-container-low dark:bg-stone-900 flex items-center p-3">
                    <select
                      className="w-full h-full text-sm bg-transparent border border-outline-variant/40 dark:border-stone-700 rounded-2xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface dark:text-stone-100"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddMeal(dateStr, parseInt(e.target.value));
                        }
                      }}
                      onBlur={() => setIsAdding(null)}
                      autoFocus
                    >
                      <option value="">Select a meal…</option>
                      {meals.map((meal) => (
                        <option key={meal.id} value={meal.id}>
                          {meal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAdding(dateStr)}
                    className="aspect-[4/5] rounded-[1.5rem] border-2 border-dashed border-outline-variant/50 hover:border-primary/40 hover:bg-surface-container-low dark:hover:bg-stone-900/50 flex flex-col items-center justify-center gap-2 text-outline hover:text-primary-container transition-colors group/empty"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px] font-display font-bold uppercase tracking-wider">
                      Quick Add
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </section>

        {/* Discovery panel */}
        <aside className="w-full lg:w-80 flex-shrink-0 bg-surface-container-low dark:bg-stone-900 rounded-[2rem] p-6 flex flex-col gap-5 self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]">
          <div>
            <h3 className="font-display text-xl font-bold text-primary-container dark:text-primary-fixed-dim">
              Recipe Discovery
            </h3>
            <p className="text-xs text-outline font-medium mt-1">Drag recipes onto your calendar</p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={discoverySearch}
              onChange={(e) => setDiscoverySearch(e.target.value)}
              placeholder="Find inspiration…"
              className="w-full pl-9 pr-3 py-2.5 bg-surface-container-lowest dark:bg-stone-800 border-none rounded-full text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 text-on-surface dark:text-stone-100 placeholder:text-outline"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDiscoveryFilter(null)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-display font-bold transition-colors ${
                discoveryFilter === null
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest dark:bg-stone-800 text-on-surface-variant hover:bg-surface-dim'
              }`}
            >
              All
            </button>
            {tags.slice(0, 6).map((tag) => (
              <button
                key={tag}
                onClick={() => setDiscoveryFilter(tag)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-display font-bold transition-colors ${
                  discoveryFilter === tag
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                    : 'bg-surface-container-lowest dark:bg-stone-800 text-on-surface-variant hover:bg-surface-dim'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto thin-scrollbar flex flex-col gap-3 pr-1 -mr-1 max-h-[60vh] lg:max-h-none">
            {filteredDiscovery.length > 0 ? (
              filteredDiscovery.map((meal) => (
                <div
                  key={meal.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, meal.id)}
                  className="group flex items-center gap-3 p-2 bg-surface-container-lowest dark:bg-stone-800 rounded-2xl hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                >
                  <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-surface-container-high dark:bg-stone-700">
                    {meal.image_url ? (
                      <img
                        src={meal.image_url}
                        alt={meal.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <h5 className="text-xs font-display font-bold text-on-surface dark:text-stone-100 truncate">
                      {meal.name}
                    </h5>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {meal.tag && (
                        <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                          {meal.tag}
                        </span>
                      )}
                      <span className="text-outline text-[9px] font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {meal.ingredients.length}
                      </span>
                    </div>
                  </div>
                  <GripVertical className="w-4 h-4 text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))
            ) : (
              <p className="text-xs text-outline italic text-center py-6">
                No recipes match your search. Try clearing filters.
              </p>
            )}
          </div>
        </aside>
      </div>

      {isGenerateModalOpen && (
        <GeneratePlanModal
          isOpen={isGenerateModalOpen}
          onClose={() => setIsGenerateModalOpen(false)}
          startDate={startDate}
          onSave={() => {
            setIsGenerateModalOpen(false);
            fetchMeals();
            fetchPlanner();
          }}
        />
      )}
    </div>
  );
}
