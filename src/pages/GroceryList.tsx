import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ShoppingCart, CheckCircle2, Circle, FileDown, Sparkles, Package, Plus, Trash2, Loader2 } from 'lucide-react';
import { Meal, PlannerItem, PantryItem } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiFetch } from '../lib/api';

interface GroceryItem {
  name: string;
  amount: number;
  measure: string;
  checked: boolean;
  category?: string;
}

export default function GroceryList() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [isGrouping, setIsGrouping] = useState(false);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [newPantryName, setNewPantryName] = useState('');
  const [newPantryAmount, setNewPantryAmount] = useState(1);
  const [newPantryMeasure, setNewPantryMeasure] = useState('Unit');
  const [activeTab, setActiveTab] = useState<'list' | 'pantry'>('list');

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

  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const endDate = addDays(startDate, 6);
  
  const weekDates = Array.from({ length: 7 }).map((_, i) => format(addDays(startDate, i), 'yyyy-MM-dd'));
  
  const weekPlannerItems = plannerItems.filter(item => weekDates.includes(item.date));
  
  const groceryList = weekPlannerItems.reduce((acc: Record<string, GroceryItem>, item) => {
    const meal = meals.find(m => m.id === item.meal_id);
    if (meal) {
      meal.ingredients.forEach(ing => {
        // Check if we have this in pantry
        const pantryMatch = pantryItems.find(p => p.name.toLowerCase() === ing.name.toLowerCase() && p.measure === ing.measure);
        let neededAmount = ing.amount;
        
        if (pantryMatch) {
          neededAmount = Math.max(0, ing.amount - pantryMatch.amount);
        }
        
        if (neededAmount <= 0) return; // Skip if we have enough in pantry
        
        const key = `${ing.name}-${ing.measure}`;
        if (acc[key]) {
          acc[key].amount += neededAmount;
        } else {
          acc[key] = {
            name: ing.name,
            amount: neededAmount,
            measure: ing.measure,
            checked: checkedItems[key] || false,
            category: categories[ing.name] || 'Uncategorized'
          };
        }
      });
    }
    return acc;
  }, {});

  const toggleItem = (key: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const sortedItems = Object.entries(groceryList).sort(([keyA, a], [keyB, b]) => {
    if (a.checked === b.checked) {
      if (a.category !== b.category) {
        return (a.category || '').localeCompare(b.category || '');
      }
      return a.name.localeCompare(b.name);
    }
    return a.checked ? 1 : -1;
  });

  const groupedItems = sortedItems.reduce((acc: Record<string, [string, GroceryItem][]>, [key, item]) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push([key, item]);
    return acc;
  }, {});

  const handleAddPantry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPantryName.trim()) return;
    
    try {
      await apiFetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPantryName, amount: newPantryAmount, measure: newPantryMeasure })
      });
      setNewPantryName('');
      setNewPantryAmount(1);
      fetchPantry();
    } catch (error) {
      console.error('Failed to add to pantry', error);
    }
  };

  const handleRemovePantry = async (id: number) => {
    try {
      await apiFetch(`/api/pantry/${id}`, { method: 'DELETE' });
      fetchPantry();
    } catch (error) {
      console.error('Failed to remove from pantry', error);
    }
  };

  const smartGroup = async () => {
    setIsGrouping(true);
    try {
      const itemsToGroup = Object.values(groceryList).map(i => i.name);
      
      if (itemsToGroup.length === 0) return;

      const res = await apiFetch('/api/ai/grocery-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToGroup }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.categories && typeof data.categories === 'object') {
        setCategories(prev => ({ ...prev, ...data.categories }));
        return;
      }
      throw new Error(data.error || 'Grouping request failed');
    } catch (error: unknown) {
      console.error('Failed to group items', error);
      
      const commonCategories: Record<string, string> = {
        'milk': 'Dairy', 'cheese': 'Dairy', 'yogurt': 'Dairy', 'butter': 'Dairy', 'eggs': 'Dairy',
        'apple': 'Produce', 'banana': 'Produce', 'tomato': 'Produce', 'onion': 'Produce', 'garlic': 'Produce', 'potato': 'Produce', 'carrot': 'Produce', 'lettuce': 'Produce', 'spinach': 'Produce', 'cucumber': 'Produce', 'pepper': 'Produce', 'broccoli': 'Produce',
        'chicken': 'Meat', 'beef': 'Meat', 'pork': 'Meat', 'turkey': 'Meat', 'salmon': 'Meat', 'shrimp': 'Meat',
        'bread': 'Bakery', 'bagel': 'Bakery', 'muffin': 'Bakery',
        'rice': 'Pantry', 'pasta': 'Pantry', 'flour': 'Pantry', 'sugar': 'Pantry', 'oil': 'Pantry', 'salt': 'Pantry', 'beans': 'Pantry', 'lentils': 'Pantry', 'canned': 'Pantry',
        'ice cream': 'Frozen', 'frozen': 'Frozen', 'pizza': 'Frozen'
      };

      const fallbackCategories: Record<string, string> = {};
      Object.values(groceryList).forEach(item => {
        const name = item.name.toLowerCase();
        for (const [key, cat] of Object.entries(commonCategories)) {
          if (name.includes(key)) {
            fallbackCategories[item.name] = cat;
            break;
          }
        }
      });

      if (Object.keys(fallbackCategories).length > 0) {
        setCategories(prev => ({ ...prev, ...fallbackCategories }));
      }

      const errObj = error as { status?: string; error?: { status?: string } };
      if (errObj?.status === 'RESOURCE_EXHAUSTED' || errObj?.error?.status === 'RESOURCE_EXHAUSTED') {
        alert("Bebü Bot is a bit busy right now (rate limit reached). I've applied some basic grouping for you!");
      } else {
        alert("Something went wrong while grouping. I've tried my best to categorize common items.");
      }
    } finally {
      setIsGrouping(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Grocery List', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`For week of ${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`, 14, 30);
    
    const tableData = sortedItems.map(([_, item]) => [
      item.checked ? 'Yes' : 'No',
      item.name,
      `${item.amount} ${item.measure}`
    ]);
    
    autoTable(doc, {
      startY: 40,
      head: [['Got it?', 'Item', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105] }, // emerald-600
      alternateRowStyles: { fillColor: [250, 250, 249] } // stone-50
    });
    
    doc.save(`Grocery-List-${format(startDate, 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Grocery List</h1>
        <div className="flex bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 p-1">
          <button 
            onClick={() => setSelectedDate(addDays(selectedDate, -7))}
            className="px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg transition-colors"
          >
            Previous
          </button>
          <div className="px-4 py-1.5 text-sm font-semibold text-stone-900 dark:text-stone-100 border-x border-stone-100 dark:border-stone-800 flex items-center">
            {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
          </div>
          <button 
            onClick={() => setSelectedDate(addDays(selectedDate, 7))}
            className="px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-stone-200 dark:border-stone-800">
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'list' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
        >
          Grocery List
        </button>
        <button
          onClick={() => setActiveTab('pantry')}
          className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'pantry' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
        >
          Pantry Inventory
        </button>
      </div>

      {activeTab === 'list' ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden">
          <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-xl">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Shopping List</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">Pantry items are automatically excluded</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {sortedItems.length > 0 && (
                <button
                  onClick={smartGroup}
                  disabled={isGrouping}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {isGrouping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span className="hidden sm:inline">Smart Group</span>
                </button>
              )}
              {sortedItems.length > 0 && (
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-medium transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Export PDF</span>
                </button>
              )}
            </div>
          </div>

          {sortedItems.length > 0 ? (
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="pb-2">
                  {category !== 'Uncategorized' && (
                    <div className="px-6 py-3 bg-stone-50/50 dark:bg-stone-800/20 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 sticky top-0 backdrop-blur-sm">
                      {category}
                    </div>
                  )}
                  <ul className="divide-y divide-stone-50 dark:divide-stone-800/50">
                    {items.map(([key, item]) => (
                      <li 
                        key={key} 
                        onClick={() => toggleItem(key)}
                        className={`flex items-center justify-between px-6 py-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer transition-colors ${item.checked ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          {item.checked ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <Circle className="w-6 h-6 text-stone-300 dark:text-stone-600 flex-shrink-0" />
                          )}
                          <span className={`font-medium ${item.checked ? 'text-stone-500 dark:text-stone-600 line-through' : 'text-stone-800 dark:text-stone-200'}`}>
                            {item.name}
                          </span>
                        </div>
                        <div className={`text-sm font-semibold px-3 py-1 rounded-lg ${item.checked ? 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                          {item.amount} {item.measure}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <ShoppingCart className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-1">Your list is empty</h3>
              <p className="text-stone-500 dark:text-stone-400">Add meals to your weekly planner to generate a grocery list.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden">
          <div className="p-6 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-xl">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Pantry Inventory</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">Items here will be subtracted from your grocery list</p>
              </div>
            </div>
            
            <form onSubmit={handleAddPantry} className="flex gap-3">
              <input
                type="text"
                placeholder="Item name (e.g. Rice)"
                value={newPantryName}
                onChange={(e) => setNewPantryName(e.target.value)}
                className="flex-1 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={newPantryAmount}
                onChange={(e) => setNewPantryAmount(parseFloat(e.target.value))}
                className="w-24 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              />
              <select
                value={newPantryMeasure}
                onChange={(e) => setNewPantryMeasure(e.target.value)}
                className="w-32 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              >
                <option value="Gram (g)">Gram (g)</option>
                <option value="Unit">Unit</option>
                <option value="Cup (c)">Cup (c)</option>
                <option value="Tablespoon (Tbsp)">Tablespoon (Tbsp)</option>
                <option value="Teaspoon (tsp)">Teaspoon (tsp)</option>
                <option value="Bebu (be)">Bebu (be)</option>
                <option value="Cay Bardagi">Cay Bardagi</option>
              </select>
              <button
                type="submit"
                disabled={!newPantryName.trim()}
                className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" /> Add
              </button>
            </form>
          </div>

          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {pantryItems.map(item => (
              <li key={item.id} className="flex items-center justify-between p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                <span className="font-medium text-stone-800 dark:text-stone-200">{item.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                    {item.amount} {item.measure}
                  </span>
                  <button
                    onClick={() => handleRemovePantry(item.id)}
                    className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
            {pantryItems.length === 0 && (
              <li className="p-12 text-center text-stone-500 dark:text-stone-400">
                Your pantry is empty. Add items above to exclude them from your grocery list.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
