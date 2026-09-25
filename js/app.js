import { roll, validate, quickStats, DiceError } from './dice.js';
import { makeRng } from './rng.js';
import { DECK_TYPES, deckType, newDeck, draw, reshuffle, shuffleRemaining } from './cards.js';
import { DEFAULT_SETS, SET_ICONS, BUILTIN_TABLES, GENERATORS } from './data.js';
import { load, save, pushHistory, uid, exportSets, importSets, defaultState } from './store.js';

const state = load();
let rng = makeRng(state.seed);

const $ = (sel, root = document) => root.querySelector(sel);
const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, attrs = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};

function persist() {
  save(state);
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ===================== Tabs =====================
function setTab(tab) {
  state.tab = tab;
  for (const btn of $all('.tab')) btn.setAttribute('aria-current', btn.dataset.tab === tab ? 'page' : 'false');
  for (const view of $all('.view')) view.hidden = view.dataset.view !== tab;
  persist();
}
$all('.tab').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

// ===================== Theme =====================
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $('#btn-theme').textContent = state.theme === 'dark' ? '☾' : '☀';
  $('#btn-theme').title = state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}
$('#btn-theme').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  persist();
});

// ===================== Seed =====================
function applySeedUI() {
  $('#seed-badge').hidden = !state.seed;
  $('#seed-input').value = state.seed || '';
}
$('#form-seed').addEventListener('submit', (e) => {
  e.preventDefault();
  state.seed = $('#seed-input').value.trim();
  rng = makeRng(state.seed);
  applySeedUI();
  persist();
  toast(state.seed ? `Seeded with "${state.seed}"` : 'Seed cleared');
});
$('#btn-seed-clear').addEventListener('click', () => {
  state.seed = '';
  rng = makeRng('');
  applySeedUI();
  persist();
  toast('Seed cleared — back to true randomness');
});

// ===================== Help dialog =====================
$('#btn-help').addEventListener('click', () => $('#help').showModal());
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    setTab('dice');
    $('#expr').focus();
  }
});

// ===================== DICE VIEW =====================
const STD_DICE = [4, 6, 8, 10, 12, 20, 100];
let pool = []; // { n, sides }
let modifier = 0;

function renderStdDice() {
  const wrap = $('#std-dice');
  wrap.innerHTML = '';
  const poolMode = $('#build-mode').checked;
  for (const sides of STD_DICE) {
    const count = (pool.find((p) => p.sides === sides) || {}).n || 0;
    const btn = el('button', {
      type: 'button', class: 'die-btn',
      title: poolMode ? `Add a d${sides} to the pool` : `Roll a d${sides}`,
      onclick: () => onDieTap(sides),
    }, [`d${sides}`]);
    if (count > 0) btn.append(el('span', { class: 'n' }, [`×${count}`]));
    wrap.append(btn);
  }
}

function onDieTap(sides) {
  if ($('#build-mode').checked) {
    const existing = pool.find((p) => p.sides === sides);
    if (existing) existing.n++;
    else pool.push({ sides, n: 1 });
    updateBuiltExpr();
  } else {
    doRoll(`d${sides}`, null);
  }
  renderStdDice();
}

function updateBuiltExpr() {
  const parts = pool.filter((p) => p.n > 0).map((p) => `${p.n}d${p.sides}`);
  let expr = parts.join('+');
  if (modifier > 0) expr += (expr ? '+' : '') + modifier;
  else if (modifier < 0) expr += modifier;
  $('#expr').value = expr;
  updateHint();
}

$('#build-mode').addEventListener('change', (e) => {
  if (!e.target.checked) { pool = []; modifier = 0; }
  renderStdDice();
});
$all('.stepper-btn[data-mod]').forEach((btn) => {
  btn.addEventListener('click', () => {
    modifier += parseInt(btn.dataset.mod, 10);
    updateBuiltExpr();
  });
});
$('#btn-clear-expr').addEventListener('click', () => {
  pool = []; modifier = 0;
  $('#expr').value = '';
  renderStdDice();
  updateHint();
  $('#expr').focus();
});

