// Card decks: standard playing cards, Deck of Many Things, and Tarot Major Arcana.
import { cryptoRng, shuffle } from './rng.js';

export const SUITS = [
  { key: 'S', name: 'Spades', sym: '♠', color: 'black' },
  { key: 'H', name: 'Hearts', sym: '♥', color: 'red' },
  { key: 'D', name: 'Diamonds', sym: '♦', color: 'red' },
  { key: 'C', name: 'Clubs', sym: '♣', color: 'black' },
];

export const RANKS = [
  { key: 'A', name: 'Ace', value: 1 },
  { key: '2', name: 'Two', value: 2 },
  { key: '3', name: 'Three', value: 3 },
  { key: '4', name: 'Four', value: 4 },
  { key: '5', name: 'Five', value: 5 },
  { key: '6', name: 'Six', value: 6 },
  { key: '7', name: 'Seven', value: 7 },
  { key: '8', name: 'Eight', value: 8 },
  { key: '9', name: 'Nine', value: 9 },
  { key: '10', name: 'Ten', value: 10 },
  { key: 'J', name: 'Jack', value: 11 },
  { key: 'Q', name: 'Queen', value: 12 },
  { key: 'K', name: 'King', value: 13 },
];

export function standardCards({ jokers = 0 } = {}) {
  const cards = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      cards.push({
        id: `${r.key}${s.key}`,
        kind: 'playing',
        rank: r.key,
        suit: s.sym,
        suitName: s.name,
        color: s.color,
        name: `${r.name} of ${s.name}`,
        label: `${r.key}${s.sym}`,
      });
    }
  }
  for (let i = 0; i < jokers; i++) {
    cards.push({
      id: `JOKER${i + 1}`,
      kind: 'playing',
      rank: '★',
      suit: '',
      suitName: 'Joker',
      color: i % 2 ? 'red' : 'black',
      name: `Joker${jokers > 1 ? ` ${i + 1}` : ''}`,
      label: 'Joker',
      joker: true,
    });
  }
  return cards;
}

// Adapted from the SRD 5.1 (Wizards of the Coast), CC-BY-4.0. Effects are
// paraphrased summaries; consult the SRD for full rules text.
export const DECK_OF_MANY_THINGS = [
  { name: 'Balance', playing: 'Two of Spades', full: true, sym: '⚖', effect: 'Your mind is wrenched: your alignment changes.' },
  { name: 'Comet', playing: 'Two of Diamonds', full: true, sym: '☄', effect: 'Single-handedly defeat the next hostile monster and gain a level.' },
  { name: 'Donjon', playing: 'Ace of Spades', full: true, sym: '⛓', effect: 'You vanish into an extradimensional prison. Your gear stays behind. Draw no more cards.' },
  { name: 'Euryale', playing: 'Queen of Spades', full: false, sym: '🐍', effect: 'Cursed: −2 to saving throws until a god or the Fates card lifts it.' },
  { name: 'The Fates', playing: 'Ace of Hearts', full: true, sym: '🧵', effect: 'Once, undo a single event as if it never happened.' },
  { name: 'Flames', playing: 'Queen of Clubs', full: false, sym: '🔥', effect: 'A powerful devil becomes your enemy and seeks your ruin.' },
  { name: 'Fool', playing: 'Joker (trademark)', full: true, sym: '🃏', effect: 'Lose 10,000 XP, discard this card, and draw again.' },
  { name: 'Gem', playing: 'Two of Hearts', full: true, sym: '💎', effect: 'Gain 25 pieces of jewellery or 50 gems, each worth 2,000 gp.' },
  { name: 'Idiot', playing: 'Two of Clubs', full: true, sym: '🥴', effect: 'Permanently lose 1d4+1 Intelligence (min 1). You may draw one extra card.' },
  { name: 'Jester', playing: 'Joker (no trademark)', full: false, sym: '🎭', effect: 'Gain 10,000 XP, or draw two additional cards.' },
  { name: 'Key', playing: 'Queen of Hearts', full: false, sym: '🗝', effect: 'A rare or rarer magic weapon you can use appears in your hands.' },
  { name: 'Knight', playing: 'Jack of Hearts', full: false, sym: '🛡', effect: 'A loyal 4th-level fighter appears to serve you until death.' },
  { name: 'Moon', playing: 'Queen of Diamonds', full: false, sym: '🌙', effect: 'You may cast Wish 1d3 times.' },
  { name: 'Rogue', playing: 'Jack of Spades', full: false, sym: '🗡', effect: 'An NPC of the GM\'s choice secretly becomes your enemy.' },
  { name: 'Ruin', playing: 'King of Spades', full: false, sym: '🏚', effect: 'All non-magical wealth and property you own is lost.' },
  { name: 'Skull', playing: 'Jack of Clubs', full: false, sym: '💀', effect: 'An avatar of death fights you to the death. No one may help.' },
  { name: 'Star', playing: 'Jack of Diamonds', full: false, sym: '⭐', effect: 'Increase one ability score by 2 (max 24).' },
  { name: 'Sun', playing: 'King of Diamonds', full: false, sym: '☀', effect: 'Gain 50,000 XP and a wondrous item appears in your hands.' },
  { name: 'Talons', playing: 'Ace of Clubs', full: true, sym: '🦅', effect: 'Every magic item you carry disintegrates. Artifacts are lost instead.' },
  { name: 'Throne', playing: 'King of Hearts', full: false, sym: '👑', effect: 'Gain Persuasion proficiency with double bonus, and a small keep of your own.' },
  { name: 'Vizier', playing: 'Ace of Diamonds', full: true, sym: '🔮', effect: 'Within one year, ask any question and receive a truthful, helpful answer.' },
  { name: 'The Void', playing: 'King of Clubs', full: false, sym: '🕳', effect: 'Your soul is imprisoned far away. You cannot draw more cards.' },
];

