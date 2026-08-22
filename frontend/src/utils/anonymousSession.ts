const STORAGE_KEY = 'dc_anon_session_id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// In-memory fallback for the rare case sessionStorage throws (private
// browsing modes, storage disabled by policy, etc.) -- the id just won't
// survive a page reload in that case, which is an acceptable degradation
// for anonymous analytics.
let memoryFallback: string | null = null;

/** A per-tab, anonymous, non-personal identifier used only so the backend
 * can de-duplicate/group customer_events -- never tied to any account,
 * since customers never log in. */
export function getAnonymousSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = generateId();
    window.sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    if (!memoryFallback) memoryFallback = generateId();
    return memoryFallback;
  }
}