function updateHint() {
  const v = $('#expr').value.trim();
  const hint = $('#expr-hint');
  if (!v) { hint.textContent = ''; hint.classList.remove('error'); return; }
  const err = validate(v);
  if (err) { hint.textContent = err; hint.classList.add('error'); return; }
  hint.classList.remove('error');
  const stats = quickStats(v);
  hint.textContent = stats ? `Range ${stats.min}–${stats.max}${stats.repeat > 1 ? ` × ${stats.repeat}` : ''}` : 'Ready to roll';
}
$('#expr').addEventListener('input', updateHint);

function critClass(g) {
  if (g.dice.some((d) => d.crit === 'nat20')) return 'crit-hi';
  if (g.dice.some((d) => d.crit === 'nat1')) return 'crit-lo';
  return '';
}

function detailLine(res) {
  // res.text already contains bracketed faces per group; strip to a compact form.
  return res.text;
}

function renderResult(res, name) {
  const wrap = $('#result');
  wrap.innerHTML = '';
  const card = el('div', { class: 'roll-card' });
  if (name) card.append(el('div', { class: 'roll-detail' }, [name]));
  if (res.repeat === 1) {
    const r = res.results[0];
    const allGroups = r.groups;
    const cls = allGroups.some((g) => critClass(g) === 'crit-hi') ? 'crit-hi'
      : allGroups.some((g) => critClass(g) === 'crit-lo') ? 'crit-lo' : '';
    card.append(el('div', { class: `roll-total ${cls}` }, [String(r.total)]));
    card.append(el('div', { class: 'roll-detail' }, [detailLine(r)]));
    const badges = [];
    if (allGroups.some((g) => g.dice.some((d) => d.crit === 'nat20'))) badges.push(el('span', { class: 'crit-badge hi' }, ['NAT 20']));
    if (allGroups.some((g) => g.dice.some((d) => d.crit === 'nat1'))) badges.push(el('span', { class: 'crit-badge lo' }, ['NAT 1']));
    if (badges.length) card.append(el('div', { class: 'roll-badges' }, badges));
  } else {
    for (let i = 0; i < res.results.length; i++) {
      const r = res.results[i];
      card.append(el('div', { class: 'roll-detail' }, [`#${i + 1}: ${detailLine(r)} = `, el('b', {}, [String(r.total)])]));
    }
    card.append(el('div', { class: 'roll-sum' }, [`Total: ${res.grand}`]));
  }
  wrap.append(card);
}

function doRoll(expr, name) {
  const value = (expr ?? $('#expr').value).trim();
  if (!value) return;
  let res;
  try {
    res = roll(value, { rng });
  } catch (e) {
    const hint = $('#expr-hint');
    hint.textContent = e instanceof DiceError ? e.message : 'Could not parse that expression';
    hint.classList.add('error');
    return;
  }
  renderResult(res, name);
  pushHistory(state, { kind: 'dice', name: name || null, expr: value, notation: res.notation, total: res.grand, repeat: res.repeat });
  renderHistory();
  persist();
  if ($('#expr').value.trim() !== value) $('#expr').value = value;
}

$('#roll-form').addEventListener('submit', (e) => {
  e.preventDefault();
  doRoll(null, null);
});

