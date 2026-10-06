// npm run media: prepares files dropped into public/media/audio or public/media/img.
// Audio becomes 64 kbps mono MP3; every file gets a content hash in its name; a file
// that replaces an older version of the same name updates content/**/*.json to match;
// content/media-manifest.json is rebuilt from what's on disk. Needs ffmpeg and ffprobe.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { MediaFile, MediaManifest } from '../src/schema/media';
import { MANIFEST_FILE } from './content';
import {
  AUDIO_SOURCES,
  HASHED_MEDIA_NAME,
  IMAGE_TYPES,
  hashedName,
  sourceName,
} from './media-names';

const run = promisify(execFile);
const root = process.argv[2] ?? process.cwd();
const mediaDir = path.join(root, 'public/media');

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const visible = async (dir: string) =>
  (await readdir(dir).catch(() => [])).filter((f) => !f.startsWith('.'));

async function toMp3(source: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ielts-media-'));
  const out = path.join(dir, 'out.mp3');
  try {
    await run('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      source,
      '-vn',
      '-ac',
      '1',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '64k',
      '-map_metadata',
      '-1',
      out,
    ]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function durationOf(file: string): Promise<number> {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  return Math.round(Number(stdout.trim()) * 10) / 10;
}

/** Swaps an old media path for its replacement in every content JSON file. */
async function rewriteReferences(from: string, to: string): Promise<string[]> {
  const changed: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (
        entry.name.endsWith('.json') &&
        path.resolve(full) !== path.resolve(root, MANIFEST_FILE)
      ) {
        const text = await readFile(full, 'utf8');
        if (text.includes(from)) {
          await writeFile(full, text.split(from).join(to));
          changed.push(path.relative(root, full));
        }
      }
    }
  };
  await walk(path.join(root, 'content'));
  return changed;
}

async function prepare(dir: 'audio' | 'img') {
  const folder = path.join(mediaDir, dir);
  for (const name of await visible(folder)) {
    if (HASHED_MEDIA_NAME.test(name)) continue;
    const parsed = sourceName(name);
    const isAudio = dir === 'audio' && parsed && AUDIO_SOURCES.has(parsed.ext);
    const imageExt = dir === 'img' && parsed ? IMAGE_TYPES.get(parsed.ext) : undefined;
    if (!parsed || (!isAudio && !imageExt)) {
      throw new Error(
        `public/media/${dir}/${name}: unsupported file; expected ${dir === 'audio' ? [...AUDIO_SOURCES].join(', ') : [...IMAGE_TYPES.keys()].join(', ')}`,
      );
    }

    const source = path.join(folder, name);
    const bytes = isAudio ? await toMp3(source) : await readFile(source);
    const ext = isAudio ? 'mp3' : imageExt!;
    const finalName = hashedName(parsed.stem, sha256(bytes), ext);
    await writeFile(path.join(folder, finalName), bytes);
    if (name !== finalName) await rm(source);

    for (const old of await visible(folder)) {
      const match = HASHED_MEDIA_NAME.exec(old);
      if (match?.[1] === parsed.stem && old !== finalName) {
        await rm(path.join(folder, old));
        const changed = await rewriteReferences(
          `/media/${dir}/${old}`,
          `/media/${dir}/${finalName}`,
        );
        console.log(`  replaced ${old}${changed.length ? `; updated ${changed.join(', ')}` : ''}`);
      }
    }
    console.log(`✓ ${dir}/${name} → ${dir}/${finalName}`);
  }
}

await prepare('audio');
await prepare('img');

const files: MediaFile[] = [];
for (const dir of ['audio', 'img'] as const) {
  for (const name of (await visible(path.join(mediaDir, dir))).filter((n) =>
    HASHED_MEDIA_NAME.test(n),
  )) {
    const full = path.join(mediaDir, dir, name);
    const file: MediaFile = {
      path: `/media/${dir}/${name}`,
      kind: dir === 'audio' ? 'audio' : 'image',
      bytes: (await stat(full)).size,
    };
    if (dir === 'audio') file.durationSec = await durationOf(full);
    files.push(file);
  }
}
const manifest: MediaManifest = { files };
await writeFile(path.join(root, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✓ ${MANIFEST_FILE} lists ${files.length} file${files.length === 1 ? '' : 's'}`);
