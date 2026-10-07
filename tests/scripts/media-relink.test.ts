// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { currentFile, mediaStem, relinkSection } from '../../scripts/media-relink';
import type { MediaManifest } from '../../src/schema/media';

const manifest: MediaManifest = {
  files: [
    { path: '/media/audio/b22t1-p1.aaaaaaaa.mp3', kind: 'audio', bytes: 10, durationSec: 402.5 },
    { path: '/media/img/b22t1-w1.bbbbbbbb.png', kind: 'image', bytes: 10 },
  ],
};

describe('media relinking', () => {
  it('finds a file by its name, whatever version or upload name is given', () => {
    expect(mediaStem('/media/audio/B22T1 P1.12345678.mp3')).toBe('b22t1-p1');
    expect(currentFile('/media/audio/b22t1-p1.mp3', manifest)?.path).toBe(
      '/media/audio/b22t1-p1.aaaaaaaa.mp3',
    );
    expect(currentFile('/media/audio/b22t1-p1.12345678.mp3', manifest)?.path).toBe(
      '/media/audio/b22t1-p1.aaaaaaaa.mp3',
    );
    // An image name never matches audio, and the other way round.
    expect(currentFile('/media/audio/b22t1-w1.png', manifest)).toBeUndefined();
    expect(currentFile('/media/audio/', manifest)).toBeUndefined();
  });

  it('points a listening part at the current audio and takes its length', () => {
    const section = {
      kind: 'listening',
      part: 1,
      audio: '/media/audio/b22t1-p1.mp3',
      durationSec: 1,
    };
    expect(relinkSection(section, manifest)).toEqual({
      ...section,
      audio: '/media/audio/b22t1-p1.aaaaaaaa.mp3',
      durationSec: 402.5,
    });
  });

  it('points Writing Task 1 at the current image', () => {
    const section = {
      kind: 'writing',
      task1: { prompt: 'x', image: '/media/img/b22t1-w1.png', imageDescription: '', minWords: 150 },
      task2: { prompt: 'y', minWords: 250 },
    };
    expect(relinkSection(section, manifest)).toEqual({
      ...section,
      task1: { ...section.task1, image: '/media/img/b22t1-w1.bbbbbbbb.png' },
    });
  });

  it('leaves sections alone when nothing changes', () => {
    expect(
      relinkSection(
        { kind: 'listening', audio: '/media/audio/b22t1-p1.aaaaaaaa.mp3', durationSec: 402 },
        manifest,
      ),
    ).toBeNull();
    expect(
      relinkSection(
        { kind: 'listening', audio: '/media/audio/b22t1-p1.aaaaaaaa.mp3', durationSec: 402.5 },
        manifest,
      ),
    ).toBeNull();
    expect(
      relinkSection(
        { kind: 'listening', audio: '/media/audio/other.mp3', durationSec: 5 },
        manifest,
      ),
    ).toBeNull();
    expect(relinkSection({ kind: 'reading', title: 'x' }, manifest)).toBeNull();
    expect(
      relinkSection({ kind: 'writing', task1: { image: 'data:image/png;base64,AA' } }, manifest),
    ).toBeNull();
  });
});
