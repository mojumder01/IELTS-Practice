/** A media file after npm run media: "<stem>.<8 hex>.<ext>", e.g. b21t1-p1.8f3c09ab.mp3. */
export const HASHED_MEDIA_NAME =
  /^([a-z0-9]+(?:-[a-z0-9]+)*)\.([0-9a-f]{8})\.(mp3|png|jpg|webp|svg)$/;

export const AUDIO_SOURCES = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac']);
export const IMAGE_TYPES = new Map([
  ['png', 'png'],
  ['jpg', 'jpg'],
  ['jpeg', 'jpg'],
  ['webp', 'webp'],
  ['svg', 'svg'],
]);

/** "B21T1 P1.WAV" → { stem: "b21t1-p1", ext: "wav" }; null if nothing usable is left. */
export function sourceName(fileName: string): { stem: string; ext: string } | null {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = fileName.slice(dot + 1).toLowerCase();
  const stem = fileName
    .slice(0, dot)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return stem ? { stem, ext } : null;
}

export function hashedName(stem: string, sha256Hex: string, ext: string): string {
  return `${stem}.${sha256Hex.slice(0, 8)}.${ext}`;
}
