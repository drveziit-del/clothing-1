import type { Variant } from '@/types';

const SIZE_ORDER: Record<string, number> = {
  '3XS': 1, 'XXXS': 1,
  '2XS': 2, 'XXS': 2,
  'XS': 3,
  'S': 4, 'SMALL': 4,
  'M': 5, 'MEDIUM': 5,
  'L': 6, 'LARGE': 6,
  'XL': 7, 'EXTRA LARGE': 7,
  '2XL': 8, 'XXL': 8,
  '3XL': 9, 'XXXL': 9,
  '4XL': 10, 'XXXXL': 10,
  '5XL': 11, 'XXXXXL': 11,
  '6XL': 12, '7XL': 13,
};

export function getSizeRank(sizeStr: string): number {
  if (!sizeStr) return 999;
  const s = sizeStr.trim().toUpperCase();
  if (SIZE_ORDER[s] !== undefined) return SIZE_ORDER[s];
  const match = s.match(/^(\d+)XL$/);
  if (match) return 7 + parseInt(match[1], 10);
  return 999;
}

export function sortSizes(sizes: string[]): string[] {
  if (!sizes || !Array.isArray(sizes)) return [];
  return [...sizes].sort((a, b) => {
    const rankA = getSizeRank(a);
    const rankB = getSizeRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });
}

export function getSmallVariant(variants: Variant[]): Variant | undefined {
  if (!variants || variants.length === 0) return undefined;
  // Look for Small size
  const small = variants.find(v => {
    const s = v.size.trim().toUpperCase();
    return s === 'S' || s === 'SMALL';
  });
  if (small) return small;

  // Fallback: sort variants by size rank and pick the smallest
  const sorted = [...variants].sort((a, b) => getSizeRank(a.size) - getSizeRank(b.size));
  return sorted[0];
}
