import { useState } from 'react';
import { MoreVertical, Edit2, Trash2, Tag as TagIcon, Image as ImageIcon } from 'lucide-react';
import { Meal } from '../types';
import ImageGenerator from './ImageGenerator';
import MealDetailsModal from './MealDetailsModal';

interface MealCardProps {
  meal: Meal;
  onDelete: () => void;
  onEdit: () => void;
}

export default function MealCard({ meal, onDelete, onEdit }: MealCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const totalCalories = meal.ingredients.reduce((sum, ing) => sum + (ing.calories || 0), 0);
  const totalProtein = meal.ingredients.reduce((sum, ing) => sum + (ing.protein || 0), 0);
  const totalFat = meal.ingredients.reduce((sum, ing) => sum + (ing.fat || 0), 0);
  const totalCarbs = meal.ingredients.reduce((sum, ing) => sum + (ing.carbs || 0), 0);

  return (
    <>
      <div 
        className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col transition-shadow hover:shadow-md cursor-pointer"
        onClick={() => setShowDetails(true)}
      >
        <div className="relative h-48 bg-stone-100 dark:bg-stone-800 flex items-center justify-center overflow-hidden">
          {meal.image_url ? (
          <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="text-stone-400 flex flex-col items-center gap-2">
            <ImageIcon className="w-8 h-8 opacity-50" />
            <span className="text-sm font-medium">No image</span>
          </div>
        )}
        
          <div className="absolute top-3 right-3">
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-stone-700 hover:bg-white shadow-sm transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-stone-900 rounded-xl shadow-lg border border-stone-100 dark:border-stone-800 py-1 z-10">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" /> Edit Meal
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      setShowImageGen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" /> Generate Image
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        
        {meal.tag && (
          <div className="absolute bottom-3 left-3">
            <span className="bg-white/90 backdrop-blur-sm text-stone-800 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
              <TagIcon className="w-3 h-3" />
              {meal.tag}
            </span>
          </div>
        )}
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-3">{meal.name}</h3>
        
        {(totalCalories > 0 || totalProtein > 0) && (
          <div className="flex gap-3 mb-4 text-xs font-medium text-stone-500 dark:text-stone-400">
            <div className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">{totalCalories.toFixed(0)} kcal</div>
            <div className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">P: {totalProtein.toFixed(1)}g</div>
            <div className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">F: {totalFat.toFixed(1)}g</div>
            <div className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">C: {totalCarbs.toFixed(1)}g</div>
          </div>
        )}
        
        <div className="flex-1">
          <h4 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Ingredients</h4>
          <ul className="space-y-1.5">
            {meal.ingredients.slice(0, 4).map((ing, i) => (
              <li key={i} className="text-sm text-stone-600 dark:text-stone-300 flex justify-between">
                <span className="truncate pr-2">{ing.name}</span>
                <span className="text-stone-400 dark:text-stone-500 whitespace-nowrap">{ing.amount} {ing.measure}</span>
              </li>
            ))}
            {meal.ingredients.length > 4 && (
              <li className="text-sm text-stone-400 dark:text-stone-500 italic pt-1">
                + {meal.ingredients.length - 4} more ingredients
              </li>
            )}
          </ul>
        </div>
      </div>

        {showImageGen && (
          <ImageGenerator 
            meal={meal} 
            onClose={() => setShowImageGen(false)} 
            onSuccess={() => {
              setShowImageGen(false);
              // In a real app we would update the meal with the new image URL
              // For now, we'll just reload the page or fetch meals again
              window.location.reload();
            }}
          />
        )}
      </div>

      <MealDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        meal={meal}
      />
    </>
  );
}
