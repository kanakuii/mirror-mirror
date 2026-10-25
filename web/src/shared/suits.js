// Guests are playing cards; each suit has its own ink (design turn 7).
export const SUITS = {
  hearts: { sym: '♥', color: '#B33A4C' },
  spades: { sym: '♠', color: '#2F6B70' },
  diamonds: { sym: '♦', color: '#6A4FA0' },
  clubs: { sym: '♣', color: '#3F7A55' },
};
export const SUIT_ORDER = ['hearts', 'spades', 'diamonds', 'clubs'];

// A stable little tilt per player so the card table looks hand-dealt.
export function tiltFor(id = '') {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 13) - 6);
}

export const fmtTime = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const NUMBER_WORDS = ['No one', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
export const numberWord = (n) => NUMBER_WORDS[n] ?? String(n);
