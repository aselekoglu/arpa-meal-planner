import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { Plus, Trash2, Utensils, Sparkles } from 'lucide-react';
import { Meal, PlannerItem } from '../types';
import GeneratePlanModal from '../components/GeneratePlanModal';
import { apiFetch } from '../lib/api';

export default function Planner() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

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

  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Start on Monday
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const handleAddMeal = async (dateStr: string, mealId: number) => {
    try {
      await apiFetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, meal_id: mealId })
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
    e.preventDefault(); // Necessary to allow dropping
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Weekly Planner</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Generate Plan</span>
          </button>
          <div className="flex bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 p-1">
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              className="px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg transition-colors"
            >
              Previous
            </button>
            <div className="px-4 py-1.5 text-sm font-semibold text-stone-900 dark:text-stone-100 border-x border-stone-100 dark:border-stone-800 flex items-center">
              {format(startDate, 'MMM d')} - {format(addDays(startDate, 6), 'MMM d, yyyy')}
            </div>
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              className="px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar for Drag and Drop */}
        <div className="w-full lg:w-64 flex-shrink-0 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 h-[calc(100vh-12rem)] overflow-y-auto sticky top-24 hidden lg:block">
          <h3 className="font-bold text-stone-900 dark:text-stone-100 mb-4">Your Meals</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">Drag meals onto the calendar to plan your week.</p>
          <div className="space-y-2">
            {meals.map(meal => (
              <div 
                key={meal.id}
                draggable
                onDragStart={(e) => handleDragStart(e, meal.id)}
                className="p-3 bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 rounded-xl cursor-grab active:cursor-grabbing hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
              >
                <div className="font-medium text-sm text-stone-800 dark:text-stone-200">{meal.name}</div>
                {meal.tag && <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{meal.tag}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
            const dayMeals = plannerItems.filter(item => item.date === dateStr);
            
            return (
              <div 
                key={dateStr} 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, dateStr)}
                className={`flex flex-col bg-white dark:bg-stone-900 rounded-2xl border ${isToday ? 'border-emerald-500 shadow-sm ring-1 ring-emerald-500/20' : 'border-stone-200 dark:border-stone-800 shadow-sm'} overflow-hidden h-full min-h-[200px] transition-colors`}
              >
              <div className={`px-4 py-3 border-b ${isToday ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800/50' : 'bg-stone-50 dark:bg-stone-800/50 border-stone-100 dark:border-stone-800'} flex justify-between items-center`}>
                <div>
                  <div className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400'}`}>
                    {format(day, 'EEEE')}
                  </div>
                  <div className={`text-lg font-semibold ${isToday ? 'text-emerald-900 dark:text-emerald-300' : 'text-stone-900 dark:text-stone-100'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
              </div>
              
              <div className="p-3 flex-1 flex flex-col gap-2">
                {dayMeals.length > 0 ? (
                  dayMeals.map(item => (
                    <div key={item.id} className="group relative bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 rounded-xl p-3 hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-colors">
                      <div className="font-medium text-sm text-stone-800 dark:text-stone-200 pr-6 leading-tight">
                        {item.meal_name}
                      </div>
                      <button 
                        onClick={() => handleRemoveMeal(item.id)}
                        className="absolute top-2 right-2 p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-stone-400 dark:text-stone-600 py-4">
                    <Utensils className="w-6 h-6 mb-2 opacity-20" />
                    <span className="text-xs font-medium">No meals</span>
                  </div>
                )}
                
                {isAdding === dateStr ? (
                  <div className="mt-auto pt-2">
                    <select 
                      className="w-full text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-stone-900 dark:text-stone-100"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddMeal(dateStr, parseInt(e.target.value));
                        }
                      }}
                      onBlur={() => setIsAdding(null)}
                      autoFocus
                    >
                      <option value="">Select a meal...</option>
                      {meals.map(meal => (
                        <option key={meal.id} value={meal.id}>{meal.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsAdding(dateStr)}
                    className="mt-auto w-full py-2 border border-dashed border-stone-200 dark:border-stone-700 rounded-xl text-stone-500 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
        </div>
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
