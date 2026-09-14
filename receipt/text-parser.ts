import type { ReceiptAnalysis, ReceiptCandidate } from './types.js';

const PRICE_AT_END = /(?:^|\s)\$?(\d{1,5}(?:[.,]\d{2}))\s*[A-Z]?\s*$/i;
const NOISE =
  /\b(sub\s*total|subtotal|total|tax|hst|gst|pst|qst|tender|visa|master\s*card|mastercard|debit|cash|change|balance|points?|loyalty|savings?|coupon|discount|receipt|transaction|terminal|approval|auth(?:orization)?|payment|amount due|card number)\b/i;

const MEASURE_MAP: Array<[RegExp, string]> = [
  [/\b(\d+(?:[.,]\d+)?)\s*kg\b/i, 'Kilogram (kg)'],
  [/\b(\d+(?:[.,]\d+)?)\s*g\b/i, 'Gram (g)'],
  [/\b(\d+(?:[.,]\d+)?)\s*ml\b/i, 'Milliliter (ml)'],
  [/\b(\d+(?:[.,]\d+)?)\s*l\b/i, 'Liter (L)'],
];

function decimal(value: string): number {
  return Number(value.replace(',', '.'));
}

function cleanProductName(raw: string): string {
  let value = raw
    .replace(PRICE_AT_END, '')
    .replace(/^\s*\d{4,14}\s+/, '')
    .replace(/^\s*\d+(?:[.,]\d+)?\s*[@xX]\s*\$?\d+(?:[.,]\d{2})\s+/, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b/gi, ' ')
    .replace(/\b\d+\s*(?:pk|pack|ct|count)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  value = value.replace(/^[*#\-:]+|[*#\-:]+$/g, '').trim();
  return value;
}

function parseQuantityAndMeasure(raw: string): {
  quantity?: number;
  amount?: number;
  measure?: string;
} {
  const weighed = raw.match(
    /\b(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\s*(?:@|x)\s*\$?\d+(?:[.,]\d+)?/i,
  );
  if (weighed) {
    const amount = decimal(weighed[1]);
    const token = weighed[2].toLowerCase();
    const measure =
      token === 'kg'
        ? 'Kilogram (kg)'
        : token === 'g'
          ? 'Gram (g)'
          : token === 'ml'
            ? 'Milliliter (ml)'
            : 'Liter (L)';
    return { amount, measure };
  }

  for (const [regex, measure] of MEASURE_MAP) {
    const match = raw.match(regex);
    if (match) {
      return { amount: decimal(match[1]), measure };
    }
  }

  const pack = raw.match(/\b(\d+)\s*(?:pk|pack|ct|count)\b/i);
  if (pack) {
    const quantity = Number(pack[1]);
    return { quantity, amount: quantity, measure: 'Unit' };
  }

  const multiplier = raw.match(/^\s*(\d+(?:[.,]\d+)?)\s*[@xX]\s*\$?\d+(?:[.,]\d{2})\b/i);
  if (multiplier) {
    const quantity = decimal(multiplier[1]);
    return { quantity, amount: quantity, measure: 'Unit' };
  }

  return {};
}

function likelyMerchant(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 8)) {
    const trimmed = line.trim();
    if (
      trimmed.length >= 2 &&
      trimmed.length <= 60 &&
      /[A-Za-zÀ-ÿ]/.test(trimmed) &&
      !PRICE_AT_END.test(trimmed) &&
      !NOISE.test(trimmed) &&
      !/\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|ottawa|ontario|quebec|gatineau|tel|phone)\b/i.test(trimmed)
    ) {
      return trimmed.replace(/\s{2,}/g, ' ');
    }
  }
  return undefined;
}

export function sanitizeReceiptOcrText(rawText: string): string {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !NOISE.test(line))
    .filter((line) => !/\b\d{12,19}\b/.test(line.replace(/[ -]/g, '')))
    .filter(
      (line) =>
        !/\b(?:tel(?:ephone)?|phone|address|street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?)\b/i.test(
          line,
        ),
    )
    .slice(0, 300)
    .join('\n')
    .slice(0, 30_000);
}

function parseLine(rawLine: string, index: number): ReceiptCandidate | null {
  const line = rawLine.replace(/\s{2,}/g, ' ').trim();
  if (!line || line.length < 3 || NOISE.test(line)) return null;

  const priceMatch = line.match(PRICE_AT_END);
  const hasProductSignal =
    Boolean(priceMatch) ||
    /\b\d+\s*(?:pk|pack|ct|count)\b/i.test(line) ||
    /\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b/i.test(line);

  if (!hasProductSignal || !/[A-Za-zÀ-ÿ]/.test(line)) return null;

  const proposedName = cleanProductName(line);
  if (!proposedName || proposedName.length < 2 || NOISE.test(proposedName)) return null;

  const quantityInfo = parseQuantityAndMeasure(line);
  const totalPrice = priceMatch ? decimal(priceMatch[1]) : undefined;

  return {
    id: `ocr-line-${index + 1}`,
    rawName: line,
    proposedName,
    ...(quantityInfo.quantity !== undefined ? { quantity: quantityInfo.quantity } : {}),
    ...(quantityInfo.amount !== undefined ? { amount: quantityInfo.amount } : {}),
    ...(quantityInfo.measure ? { measure: quantityInfo.measure } : {}),
    ...(totalPrice !== undefined ? { totalPrice } : {}),
    status: 'unresolved',
  };
}

export function parseReceiptText(rawText: string): ReceiptAnalysis {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items = lines
    .map((line, index) => parseLine(line, index))
    .filter((item): item is ReceiptCandidate => item !== null);

  return {
    ...(likelyMerchant(lines) ? { merchant: likelyMerchant(lines) } : {}),
    rawText: items.map((item) => item.rawName).join('\n'),
    items,
  };
}
