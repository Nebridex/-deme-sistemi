'use client';

const MAX_RECENT_ITEMS = 8;
const DEFAULT_PRESET_ITEMS = ['Çay', 'Su', 'Americano', 'Latte', 'Tatlı'];

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

export function getPresetItemNames(cafeId: string): string[] {
  if (typeof window === 'undefined') return DEFAULT_PRESET_ITEMS;
  try {
    const raw = window.localStorage.getItem(presetStorageKey(cafeId));
    if (!raw) return DEFAULT_PRESET_ITEMS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PRESET_ITEMS;
    const clean = parsed.filter((item): item is string => typeof item === 'string' && !!item.trim()).slice(0, 12);
    return clean.length ? clean : DEFAULT_PRESET_ITEMS;
  } catch {
    return DEFAULT_PRESET_ITEMS;
  }
}

export function savePresetItemNames(cafeId: string, values: string[]) {
  if (typeof window === 'undefined') return;
  const normalized = values.map((value) => value.trim()).filter(Boolean).slice(0, 12);
  window.localStorage.setItem(presetStorageKey(cafeId), JSON.stringify(normalized.length ? normalized : DEFAULT_PRESET_ITEMS));
}
