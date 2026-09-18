import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, roll, normalize, validate, formatRoll, quickStats, DiceError } from '../js/dice.js';
import { sequenceRng, seededRng, makeRng, cryptoRng, shuffle, pickWeighted } from '../js/rng.js';

const seq = (...v) => sequenceRng(v);

test('parses plain numbers and dice', () => {
  assert.equal(normalize(parse('2d6+3')), '2d6 + 3');
  assert.equal(normalize(parse('d20')), '1d20');
  assert.equal(normalize(parse(' D 20 ')), '1d20');
  assert.equal(normalize(parse('d%')), '1d100');
  assert.equal(normalize(parse('4dF')), '4dF');
  assert.equal(normalize(parse('4d6dl1 x6')), '4d6dl1 x6');
  assert.equal(normalize(parse('6x4d6dl1')), '4d6dl1 x6');
  assert.equal(normalize(parse('(1d4+1)*3')), '(1d4 + 1) × 3');
});

test('aliases', () => {
  assert.equal(normalize(parse('adv')), '1d20adv');
  assert.equal(normalize(parse('dis')), '1d20dis');
  assert.equal(normalize(parse('stats')), '4d6dl1 x6');
});

test('rejects bad input with helpful errors', () => {
  assert.throws(() => parse(''), DiceError);
  assert.throws(() => parse('2d'), DiceError);
  assert.throws(() => parse('d0'), DiceError);
  assert.throws(() => parse('0d6'), DiceError);
  assert.throws(() => parse('2d6+'), DiceError);
  assert.throws(() => parse('(2d6'), DiceError);
  assert.throws(() => parse('hello'), DiceError);
  assert.throws(() => parse('2000d6'), DiceError);
  assert.throws(() => parse('d6 x 0'), DiceError);
  assert.equal(validate('2d6+3'), null);
  assert.match(validate('2d6+'), /ends unexpectedly/);
});

test('sums dice and modifiers', () => {
  const r = roll('2d6+3', { rng: seq(4, 5) });
  assert.equal(r.results[0].total, 12);
  assert.equal(r.results[0].text, '2d6 [4, 5] + 3');
  assert.equal(formatRoll(r), '2d6 [4, 5] + 3 = 12');
  assert.equal(r.isDice, true);
});

test('keep highest / drop lowest', () => {
  let r = roll('4d6dl1', { rng: seq(1, 6, 3, 5) });
  assert.equal(r.results[0].total, 14);
  assert.equal(r.results[0].text, '4d6dl1 [(1), 6, 3, 5]');
  r = roll('2d20kh1', { rng: seq(7, 15) });
  assert.equal(r.results[0].total, 15);
  r = roll('2d20kl1', { rng: seq(7, 15) });
  assert.equal(r.results[0].total, 7);
  r = roll('3d6dh1', { rng: seq(2, 6, 4) });
  assert.equal(r.results[0].total, 6);
  r = roll('4d6k3', { rng: seq(1, 6, 3, 5) });
  assert.equal(r.results[0].total, 14);
  r = roll('4d6d1', { rng: seq(1, 6, 3, 5) });
  assert.equal(r.results[0].total, 14);
  // keeping more than exist keeps everything
  r = roll('2d6kh5', { rng: seq(2, 3) });
  assert.equal(r.results[0].total, 5);
});

test('advantage and disadvantage add one die', () => {
  let r = roll('d20adv', { rng: seq(3, 17) });
  assert.equal(r.results[0].groups[0].dice.length, 2);
  assert.equal(r.results[0].total, 17);
  r = roll('d20dis+5', { rng: seq(3, 17) });
  assert.equal(r.results[0].total, 8);
  r = roll('2d20adv', { rng: seq(3, 17, 9) });
  assert.equal(r.results[0].total, 26);
});

