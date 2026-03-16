// Generic localStorage-backed store helper.
// Each store gets its own key and optional default value factory.

export interface LocalStore<T> {
  getAll(): T[];
  setAll(items: T[]): void;
  add(item: T): void;
  update(id: string, updates: Partial<T>): T | null;
  remove(id: string): void;
  getById(id: string): T | null;
  clear(): void;
}

export function createLocalStore<T extends { id: string }>(
  storageKey: string,
  defaults?: () => T[],
): LocalStore<T> {
  function getAll(): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaults?.() ?? [];
      return JSON.parse(raw) as T[];
    } catch {
      return defaults?.() ?? [];
    }
  }

  function setAll(items: T[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(items));
  }

  function add(item: T): void {
    const items = getAll();
    items.push(item);
    setAll(items);
  }

  function update(id: string, updates: Partial<T>): T | null {
    const items = getAll();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...updates };
    setAll(items);
    return items[idx];
  }

  function remove(id: string): void {
    setAll(getAll().filter((i) => i.id !== id));
  }

  function getById(id: string): T | null {
    return getAll().find((i) => i.id === id) ?? null;
  }

  function clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(storageKey);
  }

  return { getAll, setAll, add, update, remove, getById, clear };
}
