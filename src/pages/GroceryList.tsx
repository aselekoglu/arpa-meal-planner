import { useState, useEffect, useMemo } from 'react';
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
import { Link } from 'react-router-dom';
import { Meal, PlannerItem, PantryItem } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiFetch } from '../lib/api';
import AiProviderSelector from '../components/AiProviderSelector';
import { AiProviderId, defaultModelForProvider, loadAiSettings, saveAiSettings } from '../lib/ai-settings';
import {
  APPROVED_MEASURE_LABELS,
  convertAmount,
  formatHumanFriendlyAmount,
  normalizeIngredientName,
} from '../lib/units';

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

interface MergeSuggestionGroup {
  id: string;
  names: string[];
}

interface AggregationBucket {
  key: string;
  name: string;
  normalizedName: string;
  measure: string;
  amount: number;
  category?: string;
  isCanonical: boolean;
}

function normalizeComparableName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }

  return prev[b.length];
}

function areNamesSimilar(a: string, b: string): boolean {
  const left = normalizeComparableName(a);
  const right = normalizeComparableName(b);
  if (!left || !right) return false;
  if (left === right) return true;

  if (left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left))) {
    return true;
  }

  if ((left.endsWith('s') && left.slice(0, -1) === right) || (right.endsWith('s') && right.slice(0, -1) === left)) {
    return true;
  }

  const maxLen = Math.max(left.length, right.length);
  if (maxLen < 5) return false;
  const similarity = 1 - levenshteinDistance(left, right) / maxLen;
  return similarity >= 0.82;
}

function buildMergeSuggestionGroups(names: string[]): MergeSuggestionGroup[] {
  const uniqueNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
  if (uniqueNames.length < 2) return [];

  const parent = uniqueNames.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  for (let i = 0; i < uniqueNames.length; i += 1) {
    for (let j = i + 1; j < uniqueNames.length; j += 1) {
      if (areNamesSimilar(uniqueNames[i], uniqueNames[j])) {
        union(i, j);
      }
    }
  }

  const grouped = new Map<number, string[]>();
  uniqueNames.forEach((name, index) => {
    const root = find(index);
    const current = grouped.get(root) ?? [];
    current.push(name);
    grouped.set(root, current);
  });

  return Array.from(grouped.values())
    .filter((group) => group.length > 1)
    .map((group) => group.sort((a, b) => a.localeCompare(b)))
    .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))
    .map((group, index) => ({
      id: `group-${index}-${group[0].toLowerCase()}`,
      names: group,
    }));
}

function formatAmountLabel(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(2).replace(/\.?0+$/, '');
}

