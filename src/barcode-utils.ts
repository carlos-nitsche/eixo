import type { ERPProduct } from './erp';

// Barcodes are identifiers, never numbers: keep all leading zeroes.
export const normalizeBarcode = (raw: string): string => String(raw ?? '').replace(/[\s\u200b-\u200d\ufeff]+/g, '');

export const barcodeAliases = (raw: string): string[] => {
  const normalized = normalizeBarcode(raw);
  if (!normalized) return [];
  const aliases = [normalized];
  // UPC-A is often returned by scanners as EAN-13 with a leading 0.
  if (/^\d{12}$/.test(normalized)) aliases.push('0' + normalized);
  if (/^0\d{12}$/.test(normalized)) aliases.push(normalized.slice(1));
  return aliases;
};

export const findBarcodeProducts = (products: ERPProduct[], raw: string): ERPProduct[] => {
  const aliases = new Set(barcodeAliases(raw));
  if (!aliases.size) return [];
  return products.filter(product => barcodeAliases(product.barcode).some(value => aliases.has(value)));
};
