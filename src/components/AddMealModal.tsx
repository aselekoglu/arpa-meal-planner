import { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Camera,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { Meal, Ingredient } from '../types';
import { apiFetch } from '../lib/api';

interface AddMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingMeal?: Meal | Partial<Meal> | null;
}

export default function AddMealModal({
  isOpen,
  onClose,
  onSave,
  editingMeal,
}: AddMealModalProps) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [instructions, setInstructions] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ingredients, setIngredients] = useState<Partial<Ingredient>[]>([
    { name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 },
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
      setIngredients(
        editingMeal.ingredients && editingMeal.ingredients.length > 0
          ? editingMeal.ingredients
          : [{ name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 }],
      );
    } else {
      setName('');
      setTag('');
      setInstructions([]);
      setSourceUrl('');
      setImageUrl('');
      setIngredients([
        { name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 },
      ]);
    }
  }, [editingMeal, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
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
    setIngredients([
      ...ingredients,
      { name: '', amount: 1, measure: 'Unit', calories: 0, protein: 0, fat: 0, carbs: 0 },
    ]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (
    index: number,
    field: keyof Ingredient,
    value: string | number,
  ) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validIngredients = ingredients.filter((i) => i.name && i.name.trim() !== '');

    const mealData = {
      name,
      tag,
      instructions: instructions.filter((step) => step.trim() !== ''),
      source_url: sourceUrl,
      image_url: imageUrl,
      ingredients: validIngredients,
    };

    try {
      const res =
        editingMeal && editingMeal.id
          ? await apiFetch(`/api/meals/${editingMeal.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mealData),
            })
          : await apiFetch('/api/meals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mealData),
            });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((errBody as { error?: string }).error || 'Failed to save meal');
      }
      onSave();
    } catch (error) {
      console.error('Failed to save meal', error);
      alert(error instanceof Error ? error.message : 'Failed to save meal');
    }
  };

  const inputClass =
    'w-full px-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface dark:text-stone-100 placeholder:text-outline';

  const fieldLabel =
    'block text-[11px] font-display font-bold uppercase tracking-widest text-outline mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface dark:bg-stone-900 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-outline-variant/15 dark:border-stone-800">
        <div className="px-6 py-5 flex justify-between items-center sticky top-0 bg-surface dark:bg-stone-900 z-10 border-b border-outline-variant/15 dark:border-stone-800">
          <div>
            <h2 className="text-xl font-display font-extrabold text-primary-container dark:text-primary-fixed-dim tracking-tight">
              {editingMeal && editingMeal.id ? 'Edit Recipe' : 'Add New Recipe'}
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Capture every detail of your dish.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-outline hover:bg-surface-container-high dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto thin-scrollbar">
          <div className="space-y-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={fieldLabel}>Meal Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bebu Koftesi"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={fieldLabel}>Tag</label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="e.g. Mediterranean, Breakfast"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Source URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={fieldLabel}>Meal Image</label>
              <div className="space-y-3">
                {imageUrl ? (
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-outline-variant/30 dark:border-stone-700 bg-surface-container-low dark:bg-stone-800">
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-3 right-3 p-2 bg-secondary text-on-secondary rounded-full hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="aspect-video rounded-2xl border-2 border-dashed border-outline-variant/40 dark:border-stone-700 flex flex-col items-center justify-center bg-surface-container-low dark:bg-stone-800/50 text-outline">
                    {isCameraOpen ? (
                      <div className="relative w-full h-full">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="p-3 bg-primary text-on-primary rounded-full hover:opacity-90 transition-opacity shadow-lg"
                          >
                            <Camera className="w-6 h-6" />
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="p-3 bg-on-surface text-surface rounded-full hover:opacity-90 transition-opacity shadow-lg"
                          >
                            <RotateCcw className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-sm">No image selected</p>
                      </>
                    )}
                  </div>
                )}

                {!isCameraOpen && (
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex flex-col items-center justify-center p-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-2xl hover:bg-surface-container-low dark:hover:bg-stone-700 cursor-pointer transition-colors">
                      <Upload className="w-5 h-5 mb-1 text-primary-container dark:text-primary-fixed-dim" />
                      <span className="text-xs font-display font-semibold">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex flex-col items-center justify-center p-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-2xl hover:bg-surface-container-low dark:hover:bg-stone-700 transition-colors"
                    >
                      <Camera className="w-5 h-5 mb-1 text-primary-container dark:text-primary-fixed-dim" />
                      <span className="text-xs font-display font-semibold">Camera</span>
                    </button>
                    <div className="relative group">
                      <div className="flex flex-col items-center justify-center p-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-2xl hover:bg-surface-container-low dark:hover:bg-stone-700 transition-colors">
                        <LinkIcon className="w-5 h-5 mb-1 text-primary-container dark:text-primary-fixed-dim" />
                        <span className="text-xs font-display font-semibold">URL</span>
                      </div>
                      <input
                        type="url"
                        placeholder="Paste image URL..."
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="absolute inset-0 opacity-0 focus:opacity-100 w-full h-full px-3 py-2 border border-primary rounded-2xl bg-surface-container-lowest dark:bg-stone-800 text-xs transition-opacity"
                      />
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className={fieldLabel + ' mb-0'}>Instructions</label>
                <button
                  type="button"
                  onClick={() => setInstructions([...instructions, ''])}
                  className="text-xs font-display font-bold text-primary-container dark:text-primary-fixed-dim hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Step
                </button>
              </div>

              <div className="space-y-3">
                {instructions.map((step, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary-container/10 text-primary-container dark:bg-primary-fixed-dim/15 dark:text-primary-fixed-dim flex items-center justify-center font-display font-bold text-sm mt-1">
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
                      className={`${inputClass} resize-y`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setInstructions(instructions.filter((_, i) => i !== index))
                      }
                      className="p-2 text-outline hover:text-secondary hover:bg-secondary/10 rounded-full transition-colors mt-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {instructions.length === 0 && (
                  <div className="text-sm text-on-surface-variant italic text-center py-5 bg-surface-container-low dark:bg-stone-800/50 rounded-2xl border border-dashed border-outline-variant/40">
                    No instructions added yet. Click "Add Step" to begin.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className={fieldLabel + ' mb-0'}>Ingredients</label>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="text-xs font-display font-bold text-primary-container dark:text-primary-fixed-dim hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Ingredient
                </button>
              </div>

              <div className="space-y-3">
                {ingredients.map((ing, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-3 p-4 bg-surface-container-low dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-2xl"
                  >
                    <div className="flex flex-wrap gap-2 items-start">
                      <input
                        type="text"
                        placeholder="Ingredient name"
                        value={ing.name || ''}
                        onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                        className={`${inputClass} flex-1 min-w-[160px]`}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount"
                        value={ing.amount || ''}
                        onChange={(e) =>
                          handleIngredientChange(index, 'amount', parseFloat(e.target.value))
                        }
                        className={`${inputClass} w-24`}
                      />
                      <input
                        type="text"
                        placeholder="Measure"
                        value={ing.measure || ''}
                        onChange={(e) =>
                          handleIngredientChange(index, 'measure', e.target.value)
                        }
                        className={`${inputClass} w-32`}
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
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(index)}
                        className="p-2.5 text-outline hover:text-secondary hover:bg-secondary/10 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <NutrientInput
                        placeholder="Calories"
                        label="Calories"
                        value={ing.calories}
                        onChange={(v) => handleIngredientChange(index, 'calories', v)}
                      />
                      <NutrientInput
                        placeholder="Protein (g)"
                        label="Protein"
                        value={ing.protein}
                        onChange={(v) => handleIngredientChange(index, 'protein', v)}
                      />
                      <NutrientInput
                        placeholder="Fat (g)"
                        label="Fat"
                        value={ing.fat}
                        onChange={(v) => handleIngredientChange(index, 'fat', v)}
                      />
                      <NutrientInput
                        placeholder="Carbs (g)"
                        label="Carbs"
                        value={ing.carbs}
                        onChange={(v) => handleIngredientChange(index, 'carbs', v)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 bg-surface-container-low dark:bg-stone-800/40 border-t border-outline-variant/15 dark:border-stone-800 flex justify-end gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-on-surface-variant dark:text-stone-300 font-display font-semibold text-sm rounded-full hover:bg-surface-container-high dark:hover:bg-stone-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {editingMeal && editingMeal.id ? 'Save Changes' : 'Add Meal'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface NutrientInputProps {
  label: string;
  placeholder: string;
  value: number | undefined;
  onChange: (value: number) => void;
}

function NutrientInput({ label, placeholder, value, onChange }: NutrientInputProps) {
  return (
    <div>
      <input
        type="number"
        min="0"
        step="0.1"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full px-3 py-2 text-sm bg-surface-container-lowest dark:bg-stone-900 border border-outline-variant/30 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface dark:text-stone-100"
      />
      <div className="text-[10px] text-outline mt-0.5 ml-1 font-display font-semibold uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