function normalizeUnitToken(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isVagueUnit(unit: string): boolean {
  const token = normalizeUnitToken(unit);
  return token === 'be' || token === 'bebu' || token === 'bebu (be)' || token === 'pinch' || token === 'pinches';
}

function formatMeasureLabel(amount: number, measure: string): string {
  if (measure !== 'Unit') return measure;
  return Math.abs(amount) === 1 ? 'Unit' : 'Units';
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
  const [showSmartGroupPopup, setShowSmartGroupPopup] = useState(false);
  const [showMergePopup, setShowMergePopup] = useState(false);
  const [selectedMergeNames, setSelectedMergeNames] = useState<string[]>([]);
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [manualMergeSearch, setManualMergeSearch] = useState('');
  const [mergeFeedback, setMergeFeedback] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [provider, setProvider] = useState<AiProviderId>(() => loadAiSettings().provider);
  const [model, setModel] = useState(() => loadAiSettings().model);

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
  const ingredientNameSuggestions = Array.from(
    new Map(
      [
        ...meals.flatMap((meal) => meal.ingredients.map((ingredient) => ingredient.name?.trim() || '')),
        ...pantryItems.map((item) => item.name?.trim() || ''),
      ]
        .filter(Boolean)
        .map((name) => [name.toLowerCase(), name] as const),
    ).values(),
  ).sort((a, b) => a.localeCompare(b));

  const toCanonical = (amount: number, measure: string, ingredientName: string) => {
    const asMl = convertAmount(amount, measure, 'ml', ingredientName);
    if (asMl !== null) return { amount: asMl, measure: 'ml' };

    const asG = convertAmount(amount, measure, 'g', ingredientName);
    if (asG !== null) return { amount: asG, measure: 'g' };

    const asUnit = convertAmount(amount, measure, 'unit', ingredientName);
    if (asUnit !== null) return { amount: asUnit, measure: 'unit' };

    return null;
  };

  const aggregateBuckets = (
    items: Array<{ name: string; amount: number; measure: string; category?: string }>,
  ) => {
    const bucketMap = new Map<string, AggregationBucket>();

    items.forEach((entry) => {
      const normalizedName = normalizeIngredientName(entry.name);
      const canonical = toCanonical(entry.amount, entry.measure, entry.name);
      const key = canonical
        ? `${normalizedName}::canonical::${canonical.measure}`
        : `${normalizedName}::raw::${entry.measure.trim().toLowerCase()}`;

      const existing = bucketMap.get(key);
      if (existing) {
        existing.amount += canonical ? canonical.amount : entry.amount;
        return;
      }

      bucketMap.set(key, {
        key,
        name: entry.name,
        normalizedName,
        amount: canonical ? canonical.amount : entry.amount,
        measure: canonical ? canonical.measure : entry.measure,
        category: entry.category,
        isCanonical: Boolean(canonical),
      });
    });

    return bucketMap;
  };

  const plannedIngredients = weekPlannerItems.flatMap((item) => {
    const meal = meals.find((m) => m.id === item.meal_id);
    if (!meal) return [];
    return meal.ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount,
      measure: ing.measure,
      category: categories[ing.name] || 'Uncategorized',
    }));
  });

  const requiredBuckets = aggregateBuckets(plannedIngredients);
  const pantryBuckets = aggregateBuckets(
    pantryItems.map((item) => ({
      name: item.name,
      amount: item.amount,
      measure: item.measure,
      category: undefined,
    })),
  );

  const computedBuckets = Array.from(requiredBuckets.values())
    .map((bucket) => {
      const pantryBucket = pantryBuckets.get(bucket.key);
      const neededAmount = bucket.amount - (pantryBucket?.amount ?? 0);
      if (neededAmount <= 0) return null;

      const display = bucket.isCanonical
        ? formatHumanFriendlyAmount(neededAmount, bucket.measure)
        : { amount: neededAmount, measure: bucket.measure };

      return {
        key: bucket.key,
        normalizedName: bucket.normalizedName,
        name: bucket.name,
        amount: display.amount,
        measure: display.measure,
        checked: checkedItems[bucket.key] || false,
        category: bucket.category || 'Uncategorized',
        vagueUnit: isVagueUnit(display.measure),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  const namesWithConcreteUnits = new Set(
    computedBuckets.filter((bucket) => !bucket.vagueUnit).map((bucket) => bucket.normalizedName),
  );

  const groceryList = computedBuckets.reduce((acc: Record<string, GroceryItem>, bucket) => {
    if (bucket.vagueUnit && namesWithConcreteUnits.has(bucket.normalizedName)) {
      return acc;
    }

    acc[bucket.key] = {
      name: bucket.name,
      amount: bucket.amount,
      measure: bucket.measure,
      checked: bucket.checked,
      category: bucket.category,
    };
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

  const mergeSuggestionGroups = useMemo(
    () => buildMergeSuggestionGroups(Object.values(groceryList).map((item) => item.name)),
    [groceryList],
  );

  const manualMergeCandidates = useMemo(() => {
    const allNames = Array.from(new Set(Object.values(groceryList).map((item) => item.name))).sort((a, b) =>
      a.localeCompare(b),
    );
    const query = manualMergeSearch.trim().toLowerCase();
    return allNames
      .filter((name) => !selectedMergeNames.includes(name))
      .filter((name) => (query ? name.toLowerCase().includes(query) : true))
      .slice(0, 12);
  }, [groceryList, selectedMergeNames, manualMergeSearch]);

  const toggleMergeName = (name: string) => {
    setMergeFeedback(null);
    setMergeError(null);
    setSelectedMergeNames((prev) => {
      const exists = prev.includes(name);
      if (exists) {
        const next = prev.filter((item) => item !== name);
        if (mergeTargetName === name) {
          setMergeTargetName(next[0] ?? '');
        }
        return next;
      }
      const next = [...prev, name];
      if (!mergeTargetName) {
        setMergeTargetName(name);
      }
      return next;
    });
  };

  const selectSuggestedGroup = (names: string[]) => {
    setMergeFeedback(null);
    setMergeError(null);
    setSelectedMergeNames((prev) => {
      const merged = Array.from(new Set([...prev, ...names]));
      if (!mergeTargetName && merged.length > 0) {
        setMergeTargetName(merged[0]);
      }
      return merged;
    });
  };

  const addManualMergeName = (name: string) => {
    if (!name.trim()) return;
    setMergeFeedback(null);
    setMergeError(null);
    setSelectedMergeNames((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      if (!mergeTargetName) {
        setMergeTargetName(name);
      }
      return next;
    });
  };

  const handleApplyMerge = async () => {
    setMergeError(null);
    setMergeFeedback(null);

    if (selectedMergeNames.length < 2) {
      setMergeError('Select at least 2 names to merge.');
      return;
    }
    if (!mergeTargetName || !selectedMergeNames.includes(mergeTargetName)) {
      setMergeError('Select a valid target name from the selected items.');
      return;
    }

    const shouldMerge = confirm(
      `Merge ${selectedMergeNames.length} names into "${mergeTargetName}"? This updates meal ingredients and pantry names.`,
    );
    if (!shouldMerge) return;

    setIsMerging(true);
    try {
      const res = await apiFetch('/api/ingredients/merge-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceNames: selectedMergeNames,
          targetName: mergeTargetName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            'Merge endpoint is unavailable (404). Restart the dev server so the latest backend routes load.',
          );
        }
        throw new Error((data as { error?: string }).error || 'Failed to merge names');
      }

      await Promise.all([fetchMeals(), fetchPlanner(), fetchPantry()]);

      setMergeFeedback(`Merged ${selectedMergeNames.length} names into "${mergeTargetName}".`);
      setSelectedMergeNames([]);
      setMergeTargetName('');
      setShowMergePopup(false);
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Failed to merge names');
    } finally {
      setIsMerging(false);
    }
  };

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
      setShowSmartGroupPopup(false);

      const res = await apiFetch('/api/ai/grocery-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToGroup,
          provider,
          model: model.trim() || undefined,
        }),
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

  const handleProviderChange = (next: AiProviderId) => {
    const nextSettings = {
      provider: next,
      model: model.trim() ? model : defaultModelForProvider(next),
    };
    setProvider(nextSettings.provider);
    setModel(nextSettings.model);
    saveAiSettings(nextSettings);
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    saveAiSettings({ provider, model: next });
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
      `${formatAmountLabel(item.amount)} ${formatMeasureLabel(item.amount, item.measure)}`,
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
        <Link
          to={activeTab === 'list' ? '/pantry' : '/grocery'}
          className="md:ml-auto self-start md:self-center text-sm font-display font-bold underline underline-offset-4 hover:text-white transition-colors"
        >
          {activeTab === 'list' ? 'Adjust Pantry' : 'View Grocery'}
        </Link>
      </section>

      {activeTab === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <section className="lg:col-span-2 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl font-display font-extrabold tracking-tight text-on-surface dark:text-stone-100">
                Grocery List
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
                    <div className="relative">
                      <button
                        onClick={() => setShowMergePopup((prev) => !prev)}
                        className="px-4 py-2 bg-surface-container-high dark:bg-stone-800 rounded-full text-xs font-display font-bold text-on-surface-variant inline-flex items-center gap-2 hover:bg-surface-container-highest transition-colors"
                      >
                        Merge Similar Items
                      </button>
                      {showMergePopup && (
                        <div className="absolute right-0 mt-2 z-20 w-[360px] max-w-[90vw] rounded-2xl border border-outline-variant/20 bg-surface-container-low dark:bg-stone-900 p-3 shadow-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-display font-bold text-on-surface dark:text-stone-100">
                              Merge Similar Names
                            </h4>
                            <button
                              onClick={() => setShowMergePopup(false)}
                              className="text-xs font-display font-semibold text-on-surface-variant hover:underline"
                            >
                              Close
                            </button>
                          </div>
                          {mergeSuggestionGroups.length === 0 ? (
                            <p className="text-xs text-on-surface-variant">
                              No close matches found in this week&apos;s grocery names.
                            </p>
                          ) : (
                            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                              {mergeSuggestionGroups.map((group) => (
                                <div
                                  key={group.id}
                                  className="rounded-xl border border-outline-variant/15 p-2 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-display font-bold uppercase tracking-wider text-on-surface-variant">
                                      Suggested Group
                                    </span>
                                    <button
                                      onClick={() => selectSuggestedGroup(group.names)}
                                      className="text-xs font-display font-semibold text-primary hover:underline"
                                    >
                                      Select All
                                    </button>
                                  </div>
                                  <div className="space-y-1">
                                    {group.names.map((name) => (
                                      <label
                                        key={name}
                                        className="flex items-center gap-2 text-sm text-on-surface dark:text-stone-100"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedMergeNames.includes(name)}
                                          onChange={() => toggleMergeName(name)}
                                          className="rounded border-outline-variant"
                                        />
                                        <span>{name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="space-y-2 rounded-xl border border-outline-variant/15 p-2">
                            <span className="text-[11px] font-display font-bold uppercase tracking-wider text-on-surface-variant">
                              Add Items Manually
                            </span>
                            <input
                              type="text"
                              value={manualMergeSearch}
                              onChange={(e) => setManualMergeSearch(e.target.value)}
                              placeholder="Search names (e.g. Butter)"
                              className="w-full px-3 py-2 rounded-xl bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 text-sm"
                            />
                            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                              {manualMergeCandidates.length > 0 ? (
                                manualMergeCandidates.map((name) => (
                                  <button
                                    key={name}
                                    onClick={() => addManualMergeName(name)}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-surface-container-high dark:hover:bg-stone-800"
                                  >
                                    + {name}
                                  </button>
                                ))
                              ) : (
                                <p className="text-xs text-on-surface-variant">
                                  No additional matches.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-display font-bold uppercase tracking-wider text-on-surface-variant">
                              Merge Into
                            </label>
                            <select
                              value={mergeTargetName}
                              onChange={(e) => setMergeTargetName(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 text-sm"
                            >
                              <option value="">Select target name</option>
                              {selectedMergeNames.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </div>
                          {mergeError && <p className="text-xs text-error">{mergeError}</p>}
                          {mergeFeedback && <p className="text-xs text-primary">{mergeFeedback}</p>}
                          <button
                            onClick={handleApplyMerge}
                            disabled={isMerging || selectedMergeNames.length < 2 || !mergeTargetName}
                            className="w-full px-3 py-2 rounded-full text-xs font-display font-semibold bg-primary text-on-primary disabled:opacity-50"
                          >
                            {isMerging ? 'Merging...' : 'Apply Merge'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowSmartGroupPopup((prev) => !prev)}
                        className="px-4 py-2 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full text-xs font-display font-bold inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
                      >
                        {isGrouping ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Smart Group
                      </button>
                      {showSmartGroupPopup && (
                        <div className="absolute right-0 mt-2 z-20 w-[320px] max-w-[85vw] rounded-2xl border border-outline-variant/20 bg-surface-container-low dark:bg-stone-900 p-3 shadow-xl">
                          <AiProviderSelector
                            provider={provider}
                            model={model}
                            onProviderChange={handleProviderChange}
                            onModelChange={handleModelChange}
                          />
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              onClick={() => setShowSmartGroupPopup(false)}
                              className="px-3 py-1.5 rounded-full text-xs font-display font-semibold text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-stone-800"
                            >
                              Close
                            </button>
                            <button
                              onClick={smartGroup}
                              disabled={isGrouping || sortedItems.length === 0}
                              className="px-3 py-1.5 rounded-full text-xs font-display font-semibold bg-primary text-on-primary disabled:opacity-50"
                            >
                              Run Grouping
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
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
                              {formatAmountLabel(item.amount)}{' '}
                              {formatMeasureLabel(item.amount, item.measure)}
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
                  list="pantry-item-suggestions"
                />
                <datalist id="pantry-item-suggestions">
                  {ingredientNameSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
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
                      {APPROVED_MEASURE_LABELS.map((unitLabel) => (
                        <option key={unitLabel} value={unitLabel}>
                          {unitLabel}
                        </option>
                      ))}
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
                  list="pantry-item-suggestions-alt"
                />
                <datalist id="pantry-item-suggestions-alt">
                  {ingredientNameSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
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
                      {APPROVED_MEASURE_LABELS.map((unitLabel) => (
                        <option key={unitLabel} value={unitLabel}>
                          {unitLabel}
                        </option>
                      ))}
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