function renderHistory() {
  const list = $('#history');
  const empty = $('#history-empty');
  list.innerHTML = '';
  const items = state.history.filter((h) => h.kind === 'dice' || !h.kind);
  empty.hidden = items.length > 0;
  for (const h of items.slice(0, 60)) {
    const li = el('li', {
      class: 'history-item',
      onclick: () => { $('#expr').value = h.expr; updateHint(); setTab('dice'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    }, [
      el('div', { class: 'history-left' }, [
        h.name ? el('div', { class: 'history-name' }, [h.name]) : null,
        el('div', { class: 'history-expr' }, [h.notation || h.expr]),
      ]),
      el('div', { class: 'history-total' }, [String(h.total)]),
    ]);
    list.append(li);
  }
}
$('#btn-clear-history').addEventListener('click', () => {
  state.history = [];
  renderHistory();
  persist();
  toast('Chronicle cleared');
});

// ---- Quick roll sets ----
function activeSet() {
  return state.sets.find((s) => s.id === state.activeSet) || state.sets[0];
}
function renderSetChips() {
  const wrap = $('#set-chips');
  wrap.innerHTML = '';
  for (const s of state.sets) {
    wrap.append(el('button', {
      class: 'chip', type: 'button', role: 'tab', 'aria-selected': String(s.id === state.activeSet),
      onclick: () => { state.activeSet = s.id; persist(); renderSetChips(); renderQuickRolls(); },
    }, [`${s.icon} ${s.name}`]));
  }
}
function renderQuickRolls() {
  const wrap = $('#quick-rolls');
  wrap.innerHTML = '';
  const s = activeSet();
  if (!s || !s.rolls.length) {
    wrap.append(el('p', { class: 'quick-empty' }, ['No rolls in this set yet. Use "Edit set" to add some.']));
    return;
  }
  for (const r of s.rolls) {
    wrap.append(el('button', {
      class: 'quick-btn', type: 'button',
      onclick: () => doRoll(r.expr, r.name),
    }, [el('span', { class: 'qn' }, [r.name]), el('span', { class: 'qe' }, [r.expr])]));
  }
}
$('#btn-edit-set').addEventListener('click', () => {
  state.tab = 'sets';
  selectedSetId = state.activeSet;
  setTab('sets');
  renderSets();
});

// ===================== CARDS VIEW =====================
function ensureDeck() {
  if (!state.deck || !DECK_TYPES.some((t) => t.id === state.deck.type)) {
    state.deck = newDeck($('#deck-type')?.value || DECK_TYPES[0].id, rng);
  }
  return state.deck;
}
function renderDeckTypeSelect() {
  const sel = $('#deck-type');
  sel.innerHTML = '';
  for (const t of DECK_TYPES) sel.append(el('option', { value: t.id }, [t.name]));
  sel.value = state.deck ? state.deck.type : DECK_TYPES[0].id;
}
function renderDeckCount() {
  const d = state.deck;
  $('#deck-count').textContent = d ? `${d.cards.length} left · ${d.drawn.length} drawn` : '';
}
function cardNode(c) {
  if (c.kind === 'playing') {
    return el('div', { class: `playing-card ${c.color}` }, [
      el('div', { class: 'corner' }, [c.label]),
      el('div', { class: 'suit-mid' }, [c.suit || '★']),
      el('div', { class: 'corner', style: 'align-self:flex-end;transform:rotate(180deg)' }, [c.label]),
    ]);
  }
  if (c.kind === 'domt') {
    return el('div', { class: 'special-card' }, [
      el('div', { class: 'sym' }, [c.sym]),
      el('div', { class: 'cname' }, [c.name]),
      el('div', { class: 'csub' }, [c.playing]),
      el('div', { class: 'ceffect' }, [c.effect]),
    ]);
  }
  return el('div', { class: 'special-card' }, [
    el('div', { class: 'sym' }, ['✦']),
    el('div', { class: 'cname' }, [c.name]),
    c.reversed ? el('div', { class: 'reversed' }, ['REVERSED']) : el('div', { class: 'csub' }, ['upright']),
  ]);
}
function renderDrawn() {
  const wrap = $('#drawn');
  wrap.innerHTML = '';
  const d = state.deck;
  if (!d || !d.drawn.length) {
    wrap.append(el('p', { class: 'empty' }, ['No cards drawn yet.']));
  } else {
    for (const c of d.drawn.slice().reverse()) wrap.append(cardNode(c));
  }
  renderDeckCount();
  const t = deckType(d ? d.type : DECK_TYPES[0].id);
  $('#deck-note').textContent = t.id.startsWith('domt') ? 'Deck of Many Things: adapted from the SRD 5.1 (CC-BY-4.0). Effects are paraphrased — consult your table\'s rules for full text.' : '';
}
$('#deck-type').addEventListener('change', (e) => {
  state.deck = newDeck(e.target.value, rng);
  persist();
  renderDrawn();
});
$('#draw-minus').addEventListener('click', () => { const i = $('#draw-n'); i.value = Math.max(1, (+i.value || 1) - 1); });
$('#draw-plus').addEventListener('click', () => { const i = $('#draw-n'); i.value = Math.min(30, (+i.value || 1) + 1); });
$('#btn-draw').addEventListener('click', () => {
  const d = ensureDeck();
  const n = Math.max(1, Math.min(30, +$('#draw-n').value || 1));
  if (!d.cards.length) { toast('Deck is empty — shuffle or start a new deck'); return; }
  const got = draw(d, n, rng);
  pushHistory(state, { kind: 'cards', name: `Drew ${got.length} from ${deckType(d.type).name}`, total: got.map((c) => c.label || c.name).join(', ') });
  persist();
  renderDrawn();
});
$('#btn-shuffle').addEventListener('click', () => { shuffleRemaining(ensureDeck(), rng); persist(); renderDrawn(); toast('Remaining cards shuffled'); });
$('#btn-reset-deck').addEventListener('click', () => { state.deck = newDeck($('#deck-type').value, rng); persist(); renderDrawn(); toast('Fresh deck, shuffled'); });
$('#btn-clear-drawn').addEventListener('click', () => { reshuffle(ensureDeck(), rng); persist(); renderDrawn(); });

// ===================== RANDOM VIEW =====================
$('#form-range').addEventListener('submit', (e) => {
  e.preventDefault();
  const min = parseInt($('#rng-min').value, 10);
  const max = parseInt($('#rng-max').value, 10);
  const count = Math.max(1, Math.min(1000, parseInt($('#rng-count').value, 10) || 1));
  const out = $('#out-range');
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) { out.textContent = 'Min must be less than or equal to max.'; return; }
  const unique = $('#rng-unique').checked;
  const span = max - min + 1;
  if (unique && count > span) { out.textContent = `Can't pick ${count} unique values from a range of ${span}.`; return; }
  let values;
  if (unique) {
    const all = Array.from({ length: span }, (_, i) => min + i);
    for (let i = all.length - 1; i > 0 && i >= all.length - count; i--) {
      const j = rng.int(0, i);
      [all[i], all[j]] = [all[j], all[i]];
    }
    values = all.slice(all.length - count);
  } else {
    values = Array.from({ length: count }, () => rng.int(min, max));
  }
  if ($('#rng-sorted').checked) values.sort((a, b) => a - b);
  out.textContent = values.join(', ');
  pushHistory(state, { kind: 'random', name: `Range ${min}–${max} ×${count}`, total: values.join(', ') });
  persist();
});

function coinFlip() {
  const n = Math.max(1, Math.min(50, +$('#coin-n').value || 1));
  const results = Array.from({ length: n }, () => (rng.int(0, 1) ? 'Heads' : 'Tails'));
  $('#out-coin').textContent = n === 1 ? results[0] : results.join(', ') + ` — ${results.filter((r) => r === 'Heads').length} heads / ${results.filter((r) => r === 'Tails').length} tails`;
  pushHistory(state, { kind: 'random', name: 'Coin toss', total: results.join(', ') });
  persist();
}
$('#btn-coin').addEventListener('click', coinFlip);
$all('.stepper-btn[data-step]').forEach((btn) => btn.addEventListener('click', () => {
  const input = $('#' + btn.dataset.step);
  const delta = +btn.dataset.delta;
  input.value = Math.max(+input.min || 1, Math.min(+input.max || 999, (+input.value || 1) + delta));
}));

$('#form-chance').addEventListener('submit', (e) => {
  e.preventDefault();
  const pct = Math.max(0, Math.min(100, +$('#chance-pct').value || 0));
  const roll = rng.int(1, 100);
  const success = roll <= pct;
  const out = $('#out-chance');
  out.innerHTML = '';
  out.append(el('span', { style: `color:${success ? 'var(--green)' : 'var(--red)'};font-weight:700` }, [success ? 'Success' : 'Failure']), ` — rolled ${roll} against ${pct}%`);
  pushHistory(state, { kind: 'random', name: `Chance ${pct}%`, total: `${roll} → ${success ? 'success' : 'failure'}` });
  persist();
});

function getListItems() {
  return $('#list-text').value.split('\n').map((s) => s.trim()).filter(Boolean);
}
$('#btn-pick-one').addEventListener('click', () => {
  const items = getListItems();
  if (!items.length) { $('#out-list').textContent = 'Add some items first.'; return; }
  const choice = items[rng.int(0, items.length - 1)];
  $('#out-list').textContent = choice;
  pushHistory(state, { kind: 'random', name: 'Picked one', total: choice });
  persist();
});
$('#btn-pick-some').addEventListener('click', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const items = getListItems();
  const n = Math.max(1, Math.min(items.length || 1, +$('#pick-n').value || 1));
  if (!items.length) { $('#out-list').textContent = 'Add some items first.'; return; }
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) { const j = rng.int(0, i); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  const picked = copy.slice(0, n);
  $('#out-list').textContent = picked.join(', ');
  pushHistory(state, { kind: 'random', name: `Picked ${n}`, total: picked.join(', ') });
  persist();
});
$('#btn-shuffle-list').addEventListener('click', () => {
  const items = getListItems();
  if (!items.length) { $('#out-list').textContent = 'Add some items first.'; return; }
  for (let i = items.length - 1; i > 0; i--) { const j = rng.int(0, i); [items[i], items[j]] = [items[j], items[i]]; }
  $('#list-text').value = items.join('\n');
  $('#out-list').textContent = 'Shuffled the list above.';
});

