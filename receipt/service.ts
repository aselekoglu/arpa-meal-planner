import db from '../db.js';
import {
  convertAmount,
  isApprovedMeasureLabel,
  normalizeIngredientName,
} from '../src/lib/units.js';
import { findIngredientMatch, normalizeReceiptKey, normalizeStoreKey } from './matcher.js';
import type {
  ReceiptAnalysis,
  ReceiptCandidate,
  ReceiptImportRequest,
  ReceiptImportResult,
} from './types.js';

type PantryRow = {
  id: number;
  name: string;
  amount: number;
  measure: string;
};

function canonicalIngredientNames(familyId: string): string[] {
  const pantry = db
    .prepare('SELECT name FROM pantry WHERE family_id = ?')
    .all(familyId) as Array<{ name: string }>;
  const mealIngredients = db
    .prepare(
      `SELECT DISTINCT i.name
       FROM ingredients i
       JOIN meals m ON m.id = i.meal_id
       WHERE m.family_id = ?`,
    )
    .all(familyId) as Array<{ name: string }>;

  const names = [...pantry, ...mealIngredients]
    .map((row) => row.name.trim())
    .filter(Boolean);

  return Array.from(
    new Map(names.map((name) => [normalizeIngredientName(name), name] as const)).values(),
  );
}

function lookupAlias(
  familyId: string,
  storeKey: string,
  rawKey: string,
): string | null {
  const row = db
    .prepare(
      `SELECT canonical_name
       FROM receipt_item_aliases
       WHERE family_id = ?
         AND raw_key = ?
         AND store_key IN (?, '')
       ORDER BY CASE WHEN store_key = ? THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .get(familyId, rawKey, storeKey, storeKey) as
    | { canonical_name: string }
    | undefined;

  return row?.canonical_name?.trim() || null;
}

export function resolveReceiptAnalysis(
  familyId: string,
  analysis: ReceiptAnalysis,
): ReceiptAnalysis {
  const canonicalNames = canonicalIngredientNames(familyId);
  const storeKey = normalizeStoreKey(analysis.merchant) ?? '';

  const items: ReceiptCandidate[] = analysis.items.map((item) => {
    if (item.status === 'ignored') return item;

    const rawKey = normalizeReceiptKey(item.rawName);
    const alias = rawKey ? lookupAlias(familyId, storeKey, rawKey) : null;
    if (alias) {
      return {
        ...item,
        canonicalName: alias,
        status: 'matched',
        matchSource: 'alias',
        matchScore: 1,
      };
    }

    const seed = item.proposedName || item.canonicalName || item.rawName;
    const match = findIngredientMatch(seed, canonicalNames);
    if (match) {
      return {
        ...item,
        canonicalName: match.canonicalName,
        status: match.source === 'exact' ? 'matched' : 'suggested',
        matchSource: match.source,
        matchScore: match.score,
      };
    }

    if (item.proposedName) {
      return {
        ...item,
        canonicalName: item.proposedName,
        status: 'suggested',
        matchSource: 'ai',
      };
    }

    return {
      ...item,
      canonicalName: undefined,
      status: 'unresolved',
      matchSource: undefined,
      matchScore: undefined,
    };
  });

  return { ...analysis, items };
}

export function importReceipt(
  familyId: string,
  payload: ReceiptImportRequest,
): ReceiptImportResult {
  for (const item of payload.items) {
    if (!isApprovedMeasureLabel(item.measure)) {
      throw new Error(`Unsupported pantry measure: ${item.measure}`);
    }
  }

  const insertReceipt = db.prepare(
    `INSERT INTO receipt_scans
      (family_id, merchant, purchase_date, scanner_engine, raw_text, subtotal, tax, total, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReceiptItem = db.prepare(
    `INSERT INTO receipt_scan_items
      (receipt_scan_id, raw_name, canonical_name, amount, measure, unit_price, total_price, match_source, ignored)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  );
  const insertPantry = db.prepare(
    'INSERT INTO pantry (family_id, name, amount, measure) VALUES (?, ?, ?, ?)',
  );
  const updatePantry = db.prepare(
    'UPDATE pantry SET amount = ? WHERE id = ? AND family_id = ?',
  );
  const upsertAlias = db.prepare(
    `INSERT INTO receipt_item_aliases
      (family_id, store_key, raw_key, canonical_name, usage_count, last_used_at)
     VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
     ON CONFLICT(family_id, store_key, raw_key)
     DO UPDATE SET
       canonical_name = excluded.canonical_name,
       usage_count = receipt_item_aliases.usage_count + 1,
       last_used_at = CURRENT_TIMESTAMP`,
  );

  const run = db.transaction(() => {
    const totals = payload.totals ?? {};
    const receipt = insertReceipt.run(
      familyId,
      payload.merchant ?? null,
      payload.purchaseDate ?? null,
      payload.scannerEngine,
      payload.rawText ?? null,
      totals.subtotal ?? null,
      totals.tax ?? null,
      totals.total ?? null,
      payload.currency ?? null,
    );
    const receiptId = Number(receipt.lastInsertRowid);
    const storeKey = normalizeStoreKey(payload.merchant) ?? '';

    const pantryRows = db
      .prepare('SELECT id, name, amount, measure FROM pantry WHERE family_id = ? ORDER BY id')
      .all(familyId) as PantryRow[];

    let mergedItems = 0;
    let createdItems = 0;
    let rememberedAliases = 0;

    for (const item of payload.items) {
      const normalizedName = normalizeIngredientName(item.canonicalName);
      const compatible = pantryRows.find((row) => {
        if (normalizeIngredientName(row.name) !== normalizedName) return false;
        return convertAmount(item.amount, item.measure, row.measure, item.canonicalName) !== null;
      });

      if (compatible) {
        const converted = convertAmount(
          item.amount,
          item.measure,
          compatible.measure,
          item.canonicalName,
        );
        if (converted === null) {
          throw new Error('Internal unit conversion mismatch');
        }
        compatible.amount += converted;
        updatePantry.run(compatible.amount, compatible.id, familyId);
        mergedItems += 1;
      } else {
        const inserted = insertPantry.run(
          familyId,
          item.canonicalName,
          item.amount,
          item.measure,
        );
        pantryRows.push({
          id: Number(inserted.lastInsertRowid),
          name: item.canonicalName,
          amount: item.amount,
          measure: item.measure,
        });
        createdItems += 1;
      }

      insertReceiptItem.run(
        receiptId,
        item.rawName,
        item.canonicalName,
        item.amount,
        item.measure,
        item.unitPrice ?? null,
        item.totalPrice ?? null,
        item.matchSource ?? 'manual',
      );

      if (item.rememberAlias) {
        const rawKey = normalizeReceiptKey(item.rawName);
        if (rawKey) {
          upsertAlias.run(
            familyId,
            storeKey,
            rawKey,
            item.canonicalName,
          );
          rememberedAliases += 1;
        }
      }
    }

    return {
      success: true as const,
      receiptId,
      importedItems: payload.items.length,
      mergedItems,
      createdItems,
      rememberedAliases,
    };
  });

  return run();
}