test('exploding dice', () => {
  let r = roll('1d6!', { rng: seq(6, 6, 2) });
  assert.equal(r.results[0].total, 14);
  assert.equal(r.results[0].groups[0].dice.length, 3);
  assert.equal(r.results[0].text, '1d6! [6!, 6!, 2]');
  r = roll('1d6!!', { rng: seq(6, 6, 2) });
  assert.equal(r.results[0].total, 14);
  assert.equal(r.results[0].groups[0].dice.length, 1);
  r = roll('1d6!>=5', { rng: seq(5, 1) });
  assert.equal(r.results[0].total, 6);
  // explosion budget is bounded
  r = roll('1d1!', { rng: seq(1) });
  assert.ok(r.results[0].total <= 201);
});

test('rerolls', () => {
  let r = roll('2d6ro<3', { rng: seq(1, 5, 2) });
  assert.equal(r.results[0].total, 7);
  assert.equal(r.results[0].text, '2d6ro<3 [1→2, 5]');
  r = roll('2d6r<3', { rng: seq(1, 2, 2, 4, 6) });
  assert.equal(r.results[0].total, 10);
  r = roll('1d6r1', { rng: seq(1, 1, 3) });
  assert.equal(r.results[0].total, 3);
});

test('min and max clamp faces', () => {
  const r = roll('2d6min3', { rng: seq(1, 5) });
  assert.equal(r.results[0].total, 8);
  const r2 = roll('2d6max2', { rng: seq(1, 5) });
  assert.equal(r2.results[0].total, 3);
});

test('arithmetic', () => {
  let r = roll('(1d4+1)*3', { rng: seq(2) });
  assert.equal(r.results[0].total, 9);
  r = roll('10/3');
  assert.equal(r.results[0].total, 3);
  assert.equal(r.isDice, false);
  r = roll('-1d4', { rng: seq(3) });
  assert.equal(r.results[0].total, -3);
  r = roll('2d6-1d4', { rng: seq(3, 4, 2) });
  assert.equal(r.results[0].total, 5);
  assert.throws(() => roll('1d6/0'), /Division by zero/);
});

test('repeats', () => {
  const r = roll('4d6dl1 x6', { rng: seededRng('abc') });
  assert.equal(r.repeat, 6);
  assert.equal(r.results.length, 6);
  for (const res of r.results) {
    assert.ok(res.total >= 3 && res.total <= 18);
    assert.equal(res.groups[0].dice.filter((d) => d.kept).length, 3);
  }
  assert.equal(r.grand, r.results.reduce((s, x) => s + x.total, 0));
});

test('fudge dice', () => {
  const r = roll('4dF', { rng: seq(-1, 0, 1, 1) });
  assert.equal(r.results[0].total, 1);
  assert.equal(r.results[0].text, '4dF [−, 0, +, +]');
});

test('crit flags on d20 only', () => {
  const r = roll('1d20+1d6', { rng: seq(20, 6) });
  assert.equal(r.results[0].groups[0].dice[0].crit, 'nat20');
  assert.equal(r.results[0].groups[1].dice[0].crit, null);
  const r2 = roll('1d20', { rng: seq(1) });
  assert.equal(r2.results[0].groups[0].dice[0].crit, 'nat1');
});

test('quickStats gives ranges', () => {
  assert.deepEqual(quickStats('2d6+3'), { min: 5, max: 15, repeat: 1 });
  assert.deepEqual(quickStats('4d6dl1'), { min: 3, max: 18, repeat: 1 });
  assert.deepEqual(quickStats('d20adv'), { min: 1, max: 20, repeat: 1 });
  assert.equal(quickStats('d6!'), null);
  assert.equal(quickStats('garbage'), null);
});

test('crypto rng stays in range and seeded rng is deterministic', () => {
  for (let i = 0; i < 2000; i++) {
    const v = cryptoRng.int(1, 6);
    assert.ok(v >= 1 && v <= 6);
  }
  const a = seededRng('seed').int(1, 1000000);
  const b = seededRng('seed').int(1, 1000000);
  assert.equal(a, b);
  assert.equal(makeRng('').seeded, false);
  assert.equal(makeRng(' x ').seeded, true);
  const arr = shuffle([1, 2, 3, 4, 5], seededRng('s'));
  assert.deepEqual(arr.slice().sort(), [1, 2, 3, 4, 5]);
  assert.equal(pickWeighted([0, 0, 5], seededRng('w')), 2);
});