$('#btn-float').addEventListener('click', () => { $('#out-misc').textContent = rng.float().toFixed(6); });
$('#btn-uuid').addEventListener('click', () => {
  let uuid;
  try { uuid = crypto.randomUUID(); } catch { uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = rng.int(0, 15); return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }); }
  $('#out-misc').textContent = uuid;
});
$('#btn-hex').addEventListener('click', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const n = Math.max(1, Math.min(64, +$('#hex-n').value || 8));
  const bytes = Array.from({ length: n }, () => rng.int(0, 255));
  $('#out-misc').textContent = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
});
$('#btn-letter').addEventListener('click', () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  $('#out-misc').textContent = letters[rng.int(0, 25)];
});

// ===================== TABLES VIEW =====================
function parseTableText(text) {
  const entries = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let m = /^(\d+)\s*-\s*(\d+)\s*[:.\-]\s*(.+)$/.exec(line);
    if (m) { entries.push({ w: parseInt(m[2], 10) - parseInt(m[1], 10) + 1, t: m[3].trim() }); continue; }
    m = /^(\d+)\s*[:.]\s*(.+)$/.exec(line);
    if (m) { entries.push({ w: 1, t: m[2].trim() }); continue; }
    m = /^(\d+)\s*x\s*(.+)$/i.exec(line);
    if (m) { entries.push({ w: parseInt(m[1], 10), t: m[2].trim() }); continue; }
    entries.push({ w: 1, t: line });
  }
  return entries;
}

