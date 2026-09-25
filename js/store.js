// Persistent state (localStorage). Every read/write is guarded so the app
// still works if storage is unavailable.
import { DEFAULT_SETS } from './data.js';

const KEY = 'grimoire.v1';
const HISTORY_LIMIT = 200;

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function defaultState() {
  return {
    theme: 'dark',
    seed: '',
    activeSet: DEFAULT_SETS[0].id,
    sets: clone(DEFAULT_SETS),
    history: [],
    tables: [],
    deck: null,
    lastExpr: '',
    tab: 'dice',
  };
}

export function load() {
  const state = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(state, saved);
      if (!Array.isArray(state.sets) || !state.sets.length) state.sets = clone(DEFAULT_SETS);
      if (!Array.isArray(state.history)) state.history = [];
      if (!Array.isArray(state.tables)) state.tables = [];
      if (!state.sets.some((s) => s.id === state.activeSet)) state.activeSet = state.sets[0].id;
    }
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return state;
}

function writeNow(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked */
  }
}

let pending = null;
let pendingState = null;

/** Force any debounced save to happen immediately (used before the page is hidden/unloaded). */
export function flush() {
  if (pending == null) return;
  cancelAnimationFrame(pending);
  pending = null;
  writeNow(pendingState);
}

export function save(state) {
  pendingState = state;
  if (pending) cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    pending = null;
    writeNow(state);
  });
}

// requestAnimationFrame is throttled or paused entirely while a tab/app is
// hidden, so a debounced save can otherwise be lost if the user backgrounds
// or closes the app right after their last action. Flush synchronously
// whenever the page is about to stop being visible. Guarded so this module
// stays importable in a non-browser environment (e.g. unit tests).
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });
  window.addEventListener('pagehide', flush);
}

/** Truncate a string to at most `max` grapheme clusters, without breaking
 * multi-codepoint sequences (e.g. ZWJ emoji) in the middle. */
function truncateGraphemes(str, max) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const parts = [];
    for (const { segment } of new Intl.Segmenter().segment(str)) {
      parts.push(segment);
      if (parts.length >= max) break;
    }
    return parts.join('');
  }
  // Fallback: at least keep surrogate pairs intact.
  return Array.from(str).slice(0, max).join('');
}

export function pushHistory(state, entry) {
  state.history.unshift({ id: uid('h'), at: Date.now(), ...entry });
  // Cap per kind so, e.g., a run of card draws can't evict dice-roll
  // history that a different view still displays.
  const kind = entry.kind;
  let count = 0;
  state.history = state.history.filter((h) => {
    if (h.kind !== kind) return true;
    count++;
    return count <= HISTORY_LIMIT;
  });
}

export function exportSets(state) {
  return JSON.stringify({ app: 'grimoire-of-chance', version: 1, sets: state.sets, tables: state.tables }, null, 2);
}

/** Merge imported sets/tables; returns count of items imported. Throws on bad data. */
export function importSets(state, json) {
  const data = JSON.parse(json);
  const sets = Array.isArray(data) ? data : data.sets;
  const tables = Array.isArray(data) ? [] : data.tables || [];
  if (!Array.isArray(sets)) throw new Error('No roll sets found in file');
  let count = 0;
  for (const s of sets) {
    if (!s || typeof s.name !== 'string' || !Array.isArray(s.rolls)) continue;
    const rolls = s.rolls
      .filter((r) => r && typeof r.name === 'string' && typeof r.expr === 'string')
      .map((r) => ({ id: uid('r'), name: r.name.slice(0, 40), expr: r.expr.slice(0, 80) }));
    state.sets.push({ id: uid('set'), name: s.name.slice(0, 30), icon: typeof s.icon === 'string' ? truncateGraphemes(s.icon, 2) : '🎲', rolls });
    count++;
  }
  for (const t of tables) {
    if (!t || typeof t.name !== 'string' || typeof t.text !== 'string') continue;
    state.tables.push({ id: uid('tbl'), name: t.name.slice(0, 40), text: t.text.slice(0, 20000) });
    count++;
  }
  return count;
}
