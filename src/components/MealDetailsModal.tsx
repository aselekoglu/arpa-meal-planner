import { useState } from 'react';
import { X, ExternalLink, Clock, ChefHat, Tag as TagIcon, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Meal } from '../types';

interface MealDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: Meal | null;
}

export default function MealDetailsModal({ isOpen, onClose, meal }: MealDetailsModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen || !meal) return null;

  const totalCalories = meal.ingredients.reduce((sum, ing) => sum + (ing.calories || 0), 0);
  const totalProtein = meal.ingredients.reduce((sum, ing) => sum + (ing.protein || 0), 0);
  const totalFat = meal.ingredients.reduce((sum, ing) => sum + (ing.fat || 0), 0);
  const totalCarbs = meal.ingredients.reduce((sum, ing) => sum + (ing.carbs || 0), 0);

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="relative h-64 bg-stone-100 dark:bg-stone-800 flex-shrink-0">
          {meal.image_url ? (
            <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 dark:text-stone-500">
              <ImageIcon className="w-12 h-12 opacity-50 mb-2" />
              <span className="font-medium">No image available</span>
            </div>
          )}
          
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm rounded-full text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-800 shadow-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {meal.tag && (
            <div className="absolute bottom-4 left-4">
              <span className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm text-stone-800 dark:text-stone-200 text-sm font-semibold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
                <TagIcon className="w-4 h-4" />
                {meal.tag}
              </span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">{meal.name}</h2>
              {meal.source_url && (
                <a 
                  href={meal.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Original Recipe
                </a>
              )}
            </div>

            {(totalCalories > 0 || totalProtein > 0) && (
              <div className="flex flex-wrap gap-3 text-sm font-medium text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl border border-stone-100 dark:border-stone-800">
                <div className="flex flex-col items-center px-2">
                  <span className="text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider mb-0.5">Calories</span>
                  <span>{totalCalories.toFixed(0)}</span>
                </div>
                <div className="w-px bg-stone-200 dark:bg-stone-700"></div>
                <div className="flex flex-col items-center px-2">
                  <span className="text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider mb-0.5">Protein</span>
                  <span>{totalProtein.toFixed(1)}g</span>
                </div>
                <div className="w-px bg-stone-200 dark:bg-stone-700"></div>
                <div className="flex flex-col items-center px-2">
                  <span className="text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider mb-0.5">Fat</span>
                  <span>{totalFat.toFixed(1)}g</span>
                </div>
                <div className="w-px bg-stone-200 dark:bg-stone-700"></div>
                <div className="flex flex-col items-center px-2">
                  <span className="text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider mb-0.5">Carbs</span>
                  <span>{totalCarbs.toFixed(1)}g</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-4">
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-2">
                <ChefHat className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                Ingredients
              </h3>
              <ul className="space-y-3">
                {meal.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between items-start text-sm">
                    <span className="text-stone-700 dark:text-stone-300 font-medium pr-4">{ing.name}</span>
                    <span className="text-stone-500 dark:text-stone-400 whitespace-nowrap text-right">
                      {ing.amount} {ing.measure}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-2 space-y-4">
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-2">
                <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                Instructions
              </h3>
              {meal.instructions && meal.instructions.length > 0 ? (
                <div className="relative bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl p-6 overflow-hidden min-h-[250px] flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Step {currentStep + 1} of {meal.instructions.length}
                    </span>
                    <div className="flex gap-1.5">
                      {meal.instructions.map((_, idx) => (
                        <div 
                          key={idx} 
                          className={`w-2 h-2 rounded-full transition-colors ${idx === currentStep ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600'}`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex-1 relative">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 text-stone-700 dark:text-stone-300 text-lg leading-relaxed whitespace-pre-wrap"
                      >
                        {meal.instructions[currentStep]}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  
                  <div className="flex justify-between mt-8 pt-4 border-t border-stone-200 dark:border-stone-700">
                    <button
                      onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                      disabled={currentStep === 0}
                      className="flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <button
                      onClick={() => setCurrentStep(Math.min(meal.instructions!.length - 1, currentStep + 1))}
                      disabled={currentStep === meal.instructions.length - 1}
                      className="flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 disabled:hover:bg-emerald-600 transition-colors shadow-sm"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-stone-50 dark:bg-stone-800/50 border border-dashed border-stone-200 dark:border-stone-700 rounded-xl p-6 text-center text-stone-500 dark:text-stone-400">
                  <p>No instructions available for this meal.</p>
                  <p className="text-xs mt-1">Edit the meal to add step-by-step directions.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