function rollTable(entries, headingText) {
  const total = entries.reduce((s, e) => s + (e.w || 1), 0);
  let r = rng.int(1, total);
  let picked = entries[entries.length - 1];
  for (const e of entries) { r -= (e.w || 1); if (r <= 0) { picked = e; break; } }
  const wrap = $('#table-result');
  wrap.innerHTML = '';
  wrap.append(el('div', { class: 'tr-heading' }, [headingText]));
  wrap.append(el('div', { class: 'tr-text' }, [picked.t]));
  wrap.append(el('div', { class: 'tr-roll' }, [`Rolled ${total > 1 ? `out of ${total}` : ''}`.trim()]));
  $('#btn-table-again').hidden = false;
  $('#btn-table-again').onclick = () => rollTable(entries, headingText);
  pushHistory(state, { kind: 'table', name: headingText, total: picked.t });
  persist();
}

function runGenerator(g) {
  const value = g.run(rng);
  const w = $('#table-result');
  w.innerHTML = '';
  w.append(el('div', { class: 'tr-heading' }, [g.name]));
  w.append(el('div', { class: 'tr-text' }, [value]));
  $('#btn-table-again').hidden = false;
  $('#btn-table-again').onclick = () => runGenerator(g);
  pushHistory(state, { kind: 'table', name: g.name, total: value });
  persist();
}
function renderGenerators() {
  const wrap = $('#generators');
  wrap.innerHTML = '';
  for (const g of GENERATORS) {
    wrap.append(el('button', {
      class: 'btn', type: 'button',
      onclick: () => runGenerator(g),
    }, [g.name]));
  }
}
function renderBuiltinTables() {
  const wrap = $('#builtin-tables');
  wrap.innerHTML = '';
  for (const t of BUILTIN_TABLES) {
    const entries = t.entries.map((e) => (typeof e === 'string' ? { w: 1, t: e } : e));
    wrap.append(el('button', { class: 'btn', type: 'button', onclick: () => rollTable(entries, t.name) }, [t.name]));
  }
}
function renderCustomTables() {
  const wrap = $('#custom-tables');
  wrap.innerHTML = '';
  $('#tables-empty').hidden = state.tables.length > 0;
  for (const t of state.tables) {
    const entries = parseTableText(t.text);
    wrap.append(el('div', { class: 'table-row' }, [
      el('span', { class: 'tname', onclick: () => rollTable(entries, t.name), style: 'cursor:pointer' }, [t.name]),
      el('span', { class: 'tcount' }, [`${entries.length} entries`]),
      el('button', { class: 'btn btn-sm', type: 'button', onclick: () => openTableEditor(t) }, ['Edit']),
      el('button', { class: 'link-btn danger', type: 'button', onclick: () => { if (confirm(`Delete "${t.name}"?`)) { state.tables = state.tables.filter((x) => x.id !== t.id); persist(); renderCustomTables(); } } }, ['Delete']),
    ]));
  }
}
function openTableEditor(t) {
  $('#table-editor').hidden = false;
  $('#tbl-id').value = t ? t.id : '';
  $('#tbl-name').value = t ? t.name : '';
  $('#tbl-text').value = t ? t.text : '';
  $('#tbl-name').focus();
}
$('#btn-new-table').addEventListener('click', () => openTableEditor(null));
$('#btn-table-cancel').addEventListener('click', () => { $('#table-editor').hidden = true; });
$('#table-editor').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('#tbl-id').value;
  const name = $('#tbl-name').value.trim().slice(0, 40);
  const text = $('#tbl-text').value.trim();
  if (!name || !text) return;
  if (id) {
    const t = state.tables.find((x) => x.id === id);
    if (t) { t.name = name; t.text = text; }
  } else {
    state.tables.push({ id: uid('tbl'), name, text });
  }
  persist();
  $('#table-editor').hidden = true;
  renderCustomTables();
  toast('Table saved');
});

