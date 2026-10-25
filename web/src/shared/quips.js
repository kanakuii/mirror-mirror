// The Mirror's voice: smug, a little vain, secretly helpful. It speaks in lilac.
import { numberWord } from './suits.js';

const pick = (list, seed = Math.random()) => list[Math.floor(seed * list.length) % list.length];

export function lobbyQuip(n) {
  if (n === 0) return 'No one yet? I can wait. I am very patient. And very beautiful.';
  if (n === 1) return 'Just one of you? Adorable. This will be quick.';
  return `${numberWord(n)} players? Adorable. I'll go easy on you.`;
}

export const pickQuips = [
  "Pick any! I'll get it anyway. Probably. Mostly.",
  'Take your time. I have already seen the future. It is a potato.',
  'Ooh, the suspense. I love suspense. I am never in it.',
];

export function guessLine(guess, nth) {
  const forms = [
    (g) => `Is it… ${g}?`,
    (g) => `Clearly ${g}.`,
    (g) => `${cap(g)}. I'd bet my frame on it.`,
    (g) => `Obviously ${g}. Next!`,
    (g) => `Hmm. ${cap(g)}?`,
    (g) => `${cap(g)}! Final answer. Probably.`,
  ];
  return forms[nth % forms.length](guess);
}

// Quips with <i> are rendered as HTML, so anything a player wrote must be escaped.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function kingdomWinQuip(prompt, guesses) {
  prompt = esc(prompt);
  if (!guesses.length) return `Hmph. I hadn't even <i>started</i>. That's cheating, surely.`;
  return pick([
    `Hmph. My very next guess was ${prompt}. I was <i>letting</i> you have that one.`,
    `${cap(prompt)}? Obviously. I was being polite.`,
    'Fine. FINE. Enjoy it while it lasts.',
  ]);
}

export function mirrorWinTip() {
  return pick([
    "I can't read your inside jokes, so use them! Draw it the way only <i>you</i> lot would. Ugh, look at me, helping.",
    "Draw the version from <i>that</i> story. You know the one. I don't. That's the point. Ugh, why am I helping?",
    'Strangers see a shape. Friends see a memory. Draw the memory. (Forget I said that.)',
  ]);
}

export function timeUpQuip() {
  return pick([
    'Even I couldn\'t see that. And I see <i>everything</i>.',
    'A masterpiece, surely. Of what, nobody will ever know.',
  ]);
}

export function scoreQuip(k, m) {
  if (k > m) return `${numberWord(k)} to ${m}. I'm told that's called a ‘lead’. Rematch?`;
  if (m > k) return `${numberWord(m)} to ${k}. Mirror, mirror, who's the cleverest of all? Me. It's me.`;
  return `A tie. How tediously fair. Rematch?`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
