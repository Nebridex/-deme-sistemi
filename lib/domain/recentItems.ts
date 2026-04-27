'use client';

const MAX_RECENT_ITEMS = 8;
const DEFAULT_PRESET_ITEMS: PresetItemShortcut[] = [
  { name: 'Çay', defaultPrice: 25 },
  { name: 'Su', defaultPrice: 15 },
  { name: 'Americano', defaultPrice: 90 },
  { name: 'Latte', defaultPrice: 110 },
  { name: 'Tatlı', defaultPrice: 150 }
];

export type PresetItemShortcut = {
  name: string;
  defaultPrice: number | null;
};

function storageKey(cafeId: string) {
  return `recent-item-names:${cafeId}`;
}

function presetStorageKey(cafeId: string) {
  return `preset-item-names:${cafeId}`;
}

export function getRecentItemNames(cafeId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(cafeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

export function rememberRecentItemName(cafeId: string, name: string) {
  if (typeof window === 'undefined') return;
  const normalized = name.trim();
  if (!normalized) return;

  const current = getRecentItemNames(cafeId);
  const next = [normalized, ...current.filter((item) => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase())]
    .slice(0, MAX_RECENT_ITEMS);

  window.localStorage.setItem(storageKey(cafeId), JSON.stringify(next));
}

export function getPresetItems(cafeId: string): PresetItemShortcut[] {
  if (typeof window === 'undefined') return DEFAULT_PRESET_ITEMS;
  try {
    const raw = window.localStorage.getItem(presetStorageKey(cafeId));
    if (!raw) return DEFAULT_PRESET_ITEMS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PRESET_ITEMS;
    const clean = parsed
      .map((item): PresetItemShortcut | null => {
        if (typeof item === 'string') return { name: item.trim(), defaultPrice: null };
        if (!item || typeof item !== 'object') return null;
        const rawName = (item as { name?: unknown }).name;
        const rawDefaultPrice = (item as { defaultPrice?: unknown }).defaultPrice;
        if (typeof rawName !== 'string' || !rawName.trim()) return null;
        if (rawDefaultPrice !== null && rawDefaultPrice !== undefined && typeof rawDefaultPrice !== 'number') return null;
        return { name: rawName.trim(), defaultPrice: rawDefaultPrice ?? null };
      })
      .filter((item): item is PresetItemShortcut => Boolean(item))
      .slice(0, 12);
    return clean.length ? clean : DEFAULT_PRESET_ITEMS;
  } catch {
    return DEFAULT_PRESET_ITEMS;
  }
}

export function savePresetItems(cafeId: string, values: PresetItemShortcut[]) {
  if (typeof window === 'undefined') return;
  const normalized = values
    .map((value) => ({
      name: value.name.trim(),
      defaultPrice: value.defaultPrice === null || value.defaultPrice === undefined ? null : Math.max(0, value.defaultPrice)
    }))
    .filter((value) => !!value.name)
    .slice(0, 12);
  window.localStorage.setItem(presetStorageKey(cafeId), JSON.stringify(normalized.length ? normalized : DEFAULT_PRESET_ITEMS));
}

export function getPresetItemNames(cafeId: string): string[] {
  return getPresetItems(cafeId).map((item) => item.name);
}