// ===================== SETS VIEW =====================
let selectedSetId = state.activeSet;
function renderIconSelect(current) {
  const sel = $('#set-icon');
  sel.innerHTML = '';
  for (const icon of SET_ICONS) sel.append(el('option', { value: icon }, [icon]));
  sel.value = current;
}
function renderSets() {
  const list = $('#sets-list');
  list.innerHTML = '';
  for (const s of state.sets) {
    list.append(el('li', {
      class: 'set-row', 'aria-selected': String(s.id === selectedSetId),
      onclick: () => { selectedSetId = s.id; renderSets(); renderSetEditor(); },
    }, [
      el('span', { class: 'sicon' }, [s.icon]),
      el('span', { class: 'sname' }, [s.name]),
      el('span', { class: 'scount' }, [`${s.rolls.length} rolls`]),
      el('button', {
        class: 'link-btn danger', type: 'button',
        onclick: (ev) => {
          ev.stopPropagation();
          if (state.sets.length <= 1) { toast('Keep at least one set'); return; }
          if (!confirm(`Delete the "${s.name}" set?`)) return;
          state.sets = state.sets.filter((x) => x.id !== s.id);
          if (state.activeSet === s.id) state.activeSet = state.sets[0].id;
          if (selectedSetId === s.id) selectedSetId = state.sets[0].id;
          persist();
          renderSets(); renderSetEditor(); renderSetChips(); renderQuickRolls();
        },
      }, ['✕']),
    ]));
  }
}
function selectedSet() {
  return state.sets.find((s) => s.id === selectedSetId) || state.sets[0];
}
function renderSetEditor() {
  const s = selectedSet();
  if (!s) { $('#set-editor-panel').hidden = true; return; }
  $('#set-editor-panel').hidden = false;
  renderIconSelect(s.icon);
  $('#set-name').value = s.name;
  const list = $('#rolls-list');
  list.innerHTML = '';
  for (const r of s.rolls) {
    list.append(el('li', { class: 'roll-row' }, [
      el('span', { class: 'rname' }, [r.name]),
      el('span', { class: 'rexpr' }, [r.expr]),
      el('button', { type: 'button', title: 'Remove', onclick: () => { s.rolls = s.rolls.filter((x) => x.id !== r.id); persist(); renderSetEditor(); if (s.id === state.activeSet) renderQuickRolls(); } }, ['✕']),
    ]));
  }
}
$('#set-icon').addEventListener('change', (e) => { selectedSet().icon = e.target.value; persist(); renderSets(); if (selectedSetId === state.activeSet) renderSetChips(); });
$('#set-name').addEventListener('input', (e) => { selectedSet().name = e.target.value.slice(0, 30) || 'Untitled'; persist(); renderSets(); if (selectedSetId === state.activeSet) renderSetChips(); });
$('#btn-new-set').addEventListener('click', () => {
  const s = { id: uid('set'), name: 'New Set', icon: '🎲', rolls: [] };
  state.sets.push(s);
  selectedSetId = s.id;
  persist();
  renderSets(); renderSetEditor();
  $('#set-name').focus(); $('#set-name').select();
});
$('#add-roll').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#new-roll-name').value.trim();
  const expr = $('#new-roll-expr').value.trim();
  const err = validate(expr);
  if (err) { $('#add-roll-hint').textContent = err; $('#add-roll-hint').classList.add('error'); return; }
  $('#add-roll-hint').textContent = '';
  $('#add-roll-hint').classList.remove('error');
  selectedSet().rolls.push({ id: uid('r'), name: name.slice(0, 40), expr: expr.slice(0, 80) });
  persist();
  renderSetEditor();
  if (selectedSetId === state.activeSet) renderQuickRolls();
  $('#new-roll-name').value = ''; $('#new-roll-expr').value = '';
  $('#new-roll-name').focus();
});
$('#new-roll-expr').addEventListener('input', (e) => {
  const err = validate(e.target.value.trim());
  $('#add-roll-hint').textContent = e.target.value.trim() ? (err || '') : '';
  $('#add-roll-hint').classList.toggle('error', !!err);
});

