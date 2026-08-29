const STORAGE_KEY = 'dc_device_id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let memoryFallback: string | null = null;

/** A persistent, anonymous, non-personal browser identifier used to key a
 * customer's "My Selection" list. Unlike the per-tab anonymous session id,
 * this lives in localStorage so the selection survives closing the tab and
 * coming back at the shop. Never tied to any account. Degrades to an
 * in-memory value if localStorage is unavailable. */
export function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = generateId();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    if (!memoryFallback) memoryFallback = generateId();
    return memoryFallback;
  }
}
