import { sentenceAt, vocabForm, wordAt } from '../../engine/srs';

/** The word under a point, inside an element marked data-word-root, with its sentence. */
export function wordFromPoint(x: number, y: number): { word: string; sentence: string } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let node: Node | null = null;
  let offset = 0;
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) {
    node = position.offsetNode;
    offset = position.offset;
  } else {
    const range = doc.caretRangeFromPoint?.(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (node?.nodeType !== Node.TEXT_NODE) return null;
  const root = node.parentElement?.closest('[data-word-root]');
  if (!root) return null;
  // Where the point falls in the root's whole text, across highlight marks.
  const before = document.createRange();
  before.setStart(root, 0);
  before.setEnd(node, offset);
  const at = before.toString().length;
  const text = root.textContent ?? '';
  const found = wordAt(text, at);
  return found ? { word: vocabForm(found.word), sentence: sentenceAt(text, at) } : null;
}
