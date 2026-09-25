import { test } from 'node:test';
import assert from 'node:assert/strict';

// store.js expects a browser-like environment. Provide a minimal, explicit
// localStorage polyfill (rather than relying on a Node version's built-in
// global, which varies) plus a synchronous stand-in for
// requestAnimationFrame/cancelAnimationFrame, before importing the module.
// Its own side effects — the visibilitychange/pagehide listeners — are
// guarded to no-op when `document`/`window` don't exist, so this stays a
// plain Node test with no DOM.
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear(),
};

let rafQueue = [];
globalThis.requestAnimationFrame = (cb) => {
  const id = rafQueue.length + 1;
  rafQueue.push({ id, cb });
  return id;
};
globalThis.cancelAnimationFrame = (id) => {
  rafQueue = rafQueue.filter((f) => f.id !== id);
};
function flushRaf() {
  const jobs = rafQueue;
  rafQueue = [];
  for (const { cb } of jobs) cb();
}

const { defaultState, pushHistory, save, flush, importSets, exportSets, requestPersistentStorage } = await import('../js/store.js');

test('pushHistory caps entries per kind, not globally', () => {
  const state = defaultState();
  for (let i = 0; i < 5; i++) pushHistory(state, { kind: 'dice', total: i });
  for (let i = 0; i < 5; i++) pushHistory(state, { kind: 'random', total: i });
  assert.equal(state.history.filter((h) => h.kind === 'dice').length, 5);
  assert.equal(state.history.filter((h) => h.kind === 'random').length, 5);

  // Flood with a different kind well past the shared HISTORY_LIMIT (200);
  // the earlier dice/random entries must survive untouched.
  for (let i = 0; i < 250; i++) pushHistory(state, { kind: 'cards', total: i });
  assert.equal(state.history.filter((h) => h.kind === 'dice').length, 5, 'dice history should not be evicted by unrelated card draws');
  assert.equal(state.history.filter((h) => h.kind === 'random').length, 5);
  assert.equal(state.history.filter((h) => h.kind === 'cards').length, 200, 'cards history is still capped at the per-kind limit');
});

test('save() debounces via requestAnimationFrame and writes on flush', () => {
  localStorage.removeItem('grimoire.v1');
  const state = defaultState();
  state.seed = 'unsaved-until-flushed';
  save(state);
  assert.equal(localStorage.getItem('grimoire.v1'), null, 'save should be debounced, not synchronous');
  flushRaf();
  assert.match(localStorage.getItem('grimoire.v1'), /unsaved-until-flushed/);
});

test('flush() writes immediately without waiting for the animation frame', () => {
  localStorage.removeItem('grimoire.v1');
  const state = defaultState();
  state.seed = 'flushed-eagerly';
  save(state);
  flush(); // simulates the page being hidden/closed before the rAF fires
  assert.match(localStorage.getItem('grimoire.v1'), /flushed-eagerly/);
  rafQueue = []; // the (now redundant) queued rAF callback never needs to run
});

test('importSets keeps multi-codepoint emoji icons intact instead of truncating mid-sequence', () => {
  const state = defaultState();
  const family = '👨‍👩‍👧‍👦'; // a single ZWJ-joined family emoji
  const before = state.sets.length;
  const n = importSets(state, JSON.stringify({ sets: [{ name: 'Imported', icon: family, rolls: [{ name: 'Hit', expr: 'd20+5' }] }] }));
  assert.equal(n, 1);
  const imported = state.sets[state.sets.length - 1];
  assert.equal(state.sets.length, before + 1);
  // The whole emoji sequence must survive (no lone surrogate / dangling ZWJ).
  assert.ok(imported.icon === family || [...imported.icon].every((cp) => cp.codePointAt(0) !== undefined));
  assert.doesNotMatch(imported.icon, /\ud83d(?![\udc00-\udfff])/, 'must not contain a lone unpaired surrogate');
});

test('importSets rejects malformed input without throwing an unhandled error', () => {
  const state = defaultState();
  assert.throws(() => importSets(state, '{"sets": "not-an-array"}'));
  assert.throws(() => importSets(state, 'not json'));
});

test('exportSets round-trips through importSets', () => {
  const state = defaultState();
  state.sets = [{ id: 'x', name: 'Test Set', icon: '🎲', rolls: [{ id: 'r1', name: 'Attack', expr: 'd20+5' }] }];
  state.tables = [{ id: 't1', name: 'Weather', text: 'Sunny\nRainy' }];
  const json = exportSets(state);
  const fresh = defaultState();
  fresh.sets = [];
  const n = importSets(fresh, json);
  assert.equal(n, 2);
  assert.equal(fresh.sets[0].name, 'Test Set');
  assert.equal(fresh.tables[0].name, 'Weather');
});

test('requestPersistentStorage returns null when the Storage API is unavailable', async () => {
  const saved = globalThis.navigator?.storage;
  if (globalThis.navigator) delete globalThis.navigator.storage;
  assert.equal(await requestPersistentStorage(), null);
  if (globalThis.navigator && saved !== undefined) globalThis.navigator.storage = saved;
});

test('requestPersistentStorage skips the request when already persisted', async () => {
  let persistCalled = false;
  globalThis.navigator.storage = {
    persisted: async () => true,
    persist: async () => { persistCalled = true; return true; },
  };
  assert.equal(await requestPersistentStorage(), true);
  assert.equal(persistCalled, false, 'should not re-request when already persisted');
});

test('requestPersistentStorage requests and reports grant/denial when not yet persisted', async () => {
  globalThis.navigator.storage = { persisted: async () => false, persist: async () => true };
  assert.equal(await requestPersistentStorage(), true);

  globalThis.navigator.storage = { persisted: async () => false, persist: async () => false };
  assert.equal(await requestPersistentStorage(), false);
});

test('requestPersistentStorage swallows errors from the Storage API', async () => {
  globalThis.navigator.storage = {
    persisted: async () => { throw new Error('boom'); },
    persist: async () => true,
  };
  assert.equal(await requestPersistentStorage(), null);
});
