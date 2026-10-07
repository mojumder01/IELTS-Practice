// The Media workflow's first step: moves files uploaded to media-inbox/ on GitHub into
// public/media/audio or public/media/img by type, for npm run media to convert and hash.
// Cambridge book audio is renamed on the way (inboxName): "Cambridge IELTS 10.1.2.mp3" → b10t1-p2.
import { readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { AUDIO_SOURCES, IMAGE_TYPES, inboxName, sourceName } from './media-names';

const root = process.argv[2] ?? process.cwd();
const inbox = path.join(root, 'media-inbox');
const moved: string[] = [];
const refused: string[] = [];

for (const name of await readdir(inbox).catch(() => [])) {
  if (name.startsWith('.') || name.toLowerCase() === 'readme.md') continue;
  const parsed = sourceName(name);
  const dir =
    parsed && AUDIO_SOURCES.has(parsed.ext)
      ? 'audio'
      : parsed && IMAGE_TYPES.has(parsed.ext)
        ? 'img'
        : null;
  if (!dir) {
    refused.push(name);
    continue;
  }
  const target = inboxName(name);
  await rename(path.join(inbox, name), path.join(root, 'public/media', dir, target));
  moved.push(`${dir}/${target}${target === name ? '' : ` (uploaded as ${name})`}`);
}

for (const m of moved) console.log(`  ${m}`);
if (refused.length) {
  console.error(
    `Not audio or an image: ${refused.join(', ')}. Audio: ${[...AUDIO_SOURCES].join(', ')}; images: ${[...IMAGE_TYPES.keys()].join(', ')}.`,
  );
  process.exit(1);
}
console.log(`✓ ${moved.length} file${moved.length === 1 ? '' : 's'} moved from media-inbox/`);
