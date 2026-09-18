// Dice expression parser and roller.
//
// Grammar (whitespace ignored, case-insensitive):
//   roll    := (INT 'x')? expr ('x' INT)?
//   expr    := term (('+' | '-') term)*
//   term    := factor (('*' | '/') factor)*
//   factor  := '(' expr ')' | '-' factor | dice | INT
//   dice    := INT? 'd' (INT | '%' | 'f') mod*
//   mod     := ('kh' | 'kl' | 'dh' | 'dl' | 'k' | 'd') INT?
//            | 'adv' | 'dis'
//            | '!!' cond? | '!' cond?
//            | ('ro' | 'r') cond
//            | 'min' INT | 'max' INT
//   cond    := ('<=' | '>=' | '<' | '>' | '=')? INT
//
// Semantics:
//   kh/kl N  keep highest/lowest N     dh/dl N  drop highest/lowest N
//   k N = kh N                          d N = dl N
//   adv      roll one extra die, drop the lowest (d20adv == 2d20dl1)
//   dis      roll one extra die, drop the highest
//   !        exploding dice (a new die is added when the condition hits; default: max face)
//   !!       compounding explode (extra rolls are added into the same die)
//   r        reroll while the condition holds (bounded)   ro  reroll once
//   min/max  clamp each die to a minimum / maximum face value
//   / is integer division rounded down (D&D style). x N repeats the whole roll N times.

import { cryptoRng } from './rng.js';

export class DiceError extends Error {
  constructor(message, pos) {
    super(message);
    this.name = 'DiceError';
    this.pos = pos;
  }
}

export const LIMITS = Object.freeze({
  maxDice: 1000,
  maxSides: 1000000,
  maxRepeat: 100,
  maxExplosions: 200,
  maxRerolls: 100,
});

const ALIASES = {
  adv: 'd20adv',
  advantage: 'd20adv',
  dis: 'd20dis',
  disadvantage: 'd20dis',
  stats: '4d6dl1x6',
  coin: 'd2',
  '%': 'd100',
};

const KEEP_MODS = new Set(['kh', 'kl', 'dh', 'dl']);

