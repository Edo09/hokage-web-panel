/**
 * Local autosave for long builder forms.
 *
 * Building a 5-week program is many minutes of typing, and every one of these
 * wipes it: a refresh, an accidental "Cancelar", clicking a sidebar link, a
 * crash, or the auth session dropping (RequireAuth then redirects to /login and
 * unmounts the form). The draft is mirrored to localStorage on every keystroke
 * so reopening the builder picks up exactly where the coach left off.
 *
 * Storage only — nothing here reaches the database.
 */

const PREFIX = 'hokage:program-draft:';
/** Drafts older than this are ignored (and swept) so stale work never resurfaces. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoredDraft<T> {
  savedAt: number;
  data: T;
}

/** One slot per builder context, so a client's draft can't collide with a
 *  template's — or with a different client's. */
export function draftKey(scope: string, id: string): string {
  return `${PREFIX}${scope}:${id}`;
}

export function saveDraft<T>(key: string, data: T): void {
  try {
    const payload: StoredDraft<T> = { savedAt: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Private mode / quota — autosave is a convenience, never block the form.
  }
}

export function loadDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (typeof parsed?.savedAt !== 'number' || parsed.data == null) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Is there a recoverable draft in this slot? Lets a list screen advertise it,
 *  so work that survived a refresh isn't invisible until you reopen the form. */
export function hasDraft(key: string): boolean {
  return loadDraft(key) != null;
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** "hace 2 min" — how stale the recovered draft is. */
export function draftAge(savedAt: number): string {
  const mins = Math.floor((Date.now() - savedAt) / 60_000);
  if (mins < 1) return 'hace unos segundos';
  if (mins === 1) return 'hace 1 minuto';
  if (mins < 60) return `hace ${mins} minutos`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return 'hace 1 hora';
  if (hours < 24) return `hace ${hours} horas`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
