import { useState, useEffect } from 'react';
import { Plus, Search, Tag as TagIcon, Utensils, Globe } from 'lucide-react';
import { Meal } from '../types';
import MealCard from '../components/MealCard';
import AddMealModal from '../components/AddMealModal';
import ImportRecipeModal from '../components/ImportRecipeModal';
import { apiFetch } from '../lib/api';

export default function Dashboard() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'calories' | 'protein'>('name');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  const fetchMeals = async () => {
    try {
      const res = await apiFetch('/api/meals');
      const data = await res.json();
      setMeals(data);
    } catch (error) {
      console.error('Failed to fetch meals', error);
    }
  };

  useEffect(() => {
    fetchMeals();
  }, []);

  const tags = Array.from(new Set(meals.map(m => m.tag).filter(Boolean)));

  const filteredMeals = meals.filter(meal => {
    const matchesSearch = meal.name.toLowerCase().includes(search.toLowerCase());
    const matchesTag = selectedTag ? meal.tag === selectedTag : true;
    return matchesSearch && matchesTag;
  }).sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    
    const getNutrition = (meal: Meal, type: 'calories' | 'protein') => 
      meal.ingredients.reduce((sum, ing) => sum + (ing[type] || 0), 0);
      
    if (sortBy === 'calories') {
      return getNutrition(a, 'calories') - getNutrition(b, 'calories');
    }
    if (sortBy === 'protein') {
      return getNutrition(b, 'protein') - getNutrition(a, 'protein'); // High to low
    }
    return 0;
  });

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Meals</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm border border-stone-200 dark:border-stone-700"
          >
            <Globe className="w-5 h-5" />
            Import
          </button>
          <button
            onClick={() => {
              setEditingMeal(null);
              setIsAddModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Meal
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search meals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-stone-900 dark:text-stone-100 placeholder-stone-400"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-stone-900 dark:text-stone-100 font-medium"
          >
            <option value="name">Sort by Name</option>
            <option value="calories">Lowest Calories</option>
            <option value="protein">Highest Protein</option>
          </select>
        </div>
      </div>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              selectedTag === null 
                ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900' 
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
            }`}
          >
            All
          </button>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                selectedTag === tag 
                  ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                  : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <TagIcon className="w-3.5 h-3.5" />
              {tag}
            </button>
          ))}
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMeals.map(meal => (
          <MealCard 
            key={meal.id} 
            meal={meal} 
            onDelete={() => handleDelete(meal.id)}
            onEdit={() => handleEdit(meal)}
          />
        ))}
      </div>

      {filteredMeals.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 border-dashed">
          <Utensils className="w-12 h-12 text-stone-300 dark:text-stone-700 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">No meals found</h3>
          <p className="text-stone-500 dark:text-stone-400 mt-1">Try adjusting your search or add a new meal.</p>
        </div>
      )}

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
