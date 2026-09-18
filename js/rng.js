// Random number sources.
// The default source is the platform CSPRNG (crypto.getRandomValues) with
// rejection sampling so integer ranges are unbiased. A seeded source
// (xmur3 hash + mulberry32) is available for reproducible sessions.

const TWO_32 = 0x100000000;

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / TWO_32;
  };
}

function cryptoUint32() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0];
}

/** Unbiased integer in [min, max] from the CSPRNG. */
function cryptoInt(min, max) {
  const range = max - min + 1;
  if (range <= 0) throw new RangeError('max must be >= min');
  if (range > TWO_32) return min + Math.floor((cryptoUint32() / TWO_32) * range);
  const limit = Math.floor(TWO_32 / range) * range;
  let x;
  do {
    x = cryptoUint32();
  } while (x >= limit);
  return min + (x % range);
}

export const cryptoRng = Object.freeze({
  seeded: false,
  seed: null,
  float: () => cryptoUint32() / TWO_32,
  int: cryptoInt,
});

/** Create a deterministic RNG from a seed string. */
export function seededRng(seed) {
  const next = mulberry32(xmur3(String(seed))());
  return {
    seeded: true,
    seed: String(seed),
    float: next,
    int(min, max) {
      const range = max - min + 1;
      if (range <= 0) throw new RangeError('max must be >= min');
      return min + Math.floor(next() * range);
    },
  };
}

/** Return a seeded RNG for a non-empty seed, otherwise the CSPRNG. */
export function makeRng(seed) {
  return seed == null || String(seed).trim() === '' ? cryptoRng : seededRng(String(seed).trim());
}

/** Build an RNG that replays a fixed list of integers (for tests). */
export function sequenceRng(values) {
  let i = 0;
  return {
    seeded: true,
    seed: 'sequence',
    float: () => values[i++ % values.length] / 100,
    int(min, max) {
      const v = values[i++ % values.length];
      if (v < min || v > max) throw new RangeError(`sequence value ${v} outside [${min}, ${max}]`);
      return v;
    },
  };
}

/** Fisher–Yates shuffle (in place) and return the array. */
export function shuffle(arr, rng = cryptoRng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick one element at random. */
export function pick(arr, rng = cryptoRng) {
  if (!arr.length) return undefined;
  return arr[rng.int(0, arr.length - 1)];
}

/** Pick an index according to positive weights. */
export function pickWeighted(weights, rng = cryptoRng) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  let r = rng.int(1, total);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
