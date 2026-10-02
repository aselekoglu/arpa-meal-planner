export type UnitDimension = 'mass' | 'volume' | 'count';

type CanonicalUnit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'cay_bardagi'
  | 'tea_glass'
  | 'be'
  | 'unit';

export interface DisplayAmount {
  amount: number;
  measure: string;
}

export const APPROVED_MEASURE_LABELS = [
  'Gram (g)',
  'Kilogram (kg)',
  'Milliliter (ml)',
  'Liter (L)',
  'Teaspoon (tsp)',
  'Tablespoon (Tbsp)',
  'Cup (c)',
  'Cay Bardagi',
  'Tea Glass',
  'Bebu (be)',
  'Unit',
] as const;

const UNIT_ALIASES: Record<string, CanonicalUnit> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  'gram (g)': 'g',

  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  'kilogram (kg)': 'kg',

  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  'milliliter (ml)': 'ml',
  'millilitre (ml)': 'ml',

  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  'liter (l)': 'l',
  'litre (l)': 'l',

  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  'teaspoon (tsp)': 'tsp',

  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  'tablespoon (tbsp)': 'tbsp',

  cup: 'cup',
  cups: 'cup',
  c: 'cup',
  'cup (c)': 'cup',

  'cay bardagi': 'cay_bardagi',
  cay_bardagi: 'cay_bardagi',
  'tea glass': 'tea_glass',
  'tea glass (60ml)': 'tea_glass',
  'tea glass (120ml)': 'tea_glass',
  tea_glass: 'tea_glass',

  be: 'be',
  bebu: 'be',
  'bebu (be)': 'be',

  unit: 'unit',
  units: 'unit',
  piece: 'unit',
  pieces: 'unit',
};

const UNIT_DIMENSIONS: Record<CanonicalUnit, UnitDimension> = {
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  l: 'volume',
  tsp: 'volume',
  tbsp: 'volume',
  cup: 'volume',
  cay_bardagi: 'volume',
  tea_glass: 'volume',
  be: 'count',
  unit: 'count',
};

const MASS_TO_GRAMS: Record<'g' | 'kg', number> = {
  g: 1,
  kg: 1000,
};

const VOLUME_TO_ML: Record<'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | 'cay_bardagi' | 'tea_glass', number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  cay_bardagi: 100,
  tea_glass: 120,
};

// grams per ml
const DENSITY_G_PER_ML: Record<string, number> = {
  sugar: 0.85,
  oil: 0.92,
  'olive oil': 0.91,
  'avocado oil': 0.91,
  'vegetable oil': 0.92,
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeIngredientName(name: string): string {
  return normalizeToken(name);
}

export function normalizeUnit(unit: string): CanonicalUnit | null {
  const normalized = normalizeToken(unit);
  return UNIT_ALIASES[normalized] ?? null;
}

export function getUnitDimension(unitRaw: string): UnitDimension | null {
  const normalized = normalizeUnit(unitRaw);
  if (!normalized) return null;
  return UNIT_DIMENSIONS[normalized] ?? null;
}

export function isApprovedMeasureLabel(value: string): boolean {
  return APPROVED_MEASURE_LABELS.includes(value.trim() as (typeof APPROVED_MEASURE_LABELS)[number]);
}

function massToGrams(amount: number, unit: CanonicalUnit): number | null {
  if (unit !== 'g' && unit !== 'kg') return null;
  return amount * MASS_TO_GRAMS[unit];
}

function volumeToMl(amount: number, unit: CanonicalUnit): number | null {
  if (
    unit !== 'ml' &&
    unit !== 'l' &&
    unit !== 'tsp' &&
    unit !== 'tbsp' &&
    unit !== 'cup' &&
    unit !== 'cay_bardagi' &&
    unit !== 'tea_glass'
  ) {
    return null;
  }
  return amount * VOLUME_TO_ML[unit];
}

function gramsToUnit(grams: number, unit: CanonicalUnit): number | null {
  if (unit !== 'g' && unit !== 'kg') return null;
  return grams / MASS_TO_GRAMS[unit];
}

function mlToUnit(ml: number, unit: CanonicalUnit): number | null {
  if (
    unit !== 'ml' &&
    unit !== 'l' &&
    unit !== 'tsp' &&
    unit !== 'tbsp' &&
    unit !== 'cup' &&
    unit !== 'cay_bardagi' &&
    unit !== 'tea_glass'
  ) {
    return null;
  }
  return ml / VOLUME_TO_ML[unit];
}

export function convertAmount(
  amount: number,
  fromUnitRaw: string,
  toUnitRaw: string,
  ingredientNameRaw: string,
): number | null {
  if (!Number.isFinite(amount)) return null;

  const fromUnit = normalizeUnit(fromUnitRaw);
  const toUnit = normalizeUnit(toUnitRaw);
  if (!fromUnit || !toUnit) return null;
  if (fromUnit === toUnit) return amount;

  const fromDimension = UNIT_DIMENSIONS[fromUnit];
  const toDimension = UNIT_DIMENSIONS[toUnit];

  if (fromDimension === 'count' || toDimension === 'count') return null;

  if (fromDimension === 'mass' && toDimension === 'mass') {
    const grams = massToGrams(amount, fromUnit);
    if (grams === null) return null;
    return gramsToUnit(grams, toUnit);
  }

  if (fromDimension === 'volume' && toDimension === 'volume') {
    const ml = volumeToMl(amount, fromUnit);
    if (ml === null) return null;
    return mlToUnit(ml, toUnit);
  }

  const ingredientName = normalizeIngredientName(ingredientNameRaw);
  const density = DENSITY_G_PER_ML[ingredientName];
  if (!density) return null;

  if (fromDimension === 'mass' && toDimension === 'volume') {
    const grams = massToGrams(amount, fromUnit);
    if (grams === null) return null;
    const ml = grams / density;
    return mlToUnit(ml, toUnit);
  }

  if (fromDimension === 'volume' && toDimension === 'mass') {
    const ml = volumeToMl(amount, fromUnit);
    if (ml === null) return null;
    const grams = ml * density;
    return gramsToUnit(grams, toUnit);
  }

  return null;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatHumanFriendlyAmount(amount: number, unitRaw: string): DisplayAmount {
  const normalizedUnit = normalizeUnit(unitRaw);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  if (normalizedUnit === 'ml' || normalizedUnit === 'l') {
    const asMl = normalizedUnit === 'l' ? safeAmount * 1000 : safeAmount;
    if (Math.abs(asMl) >= 1000) {
      return { amount: roundToTwo(asMl / 1000), measure: 'L' };
    }
    return { amount: roundToTwo(asMl), measure: 'ml' };
  }

  if (normalizedUnit === 'g' || normalizedUnit === 'kg') {
    const asG = normalizedUnit === 'kg' ? safeAmount * 1000 : safeAmount;
    if (Math.abs(asG) >= 1000) {
      return { amount: roundToTwo(asG / 1000), measure: 'kg' };
    }
    return { amount: roundToTwo(asG), measure: 'g' };
  }

  if (normalizedUnit === 'unit' || normalizedUnit === 'be') {
    return { amount: roundToTwo(safeAmount), measure: 'Unit' };
  }

  return { amount: roundToTwo(safeAmount), measure: unitRaw };
}
