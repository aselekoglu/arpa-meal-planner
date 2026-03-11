import { useState } from 'react';
import { X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Meal } from '../types';
import { GoogleGenAI } from '@google/genai';
import { apiFetch } from '../lib/api';

interface ImageGeneratorProps {
  meal: Meal;
  onClose: () => void;
  onSuccess: (imageUrl: string) => void;
}

export default function ImageGenerator({ meal, onClose, onSuccess }: ImageGeneratorProps) {
  const [size, setSize] = useState('1K');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    try {
      // Use AI Studio's built-in key selection for paid models
      // @ts-ignore
      if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }
      
      const prompt = `A high-quality, appetizing food photography shot of ${meal.name}, which is a ${meal.tag} dish. Ingredients include: ${meal.ingredients.map(i => i.name).join(', ')}. Professional lighting, shallow depth of field, delicious looking.`;
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: size || "1K"
          }
        }
      });

      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          imageUrl = `data:image/png;base64,${base64EncodeString}`;
          break;
        }
      }

      if (!imageUrl) {
        throw new Error('Failed to generate image');
      }

      // Update the meal with the new image URL
      await apiFetch(`/api/meals/${meal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: meal.name,
          tag: meal.tag,
          ingredients: meal.ingredients,
          image_url: imageUrl
        }),
      });

      onSuccess(imageUrl);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 dark:bg-stone-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-stone-200 dark:border-stone-800">
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50 dark:bg-stone-800/50">
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            Generate Image
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Generate a custom image for <strong className="text-stone-900 dark:text-stone-100">{meal.name}</strong> using Nano Banana Pro.
          </p>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Image Size</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
            >
              <option value="1K">1K (Standard)</option>
              <option value="2K">2K (High Quality)</option>
              <option value="4K">4K (Ultra High Quality)</option>
            </select>
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
            className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Image'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
