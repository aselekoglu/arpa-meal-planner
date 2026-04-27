import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import {
  ShoppingCart,
  CheckCircle2,
  Circle,
  FileDown,
  Sparkles,
  Package,
  Plus,
  Trash2,
  Loader2,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowDownUp,
} from 'lucide-react';
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

interface GroceryListProps {
  initialTab?: 'list' | 'pantry';
}

export default function GroceryList({ initialTab = 'list' }: GroceryListProps) {
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
  const [activeTab, setActiveTab] = useState<'list' | 'pantry'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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

  const weekDates = Array.from({ length: 7 }).map((_, i) =>
    format(addDays(startDate, i), 'yyyy-MM-dd'),
  );

  const weekPlannerItems = plannerItems.filter((item) => weekDates.includes(item.date));

  const groceryList = weekPlannerItems.reduce((acc: Record<string, GroceryItem>, item) => {
    const meal = meals.find((m) => m.id === item.meal_id);
    if (meal) {
      meal.ingredients.forEach((ing) => {
        const pantryMatch = pantryItems.find(
          (p) =>
            p.name.toLowerCase() === ing.name.toLowerCase() && p.measure === ing.measure,
        );
        let neededAmount = ing.amount;

        if (pantryMatch) {
          neededAmount = Math.max(0, ing.amount - pantryMatch.amount);
        }

        if (neededAmount <= 0) return;

        const key = `${ing.name}-${ing.measure}`;
        if (acc[key]) {
          acc[key].amount += neededAmount;
        } else {
          acc[key] = {
            name: ing.name,
            amount: neededAmount,
            measure: ing.measure,
            checked: checkedItems[key] || false,
            category: categories[ing.name] || 'Uncategorized',
          };
        }
      });
    }
    return acc;
  }, {});

  const toggleItem = (key: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const sortedItems = Object.entries(groceryList).sort(([, a], [, b]) => {
    if (a.checked === b.checked) {
      if (a.category !== b.category) {
        return (a.category || '').localeCompare(b.category || '');
      }
      return a.name.localeCompare(b.name);
    }
    return a.checked ? 1 : -1;
  });

  const groupedItems = sortedItems.reduce(
    (acc: Record<string, [string, GroceryItem][]>, [key, item]) => {
      const cat = item.category || 'Uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push([key, item]);
      return acc;
    },
    {},
  );

  const handleAddPantry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPantryName.trim()) return;

    try {
      await apiFetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPantryName,
          amount: newPantryAmount,
          measure: newPantryMeasure,
        }),
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
      const itemsToGroup = Object.values(groceryList).map((i) => i.name);

      if (itemsToGroup.length === 0) return;

      const res = await apiFetch('/api/ai/grocery-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToGroup }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.categories && typeof data.categories === 'object') {
        setCategories((prev) => ({ ...prev, ...data.categories }));
        return;
      }
      throw new Error(data.error || 'Grouping request failed');
    } catch (error: unknown) {
      console.error('Failed to group items', error);

      const commonCategories: Record<string, string> = {
        milk: 'Dairy & Cold',
        cheese: 'Dairy & Cold',
        yogurt: 'Dairy & Cold',
        butter: 'Dairy & Cold',
        eggs: 'Dairy & Cold',
        apple: 'Fresh Produce',
        banana: 'Fresh Produce',
        tomato: 'Fresh Produce',
        onion: 'Fresh Produce',
        garlic: 'Fresh Produce',
        potato: 'Fresh Produce',
        carrot: 'Fresh Produce',
        lettuce: 'Fresh Produce',
        spinach: 'Fresh Produce',
        cucumber: 'Fresh Produce',
        pepper: 'Fresh Produce',
        broccoli: 'Fresh Produce',
        chicken: 'Meat & Seafood',
        beef: 'Meat & Seafood',
        pork: 'Meat & Seafood',
        turkey: 'Meat & Seafood',
        salmon: 'Meat & Seafood',
        shrimp: 'Meat & Seafood',
        bread: 'Bakery',
        bagel: 'Bakery',
        muffin: 'Bakery',
        rice: 'Pantry',
        pasta: 'Pantry',
        flour: 'Pantry',
        sugar: 'Pantry',
        oil: 'Pantry',
        salt: 'Pantry',
        beans: 'Pantry',
        lentils: 'Pantry',
        canned: 'Pantry',
        'ice cream': 'Frozen',
        frozen: 'Frozen',
        pizza: 'Frozen',
      };

      const fallbackCategories: Record<string, string> = {};
      Object.values(groceryList).forEach((item) => {
        const name = item.name.toLowerCase();
        for (const [key, cat] of Object.entries(commonCategories)) {
          if (name.includes(key)) {
            fallbackCategories[item.name] = cat;
            break;
          }
        }
      });

      if (Object.keys(fallbackCategories).length > 0) {
        setCategories((prev) => ({ ...prev, ...fallbackCategories }));
      }

      const errObj = error as { status?: string; error?: { status?: string } };
      if (
        errObj?.status === 'RESOURCE_EXHAUSTED' ||
        errObj?.error?.status === 'RESOURCE_EXHAUSTED'
      ) {
        alert(
          "Bebü Bot is a bit busy right now (rate limit reached). I've applied some basic grouping for you!",
        );
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
    doc.text(
      `For week of ${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`,
      14,
      30,
    );

    const tableData = sortedItems.map(([, item]) => [
      item.checked ? 'Yes' : 'No',
      item.name,
      `${item.amount} ${item.measure}`,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Got it?', 'Item', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [6, 95, 70] },
      alternateRowStyles: { fillColor: [248, 243, 236] },
    });

    doc.save(`Grocery-List-${format(startDate, 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-primary-container dark:text-primary-fixed-dim">
            {activeTab === 'list' ? 'Grocery List' : 'Pantry Inventory'}
          </h1>
          <p className="text-on-surface-variant dark:text-stone-400 mt-1 font-medium">
            {activeTab === 'list'
              ? 'Pantry items are excluded automatically.'
              : 'Track stock to keep your grocery list accurate.'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low dark:bg-stone-900 rounded-full p-1.5">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -7))}
            className="p-2 rounded-full hover:bg-surface-container-lowest dark:hover:bg-stone-800 transition-colors active:scale-90"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
          </button>
          <div className="px-3 text-sm font-display font-semibold text-on-surface dark:text-stone-100 whitespace-nowrap">
            {format(startDate, 'MMM d')} – {format(endDate, 'MMM d')}
          </div>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 7))}
            className="p-2 rounded-full hover:bg-surface-container-lowest dark:hover:bg-stone-800 transition-colors active:scale-90"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex bg-surface-container-low dark:bg-stone-900 rounded-full p-1.5 gap-1">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 font-display font-semibold text-sm rounded-full transition-all ${
            activeTab === 'list'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Grocery List
        </button>
        <button
          onClick={() => setActiveTab('pantry')}
          className={`px-4 py-2 font-display font-semibold text-sm rounded-full transition-all ${
            activeTab === 'pantry'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Pantry Inventory
        </button>
      </div>

      {/* Pantry Sync banner */}
      <section className="bg-primary-container text-on-primary-container p-5 lg:p-6 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-4 shadow-sm border-l-8 border-primary">
        <div className="bg-white/10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
          <Info className="w-6 h-6" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="font-display font-bold text-lg leading-tight">Pantry Sync Active</h3>
          <p className="text-on-primary-container/80 text-sm font-medium">
            Pantry items are excluded from grocery calculations for a cleaner shopping experience.
          </p>
        </div>
        <button
          onClick={() => setActiveTab(activeTab === 'list' ? 'pantry' : 'list')}
          className="md:ml-auto self-start md:self-center text-sm font-display font-bold underline underline-offset-4 hover:text-white transition-colors"
        >
          {activeTab === 'list' ? 'Adjust Pantry' : 'View Grocery'}
        </button>
      </section>

      {activeTab === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <section className="lg:col-span-2 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl font-display font-extrabold tracking-tight text-on-surface dark:text-stone-100">
                Items in Stock
              </h2>
              <div className="flex flex-wrap gap-2">
                {sortedItems.length > 0 && (
                  <>
                    <button className="px-4 py-2 bg-surface-container-high dark:bg-stone-800 rounded-full text-xs font-display font-bold text-on-surface-variant inline-flex items-center gap-2 hover:bg-surface-container-highest transition-colors">
                      <Filter className="w-3.5 h-3.5" />
                      All Categories
                    </button>
                    <button className="px-4 py-2 bg-surface-container-high dark:bg-stone-800 rounded-full text-xs font-display font-bold text-on-surface-variant inline-flex items-center gap-2 hover:bg-surface-container-highest transition-colors">
                      <ArrowDownUp className="w-3.5 h-3.5" />
                      Sort
                    </button>
                    <button
                      onClick={smartGroup}
                      disabled={isGrouping}
                      className="px-4 py-2 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full text-xs font-display font-bold inline-flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isGrouping ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      Smart Group
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="px-4 py-2 bg-surface-container-high dark:bg-stone-800 rounded-full text-xs font-display font-bold text-on-surface-variant inline-flex items-center gap-2 hover:bg-surface-container-highest transition-colors"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Export PDF
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-surface-container-lowest dark:bg-stone-900 rounded-[2rem] overflow-hidden border border-outline-variant/15 dark:border-stone-800">
              {sortedItems.length > 0 ? (
                <div className="divide-y divide-surface-container-high dark:divide-stone-800">
                  {Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category}>
                      {category !== 'Uncategorized' && (
                        <div className="px-6 lg:px-8 py-3 bg-surface-container-low/60 dark:bg-stone-800/40 text-[10px] font-display font-bold uppercase tracking-widest text-on-surface-variant">
                          {category}
                        </div>
                      )}
                      <ul>
                        {items.map(([key, item]) => (
                          <li
                            key={key}
                            onClick={() => toggleItem(key)}
                            className={`flex items-center justify-between px-6 lg:px-8 py-4 hover:bg-surface-container-low dark:hover:bg-stone-800/40 cursor-pointer transition-colors ${
                              item.checked ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {item.checked ? (
                                <CheckCircle2 className="w-6 h-6 text-primary-container flex-shrink-0" />
                              ) : (
                                <Circle className="w-6 h-6 text-outline-variant flex-shrink-0" />
                              )}
                              <span
                                className={`font-display font-bold ${
                                  item.checked
                                    ? 'text-outline line-through'
                                    : 'text-on-surface dark:text-stone-100'
                                }`}
                              >
                                {item.name}
                              </span>
                            </div>
                            <div
                              className={`text-sm font-display font-semibold px-3 py-1.5 rounded-full ${
                                item.checked
                                  ? 'bg-surface-container-high text-outline'
                                  : 'bg-primary-container/10 text-primary-container dark:bg-primary-fixed-dim/10 dark:text-primary-fixed-dim'
                              }`}
                            >
                              {item.amount} {item.measure}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-14 text-center">
                  <ShoppingCart className="w-12 h-12 text-outline-variant mx-auto mb-4" />
                  <h3 className="text-lg font-display font-bold text-on-surface dark:text-stone-100">
                    Your list is empty
                  </h3>
                  <p className="text-on-surface-variant dark:text-stone-400 mt-1">
                    Add meals to your weekly planner to generate a grocery list.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-surface-container-low dark:bg-stone-900 rounded-[2rem] p-6 lg:p-7">
              <h3 className="font-display text-lg font-bold text-primary-container dark:text-primary-fixed-dim mb-2">
                Add to Pantry
              </h3>
              <p className="text-xs text-on-surface-variant mb-4">
                Quickly register new stock items.
              </p>
              <form onSubmit={handleAddPantry} className="space-y-3">
                <FieldLabel>Item Name</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g. Avocado Oil"
                  value={newPantryName}
                  onChange={(e) => setNewPantryName(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Quantity</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={newPantryAmount}
                      onChange={(e) => setNewPantryAmount(parseFloat(e.target.value))}
                      className="w-full px-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <FieldLabel>Unit</FieldLabel>
                    <select
                      value={newPantryMeasure}
                      onChange={(e) => setNewPantryMeasure(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="Gram (g)">Gram (g)</option>
                      <option value="Unit">Unit</option>
                      <option value="Cup (c)">Cup (c)</option>
                      <option value="Tablespoon (Tbsp)">Tablespoon (Tbsp)</option>
                      <option value="Teaspoon (tsp)">Teaspoon (tsp)</option>
                      <option value="Bebu (be)">Bebu (be)</option>
                      <option value="Cay Bardagi">Cay Bardagi</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!newPantryName.trim()}
                  className="w-full px-5 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm rounded-full disabled:opacity-50 inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Item to Stock
                </button>
              </form>
            </div>

            <div className="bg-secondary-fixed text-on-secondary-fixed p-6 rounded-[2rem]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-display font-bold uppercase tracking-widest">
                  Quick Inventory Tip
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed">
                Keeping your pantry updated helps ARPA suggest better recipes based on what you already have, reducing food waste and grocery spend.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-container/10 text-primary-container dark:bg-primary-fixed-dim/10 dark:text-primary-fixed-dim rounded-xl">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-extrabold tracking-tight text-on-surface dark:text-stone-100">
                  Items in Stock
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Items here are subtracted from your grocery list.
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest dark:bg-stone-900 rounded-[2rem] overflow-hidden border border-outline-variant/15 dark:border-stone-800">
              {pantryItems.length === 0 ? (
                <div className="p-14 text-center">
                  <Package className="w-12 h-12 text-outline-variant mx-auto mb-4" />
                  <h3 className="text-lg font-display font-bold text-on-surface dark:text-stone-100">
                    Your pantry is empty
                  </h3>
                  <p className="text-on-surface-variant mt-1">
                    Add items in the side panel to keep your grocery list accurate.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-surface-container-high dark:divide-stone-800">
                  {pantryItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between px-6 lg:px-8 py-4 hover:bg-surface-container-low dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-high dark:bg-stone-800 flex items-center justify-center text-primary-container">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-display font-bold text-on-surface dark:text-stone-100">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-outline uppercase tracking-widest font-display font-semibold">
                            Pantry Item
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-display font-semibold px-3 py-1.5 rounded-full bg-primary-container/10 text-primary-container dark:bg-primary-fixed-dim/10 dark:text-primary-fixed-dim">
                          {item.amount} {item.measure}
                        </span>
                        <button
                          onClick={() => handleRemovePantry(item.id)}
                          className="p-2 text-outline hover:text-secondary hover:bg-secondary/10 rounded-full transition-colors"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-surface-container-low dark:bg-stone-900 rounded-[2rem] p-6 lg:p-7">
              <h3 className="font-display text-lg font-bold text-primary-container dark:text-primary-fixed-dim mb-2">
                Add to Pantry
              </h3>
              <p className="text-xs text-on-surface-variant mb-4">
                Quickly register new stock items.
              </p>
              <form onSubmit={handleAddPantry} className="space-y-3">
                <FieldLabel>Item Name</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g. Avocado Oil"
                  value={newPantryName}
                  onChange={(e) => setNewPantryName(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Quantity</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={newPantryAmount}
                      onChange={(e) => setNewPantryAmount(parseFloat(e.target.value))}
                      className="w-full px-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <FieldLabel>Unit</FieldLabel>
                    <select
                      value={newPantryMeasure}
                      onChange={(e) => setNewPantryMeasure(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="Gram (g)">Gram (g)</option>
                      <option value="Unit">Unit</option>
                      <option value="Cup (c)">Cup (c)</option>
                      <option value="Tablespoon (Tbsp)">Tablespoon (Tbsp)</option>
                      <option value="Teaspoon (tsp)">Teaspoon (tsp)</option>
                      <option value="Bebu (be)">Bebu (be)</option>
                      <option value="Cay Bardagi">Cay Bardagi</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!newPantryName.trim()}
                  className="w-full px-5 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-display font-semibold text-sm rounded-full disabled:opacity-50 inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Item to Stock
                </button>
              </form>
            </div>

            <div className="bg-secondary-fixed text-on-secondary-fixed p-6 rounded-[2rem]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-display font-bold uppercase tracking-widest">
                  Quick Inventory Tip
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed">
                Keeping your pantry updated helps ARPA suggest better recipes based on what you already have, reducing food waste and grocery spend.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-display font-bold uppercase tracking-widest text-outline mb-1.5">
      {children}
    </label>
  );
}
