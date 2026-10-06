import { splitSentences } from '../schema/checks';

/** Where each sentence sits in a paragraph, using the same split as the admin locator. */
export function sentenceRanges(paragraph: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let from = 0;
  for (const sentence of splitSentences(paragraph)) {
    const start = paragraph.indexOf(sentence, from);
    ranges.push({ start, end: start + sentence.length });
    from = start + sentence.length;
  }
  return ranges;
}

export interface Highlight {
  sentence: number; // 1-based
  text: string;
  question: number;
}

export interface HighlightRange {
  start: number;
  end: number;
  question: number;
  /** True when the words weren't found and the whole sentence is marked instead. */
  wholeSentence: boolean;
}

/**
 * Character ranges to mark for revealed answers. Matching is exact; if the words are missing,
 * the whole sentence is marked and a warning is logged (SPEC section 7).
 */
export function highlightRanges(paragraph: string, highlights: Highlight[]): HighlightRange[] {
  const sentences = sentenceRanges(paragraph);
  const ranges: HighlightRange[] = [];
  for (const h of highlights) {
    const sentence = sentences[h.sentence - 1];
    if (!sentence) {
      console.warn(`Question ${h.question}: sentence ${h.sentence} doesn't exist`);
      continue;
    }
    const at = paragraph.slice(sentence.start, sentence.end).indexOf(h.text);
    if (at >= 0) {
      ranges.push({
        start: sentence.start + at,
        end: sentence.start + at + h.text.length,
        question: h.question,
        wholeSentence: false,
      });
    } else {
      console.warn(
        `Question ${h.question}: "${h.text}" isn't in sentence ${h.sentence}; marking the whole sentence`,
      );
      ranges.push({ ...sentence, question: h.question, wholeSentence: true });
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}