export const TAROT_MAJOR = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant',
  'The Lovers', 'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice',
  'The Hanged Man', 'Death', 'Temperance', 'The Devil', 'The Tower', 'The Star', 'The Moon',
  'The Sun', 'Judgement', 'The World',
];

export const DECK_TYPES = [
  { id: 'std52', name: 'Playing cards (52)', build: () => standardCards() },
  { id: 'std54', name: 'Playing cards + 2 Jokers', build: () => standardCards({ jokers: 2 }) },
  {
    id: 'domt22',
    name: 'Deck of Many Things (22)',
    build: () => DECK_OF_MANY_THINGS.map((c, i) => ({ id: `DOMT${i}`, kind: 'domt', ...c, label: c.name })),
  },
  {
    id: 'domt13',
    name: 'Deck of Many Things (13)',
    build: () => DECK_OF_MANY_THINGS.filter((c) => !c.full).map((c, i) => ({ id: `DOMT13-${i}`, kind: 'domt', ...c, label: c.name })),
  },
  {
    id: 'tarot',
    name: 'Tarot: Major Arcana (22)',
    build: () => TAROT_MAJOR.map((name, i) => ({ id: `TAROT${i}`, kind: 'tarot', number: i, name, label: name })),
  },
];

export function deckType(id) {
  return DECK_TYPES.find((d) => d.id === id) || DECK_TYPES[0];
}

/** Create a freshly shuffled deck state. */
export function newDeck(typeId, rng = cryptoRng) {
  const type = deckType(typeId);
  return { type: type.id, cards: shuffle(type.build(), rng), drawn: [] };
}

/** Draw n cards. Returns the drawn cards; mutates the deck. */
export function draw(deck, n, rng = cryptoRng) {
  const out = [];
  for (let i = 0; i < n && deck.cards.length; i++) {
    const c = deck.cards.pop();
    if (c.kind === 'tarot') c.reversed = rng.int(0, 1) === 1;
    deck.drawn.push(c);
    out.push(c);
  }
  return out;
}

/** Return all drawn cards to the deck and reshuffle. */
export function reshuffle(deck, rng = cryptoRng) {
  deck.cards = shuffle(deck.cards.concat(deck.drawn.map((c) => ({ ...c, reversed: undefined }))), rng);
  deck.drawn = [];
  return deck;
}

/** Shuffle only the remaining cards. */
export function shuffleRemaining(deck, rng = cryptoRng) {
  shuffle(deck.cards, rng);
  return deck;
}