class Parser {
  constructor(src) {
    this.src = src;
    this.i = 0;
  }
  atEnd() {
    return this.i >= this.src.length;
  }
  eat(s) {
    if (this.src.startsWith(s, this.i)) {
      this.i += s.length;
      return true;
    }
    return false;
  }
  peekIs(re) {
    return re.test(this.src.slice(this.i));
  }
  int() {
    const m = /^\d+/.exec(this.src.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return parseInt(m[0], 10);
  }
  fail(msg) {
    throw new DiceError(msg, this.i);
  }

  parseRoll() {
    if (this.atEnd()) this.fail('Enter a dice expression, e.g. 2d6+3');
    let repeat = null;
    const lead = /^(\d+)[x×](?=.)/.exec(this.src);
    if (lead) {
      repeat = parseInt(lead[1], 10);
      this.i = lead[0].length;
    }
    const expr = this.parseExpr();
    if (this.eat('x') || this.eat('×')) {
      if (repeat != null) this.fail('Repeat count given twice');
      repeat = this.int();
      if (repeat == null) this.fail('Expected a number after "x"');
    }
    if (!this.atEnd()) this.fail(`Unexpected "${this.src[this.i]}" at position ${this.i + 1}`);
    if (repeat == null) repeat = 1;
    if (repeat < 1) this.fail('Repeat count must be at least 1');
    if (repeat > LIMITS.maxRepeat) this.fail(`Repeat count is limited to ${LIMITS.maxRepeat}`);
    return { t: 'roll', expr, repeat };
  }
  parseExpr() {
    let l = this.parseTerm();
    for (;;) {
      if (this.eat('+')) l = { t: 'bin', op: '+', l, r: this.parseTerm() };
      else if (this.eat('-') || this.eat('−')) l = { t: 'bin', op: '-', l, r: this.parseTerm() };
      else return l;
    }
  }
  parseTerm() {
    let l = this.parseFactor();
    for (;;) {
      if (this.eat('*')) l = { t: 'bin', op: '*', l, r: this.parseFactor() };
      else if (this.eat('/')) l = { t: 'bin', op: '/', l, r: this.parseFactor() };
      else return l;
    }
  }
  parseFactor() {
    if (this.eat('(')) {
      const e = this.parseExpr();
      if (!this.eat(')')) this.fail('Missing closing parenthesis');
      return { t: 'paren', e };
    }
    if (this.eat('-') || this.eat('−')) return { t: 'neg', e: this.parseFactor() };
    const start = this.i;
    const n = this.int();
    if (this.peekIs(/^d(\d|%|f)/)) {
      this.i += 1;
      return this.parseDice(n == null ? 1 : n, start);
    }
    if (n == null) {
      if (this.atEnd()) this.fail('Expression ends unexpectedly');
      this.fail(`Unexpected "${this.src[this.i]}" at position ${this.i + 1}`);
    }
    return { t: 'num', v: n };
  }
  parseDice(count, start) {
    let sides;
    if (this.eat('%')) sides = 100;
    else if (this.eat('f')) sides = 'F';
    else sides = this.int();
    if (count < 1) throw new DiceError('You need at least one die', start);
    if (count > LIMITS.maxDice) throw new DiceError(`At most ${LIMITS.maxDice} dice per group`, start);
    if (sides !== 'F' && sides < 1) throw new DiceError('Dice need at least one side', start);
    if (sides !== 'F' && sides > LIMITS.maxSides) throw new DiceError(`At most ${LIMITS.maxSides} sides`, start);
    const mods = [];
    for (;;) {
      const m = this.parseMod();
      if (!m) break;
      mods.push(m);
    }
    return { t: 'dice', n: count, sides, mods };
  }
  parseCond(required, defaultCmp = '=') {
    let cmp = null;
    for (const c of ['<=', '>=', '<', '>', '=']) {
      if (this.eat(c)) {
        cmp = c;
        break;
      }
    }
    const v = this.int();
    if (v == null) {
      if (cmp || required) this.fail('Expected a number for the condition');
      return null;
    }
    return { cmp: cmp || defaultCmp, v };
  }
  parseMod() {
    for (const k of ['kh', 'kl', 'dh', 'dl']) {
      if (this.eat(k)) {
        const n = this.int();
        return { k, n: n == null ? 1 : n };
      }
    }
    if (this.eat('adv')) return { k: 'adv' };
    if (this.eat('dis')) return { k: 'dis' };
    if (this.peekIs(/^k\d/)) {
      this.i += 1;
      return { k: 'kh', n: this.int() };
    }
    if (this.peekIs(/^d\d/)) {
      this.i += 1;
      return { k: 'dl', n: this.int() };
    }
    if (this.eat('!!')) return { k: 'explode', compound: true, cond: this.parseCond(false, '>=') };
    if (this.eat('!')) return { k: 'explode', compound: false, cond: this.parseCond(false, '>=') };
    if (this.eat('ro')) return { k: 'reroll', once: true, cond: this.parseCond(true, '=') };
    if (this.peekIs(/^r[<>=\d]/)) {
      this.i += 1;
      return { k: 'reroll', once: false, cond: this.parseCond(true, '=') };
    }
    if (this.eat('min')) {
      const v = this.int();
      if (v == null) this.fail('Expected a number after "min"');
      return { k: 'min', v };
    }
    if (this.eat('max')) {
      const v = this.int();
      if (v == null) this.fail('Expected a number after "max"');
      return { k: 'max', v };
    }
    return null;
  }
}

/** Parse an expression into an AST. Throws DiceError on bad input. */
export function parse(input) {
  let src = String(input ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');
  if (ALIASES[src]) src = ALIASES[src];
  return new Parser(src).parseRoll();
}

/** Quick validity check. Returns null if fine, otherwise the error message. */
export function validate(input) {
  try {
    parse(input);
    return null;
  } catch (e) {
    return e instanceof DiceError ? e.message : String(e);
  }
}

function condText(c) {
  if (!c) return '';
  return (c.cmp === '=' ? '' : c.cmp) + c.v;
}

function modText(m) {
  switch (m.k) {
    case 'kh':
    case 'kl':
    case 'dh':
    case 'dl':
      return m.k + m.n;
    case 'adv':
    case 'dis':
      return m.k;
    case 'explode':
      return (m.compound ? '!!' : '!') + condText(m.cond);
    case 'reroll':
      return (m.once ? 'ro' : 'r') + condText(m.cond);
    case 'min':
    case 'max':
      return m.k + m.v;
    default:
      return '';
  }
}

/** Canonical text form of an AST node. */
export function normalize(node) {
  switch (node.t) {
    case 'roll':
      return normalize(node.expr) + (node.repeat > 1 ? ` x${node.repeat}` : '');
    case 'num':
      return String(node.v);
    case 'dice':
      return `${node.n}d${node.sides}${node.mods.map(modText).join('')}`;
    case 'paren':
      return `(${normalize(node.e)})`;
    case 'neg':
      return `-${normalize(node.e)}`;
    case 'bin':
      return `${normalize(node.l)} ${node.op === '*' ? '×' : node.op === '/' ? '÷' : node.op} ${normalize(node.r)}`;
    default:
      return '';
  }
}

/** True if the expression contains at least one dice group. */
export function hasDice(node) {
  switch (node.t) {
    case 'roll':
      return hasDice(node.expr);
    case 'dice':
      return true;
    case 'paren':
    case 'neg':
      return hasDice(node.e);
    case 'bin':
      return hasDice(node.l) || hasDice(node.r);
    default:
      return false;
  }
}

function test(cond, v) {
  switch (cond.cmp) {
    case '<':
      return v < cond.v;
    case '<=':
      return v <= cond.v;
    case '>':
      return v > cond.v;
    case '>=':
      return v >= cond.v;
    default:
      return v === cond.v;
  }
}

function faceText(sides, v) {
  if (sides === 'F') return v > 0 ? '+' : v < 0 ? '−' : '0';
  return String(v);
}

function rollFace(rng, sides) {
  return sides === 'F' ? rng.int(-1, 1) : rng.int(1, sides);
}

function makeDie(sides, value, fromExplode = false) {
  return { sides, value, rerolls: [], exploded: false, kept: true, fromExplode, crit: null };
}

function rollGroup(node, rng) {
  const { sides } = node;
  const maxFace = sides === 'F' ? 1 : sides;
  let n = node.n;
  const mods = node.mods.slice();
  // adv / dis: add a die and drop the worst / best one.
  for (const m of mods) {
    if (m.k === 'adv' || m.k === 'dis') n += 1;
  }
  const dice = [];
  for (let i = 0; i < n; i++) dice.push(makeDie(sides, rollFace(rng, sides)));

  for (const m of mods) {
    if (m.k !== 'reroll') continue;
    for (const d of dice) {
      let tries = 0;
      const limit = m.once ? 1 : LIMITS.maxRerolls;
      while (tries < limit && test(m.cond, d.value)) {
        d.rerolls.push(d.value);
        d.value = rollFace(rng, sides);
        tries++;
      }
    }
  }

  for (const m of mods) {
    if (m.k !== 'explode') continue;
    const cond = m.cond || { cmp: '>=', v: maxFace };
    let budget = LIMITS.maxExplosions;
    if (m.compound) {
      for (const d of dice) {
        let last = d.value;
        while (budget > 0 && test(cond, last)) {
          last = rollFace(rng, sides);
          d.value += last;
          d.exploded = true;
          budget--;
        }
      }
    } else {
      const queue = dice.slice();
      while (queue.length && budget > 0) {
        const d = queue.shift();
        if (test(cond, d.value)) {
          d.exploded = true;
          const nd = makeDie(sides, rollFace(rng, sides), true);
          dice.push(nd);
          queue.push(nd);
          budget--;
        }
      }
    }
  }

  for (const m of mods) {
    if (m.k === 'min') for (const d of dice) if (d.value < m.v) d.value = m.v;
    if (m.k === 'max') for (const d of dice) if (d.value > m.v) d.value = m.v;
  }

  for (const m of mods) {
    let k = m.k;
    let amount = m.n;
    if (k === 'adv') {
      k = 'dl';
      amount = 1;
    } else if (k === 'dis') {
      k = 'dh';
      amount = 1;
    }
    if (!KEEP_MODS.has(k)) continue;
    const alive = dice.filter((d) => d.kept);
    const sorted = alive.slice().sort((a, b) => a.value - b.value); // ascending
    let toDrop;
    if (k === 'kh') toDrop = sorted.slice(0, Math.max(0, alive.length - amount));
    else if (k === 'kl') toDrop = sorted.slice(Math.min(alive.length, amount));
    else if (k === 'dh') toDrop = sorted.slice(Math.max(0, alive.length - amount));
    else toDrop = sorted.slice(0, Math.min(alive.length, amount));
    for (const d of toDrop) d.kept = false;
  }

  if (sides === 20) {
    for (const d of dice) {
      if (d.value === 20) d.crit = 'nat20';
      else if (d.value === 1) d.crit = 'nat1';
    }
  }

  for (const d of dice) d.face = faceText(sides, d.value);

  const total = dice.reduce((s, d) => (d.kept ? s + d.value : s), 0);
  return { notation: normalize(node), sides, dice, total };
}

function groupText(g) {
  const parts = g.dice.map((d) => {
    let s = d.face;
    if (d.rerolls.length) s = d.rerolls.map((v) => faceText(g.sides, v)).join('→') + '→' + s;
    if (d.exploded) s += '!';
    if (!d.kept) s = `(${s})`;
    return s;
  });
  return `${g.notation} [${parts.join(', ')}]`;
}

function evalNode(node, ctx) {
  switch (node.t) {
    case 'num':
      return { value: node.v, text: String(node.v) };
    case 'paren': {
      const r = evalNode(node.e, ctx);
      return { value: r.value, text: `(${r.text})` };
    }
    case 'neg': {
      const r = evalNode(node.e, ctx);
      return { value: -r.value, text: `-${r.text}` };
    }
    case 'dice': {
      const g = rollGroup(node, ctx.rng);
      ctx.groups.push(g);
      return { value: g.total, text: groupText(g) };
    }
    case 'bin': {
      const l = evalNode(node.l, ctx);
      const r = evalNode(node.r, ctx);
      let value;
      let sym = node.op;
      if (node.op === '+') value = l.value + r.value;
      else if (node.op === '-') value = l.value - r.value;
      else if (node.op === '*') {
        value = l.value * r.value;
        sym = '×';
      } else {
        if (r.value === 0) throw new DiceError('Division by zero');
        value = Math.floor(l.value / r.value);
        sym = '÷';
      }
      return { value, text: `${l.text} ${sym} ${r.text}` };
    }
    default:
      throw new DiceError('Bad expression');
  }
}

/**
 * Roll an expression.
 * Returns { input, notation, repeat, results: [{ total, text, groups }], grand }.
 */
export function roll(input, { rng = cryptoRng } = {}) {
  const ast = parse(input);
  const results = [];
  for (let k = 0; k < ast.repeat; k++) {
    const ctx = { rng, groups: [] };
    const r = evalNode(ast.expr, ctx);
    results.push({ total: r.value, text: r.text, groups: ctx.groups });
  }
  return {
    input: String(input),
    notation: normalize(ast),
    repeat: ast.repeat,
    results,
    grand: results.reduce((s, r) => s + r.total, 0),
    isDice: hasDice(ast),
  };
}

/** One-line plain-text summary of a roll result. */
export function formatRoll(res) {
  if (res.repeat === 1) {
    const r = res.results[0];
    return `${r.text} = ${r.total}`;
  }
  return res.results.map((r, i) => `#${i + 1}: ${r.text} = ${r.total}`).join('\n') + `\nSum: ${res.grand}`;
}

/** Statistical range of a plain NdS(+M) style expression (for hints). */
export function quickStats(input) {
  try {
    const ast = parse(input);
    const range = (node) => {
      switch (node.t) {
        case 'num':
          return [node.v, node.v];
        case 'dice': {
          if (node.mods.some((m) => m.k === 'explode')) return null;
          let n = node.n;
          for (const m of node.mods) if (m.k === 'adv' || m.k === 'dis') n += 1;
          let kept = n;
          for (const m of node.mods) {
            if (m.k === 'kh' || m.k === 'kl') kept = Math.min(kept, m.n);
            if (m.k === 'dh' || m.k === 'dl') kept = Math.max(0, kept - m.n);
            if (m.k === 'adv' || m.k === 'dis') kept = Math.max(0, kept - 1);
          }
          const lo = node.sides === 'F' ? -1 : 1;
          const hi = node.sides === 'F' ? 1 : node.sides;
          return [kept * lo, kept * hi];
        }
        case 'paren':
          return range(node.e);
        case 'neg': {
          const r = range(node.e);
          return r && [-r[1], -r[0]];
        }
        case 'bin': {
          const a = range(node.l);
          const b = range(node.r);
          if (!a || !b) return null;
          if (node.op === '+') return [a[0] + b[0], a[1] + b[1]];
          if (node.op === '-') return [a[0] - b[1], a[1] - b[0]];
          const c = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
          if (node.op === '*') return [Math.min(...c), Math.max(...c)];
          return null;
        }
        default:
          return null;
      }
    };
    const r = range(ast.expr);
    return r ? { min: r[0], max: r[1], repeat: ast.repeat } : null;
  } catch {
    return null;
  }
}
