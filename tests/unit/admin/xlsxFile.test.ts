// @vitest-environment node
import readXlsxFile from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/media-manifest.json';
import sampleJson from '../../../content/tests/book21-test1.json';
import {
  bookToTest,
  templateBook,
  testToBook,
  type Cell,
  type Grid,
} from '../../../src/admin/sheets';
import { toSheets } from '../../../src/admin/xlsx';
import { MediaManifestSchema } from '../../../src/schema/media';
import { TestFileSchema } from '../../../src/schema/test';

const sample = TestFileSchema.parse(sampleJson);
const manifest = MediaManifestSchema.parse(manifestJson);

/** Writes the grids to a real .xlsx file in memory and reads it back, as an upload would. */
async function throughFile(grids: Grid[]): Promise<Grid[]> {
  // tests/unit has no Node types, so the writer's Buffer is typed by hand here.
  const file = writeXlsxFile(toSheets(grids) as never) as unknown as {
    toBuffer: () => Promise<Uint8Array>;
  };
  const buffer = await file.toBuffer();
  const sheets = await readXlsxFile(buffer as never);
  return sheets.map((s) => ({ name: s.sheet, rows: s.data as Cell[][] }));
}

describe('a real .xlsx file', () => {
  it('carries the sample there and back', async () => {
    const { draft, problems } = bookToTest(await throughFile(testToBook(sample)), manifest);
    expect(problems).toEqual([]);
    expect(draft!.sections).toEqual(bookToTest(testToBook(sample), manifest).draft!.sections);
  });

  it('keeps script times as text', async () => {
    const back = await throughFile(testToBook(sample));
    const script = back.find((g) => g.name === 'Script')!;
    expect(script.rows[1]![1]).toBe('0:00');
  });

  it('gives the template every sheet', async () => {
    const back = await throughFile(templateBook());
    expect(back.map((g) => g.name)).toEqual(templateBook().map((g) => g.name));
  });
});
