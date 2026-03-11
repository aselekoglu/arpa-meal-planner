import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Save, Camera, Upload, Link as LinkIcon, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { Meal, Ingredient } from '../types';
import { apiFetch } from '../lib/api';

interface AddMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingMeal?: Meal | null;
}

export default function AddMealModal({ isOpen, onClose, onSave, editingMeal }: AddMealModalProps) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [instructions, setInstructions] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ingredients, setIngredients] = useState<Partial<Ingredient>[]>([
    { name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 }
  ]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (editingMeal) {
      setName(editingMeal.name || '');
      setTag(editingMeal.tag || '');
      setInstructions(editingMeal.instructions || []);
      setSourceUrl(editingMeal.source_url || '');
      setImageUrl(editingMeal.image_url || '');
      setIngredients(editingMeal.ingredients?.length > 0 ? editingMeal.ingredients : [{ name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 }]);
    } else {
      setName('');
      setTag('');
      setInstructions([]);
      setSourceUrl('');
      setImageUrl('');
      setIngredients([{ name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 }]);
    }
  }, [editingMeal, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImageUrl(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string | number) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validIngredients = ingredients.filter(i => i.name && i.name.trim() !== '');
    
    const mealData = {
      name,
      tag,
      instructions: instructions.filter(step => step.trim() !== ''),
      source_url: sourceUrl,
      image_url: imageUrl,
      ingredients: validIngredients
    };

    try {
      if (editingMeal && editingMeal.id) {
        await apiFetch(`/api/meals/${editingMeal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mealData)
        });
      } else {
        await apiFetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mealData)
        });
      }
      onSave();
    } catch (error) {
      console.error('Failed to save meal', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center sticky top-0 bg-white dark:bg-stone-900 z-10">
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            {editingMeal && editingMeal.id ? 'Edit Meal' : 'Add New Meal'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Meal Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bebu Koftesi"
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Tag</label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="e.g. Mediterranean, Breakfast"
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Source URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Meal Image</label>
              <div className="space-y-4">
                {imageUrl ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="aspect-video rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-800/50 text-stone-400">
                    {isCameraOpen ? (
                      <div className="relative w-full h-full">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover rounded-xl" />
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="p-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors shadow-lg"
                          >
                            <Camera className="w-6 h-6" />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="p-3 bg-stone-600 text-white rounded-full hover:bg-stone-700 transition-colors shadow-lg"
                          >
                            <RotateCcw className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm">No image selected</p>
                      </>
                    )}
                  </div>
                )}

                {!isCameraOpen && (
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex flex-col items-center justify-center p-3 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer transition-colors">
                      <Upload className="w-5 h-5 mb-1 text-emerald-600 dark:text-emerald-500" />
                      <span className="text-xs font-medium">Upload</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex flex-col items-center justify-center p-3 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                    >
                      <Camera className="w-5 h-5 mb-1 text-emerald-600 dark:text-emerald-500" />
                      <span className="text-xs font-medium">Camera</span>
                    </button>
                    <div className="relative group">
                      <div className="flex flex-col items-center justify-center p-3 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                        <LinkIcon className="w-5 h-5 mb-1 text-emerald-600 dark:text-emerald-500" />
                        <span className="text-xs font-medium">URL</span>
                      </div>
                      <input
                        type="url"
                        placeholder="Paste image URL..."
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="absolute inset-0 opacity-0 focus:opacity-100 w-full h-full px-3 py-2 border border-emerald-500 rounded-xl bg-white dark:bg-stone-900 text-xs transition-opacity"
                      />
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Instructions</label>
                <button
                  type="button"
                  onClick={() => setInstructions([...instructions, ''])}
                  className="text-sm text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </button>
              </div>
              
              <div className="space-y-3">
                {instructions.map((step, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-sm mt-1">
                      {index + 1}
                    </div>
                    <textarea
                      value={step}
                      onChange={(e) => {
                        const newInst = [...instructions];
                        newInst[index] = e.target.value;
                        setInstructions(newInst);
                      }}
                      placeholder={`Step ${index + 1}`}
                      rows={2}
                      className="flex-1 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => setInstructions(instructions.filter((_, i) => i !== index))}
                      className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors mt-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {instructions.length === 0 && (
                  <div className="text-sm text-stone-500 dark:text-stone-400 italic text-center py-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-dashed border-stone-200 dark:border-stone-700">
                    No instructions added yet. Click "Add Step" to begin.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Ingredients</label>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="text-sm text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Ingredient
                </button>
              </div>
              
              <div className="space-y-4">
                {ingredients.map((ing, index) => (
                  <div key={index} className="flex flex-col gap-2 p-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Ingredient name"
                          value={ing.name || ''}
                          onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Amount"
                          value={ing.amount || ''}
                          onChange={(e) => handleIngredientChange(index, 'amount', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        />
                      </div>
                      <div className="w-32">
                        <input
                          type="text"
                          placeholder="Measure"
                          value={ing.measure || ''}
                          onChange={(e) => handleIngredientChange(index, 'measure', e.target.value)}
                          className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                          list="measures"
                        />
                        <datalist id="measures">
                          <option value="Gram (g)" />
                          <option value="Unit" />
                          <option value="Cup (c)" />
                          <option value="Tablespoon (Tbsp)" />
                          <option value="Teaspoon (tsp)" />
                          <option value="Bebu (be)" />
                          <option value="Cay Bardagi" />
                        </datalist>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(index)}
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors mt-0.5"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Calories"
                          value={ing.calories || ''}
                          onChange={(e) => handleIngredientChange(index, 'calories', parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        />
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 ml-1">Calories</div>
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Protein (g)"
                          value={ing.protein || ''}
                          onChange={(e) => handleIngredientChange(index, 'protein', parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        />
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 ml-1">Protein (g)</div>
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Fat (g)"
                          value={ing.fat || ''}
                          onChange={(e) => handleIngredientChange(index, 'fat', parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        />
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 ml-1">Fat (g)</div>
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Carbs (g)"
                          value={ing.carbs || ''}
                          onChange={(e) => handleIngredientChange(index, 'carbs', parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        />
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 ml-1">Carbs (g)</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-stone-600 dark:text-stone-400 font-medium hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {editingMeal && editingMeal.id ? 'Save Changes' : 'Add Meal'}
          </button>
        </div>
      </div>
    </div>
  );
}
