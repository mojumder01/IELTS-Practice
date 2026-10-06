// Answer matching (SPEC section 7, "Answer matching"). Pure functions.

/** Rule 1: trim, lower-case, collapse spaces, curly to straight quotes, drop trailing full stops. */
export function normalise(answer: string): string {
  return answer
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '')
    .trim();
}

/** Words in an answer as typed; hyphenated words and numbers count as one. */
export function wordCount(answer: string): number {
  return answer.trim() === '' ? 0 : answer.trim().split(/\s+/).length;
}

/** Rule 4: over the group's word limit is wrong, even if the right word is in there. */
export function overWordLimit(answer: string, maxWords: number | undefined): boolean {
  return maxWords !== undefined && wordCount(answer) > maxWords;
}

/** Rule 2: "(the) envelope" accepts "envelope" and "the envelope". */
export function expandOptional(accepted: string): string[] {
  const match = /\(([^)]*)\)/.exec(accepted);
  if (!match) return [accepted];
  const before = accepted.slice(0, match.index);
  const after = accepted.slice(match.index + match[0].length);
  return [...expandOptional(before + match[1] + after), ...expandOptional(before + after)];
}

const UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORDINAL_UNITS: Record<string, string> = {
  first: 'one',
  second: 'two',
  third: 'three',
  fifth: 'five',
  eighth: 'eight',
  ninth: 'nine',
  twelfth: 'twelve',
};

function ordinalToCardinal(word: string): string {
  if (ORDINAL_UNITS[word]) return ORDINAL_UNITS[word];
  if (word.endsWith('ieth')) return word.slice(0, -4) + 'y'; // twentieth → twenty
  if (word.endsWith('th')) return word.slice(0, -2); // fourteenth → fourteen, hundredth → hundred
  return word;
}

/** Reads "14", "14th", "1,000", "fourteen", "fourteenth", "thirty-eight", "two hundred and five". */
export function parseNumber(text: string): number | null {
  const t = normalise(text);
  const digits = /^(\d{1,3}(?:,\d{3})+|\d+)(?:st|nd|rd|th)?$/.exec(t);
  if (digits) return Number(digits[1]!.replace(/,/g, ''));
  const words = t
    .replace(/-/g, ' ')
    .split(' ')
    .filter((w) => w && w !== 'and')
    .map(ordinalToCardinal);
  if (words.length === 0) return null;
  let total = 0;
  let current = 0;
  for (const word of words) {
    const unit = UNITS.indexOf(word);
    const ten = TENS.indexOf(word);
    if (unit >= 0) current += unit;
    else if (ten >= 2) current += ten * 10;
    else if (word === 'hundred') current = (current || 1) * 100;
    else if (word === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
    } else return null;
  }
  return total + current;
}

/**
 * One answer against one question number's accepted list (rules 1–5, 7). Spelling is exact;
 * TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN never match each other because they differ as text.
 */
export function isCorrect(answer: string, accepted: string[], maxWords?: number): boolean {
  if (answer.trim() === '' || overWordLimit(answer, maxWords)) return false;
  const given = normalise(answer);
  const givenNumber = parseNumber(answer);
  return accepted.some((alternative) =>
    expandOptional(alternative).some((form) => {
      if (normalise(form) === given) return true;
      const wanted = parseNumber(form);
      return wanted !== null && givenNumber === wanted; // rule 3: digits or words
    }),
  );
}

/**
 * Rule 6, paired items ("Choose TWO", numbers 21–22): each correct letter scores one mark in any
 * order, and a letter used twice scores once. Returns whether each number's answer earns a mark.
 */
export function markPaired(answers: string[], acceptedLists: string[][]): boolean[] {
  const correct = new Set(acceptedLists.flat().map(normalise));
  const used = new Set<string>();
  return answers.map((answer) => {
    const letter = normalise(answer);
    if (!letter || !correct.has(letter) || used.has(letter)) return false;
    used.add(letter);
    return true;
  });
}
