import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { format, addDays } from 'date-fns';
import { apiFetch } from '../lib/api';

interface GeneratePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  startDate: Date;
}

const DIET_OPTIONS = [
  'Any / Balanced',
  'Vegetarian',
  'Vegan',
  'Keto',
  'Paleo',
  'High Protein',
  'Low Carb',
  'Mediterranean'
];

export default function GeneratePlanModal({ isOpen, onClose, onSave, startDate }: GeneratePlanModalProps) {
  const [diet, setDiet] = useState(DIET_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Generate a 7-day dinner meal plan for a ${diet} diet.
      Return a JSON object with a 'meals' array containing exactly 7 meals (one for each day of the week).
      Each meal must have:
      - 'name': The name of the meal
      - 'tag': A short category tag (e.g., '${diet}', 'Dinner')
      - 'ingredients': An array of ingredients required for the meal.
      For each ingredient, provide:
      - 'name': Ingredient name
      - 'amount': Quantity (number)
      - 'measure': Unit of measurement (e.g., 'Gram (g)', 'Unit', 'Cup (c)', 'Tablespoon (Tbsp)')
      - 'calories': Estimated calories (number)
      - 'protein': Estimated protein in grams (number)
      - 'fat': Estimated fat in grams (number)
      - 'carbs': Estimated carbs in grams (number)
      Make sure the nutritional values are realistic and appropriate for the selected diet.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    tag: { type: Type.STRING },
                    ingredients: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          amount: { type: Type.NUMBER },
                          measure: { type: Type.STRING },
                          calories: { type: Type.NUMBER },
                          protein: { type: Type.NUMBER },
                          fat: { type: Type.NUMBER },
                          carbs: { type: Type.NUMBER }
                        },
                        required: ['name', 'amount', 'measure', 'calories', 'protein', 'fat', 'carbs']
                      }
                    }
                  },
                  required: ['name', 'tag', 'ingredients']
                }
              }
            },
            required: ['meals']
          }
        }
      });

      const data = JSON.parse(response.text || '{}');

      if (!data.meals || !Array.isArray(data.meals) || data.meals.length !== 7) {
        throw new Error('Failed to generate a complete 7-day meal plan. Please try again.');
      }

      // Save each meal and add to planner
      for (let i = 0; i < 7; i++) {
        const meal = data.meals[i];
        const dateStr = format(addDays(startDate, i), 'yyyy-MM-dd');

        // 1. Save the meal
        const mealRes = await apiFetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(meal)
        });

        if (!mealRes.ok) {
          throw new Error('Failed to save generated meal.');
        }

        const mealData = await mealRes.json();

        // 2. Add to planner
        await apiFetch('/api/planner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr, meal_id: mealData.id })
        });
      }

      onSave();
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'An error occurred while generating the meal plan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 dark:bg-stone-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-stone-200 dark:border-stone-800">
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50 dark:bg-stone-800/50">
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            Generate Weekly Plan
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Let AI create a complete 7-day meal plan for you starting from <strong>{format(startDate, 'MMM d, yyyy')}</strong>.
          </p>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Dietary Preference
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DIET_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setDiet(option)}
                  className={`px-3 py-2 text-sm rounded-xl border text-left transition-colors ${
                    diet === option
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-medium'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-emerald-200 dark:hover:border-emerald-800'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/50">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-600 dark:text-stone-400 font-medium hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