$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([exportSets(state)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'grimoire-sets.json' });
  document.body.append(a);
  a.click();
  a.remove();
  toast('Exported');
});
$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const n = importSets(state, text);
    persist();
    renderSets(); renderSetChips(); renderQuickRolls(); renderCustomTables();
    toast(`Imported ${n} item${n === 1 ? '' : 's'}`);
  } catch (err) {
    toast('Could not read that file');
  } finally {
    e.target.value = '';
  }
});
$('#btn-reset-sets').addEventListener('click', () => {
  if (!confirm('Replace all your roll sets with the defaults? Custom sets will be lost.')) return;
  state.sets = JSON.parse(JSON.stringify(DEFAULT_SETS));
  state.activeSet = state.sets[0].id;
  selectedSetId = state.activeSet;
  persist();
  renderSets(); renderSetEditor(); renderSetChips(); renderQuickRolls();
  toast('Restored default sets');
});

// ===================== Install prompt =====================
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  $('#btn-install').hidden = false;
});
$('#btn-install').addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $('#btn-install').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#btn-install').hidden = true; });

function updateOfflineBadge() {
  $('#offline-badge').hidden = navigator.onLine;
}
window.addEventListener('online', updateOfflineBadge);
window.addEventListener('offline', updateOfflineBadge);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ===================== Init =====================
applyTheme();
applySeedUI();
setTab(state.tab || 'dice');
renderStdDice();
renderSetChips();
renderQuickRolls();
renderHistory();
renderDeckTypeSelect();
renderDrawn();
renderGenerators();
renderBuiltinTables();
renderCustomTables();
renderSets();
renderSetEditor();
updateOfflineBadge();
