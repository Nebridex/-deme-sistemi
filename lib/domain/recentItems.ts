'use client';

const MAX_RECENT_ITEMS = 8;

function storageKey(cafeId: string) {
  return `recent-item-names:${cafeId}`;
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
