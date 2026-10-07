import type { Cell, Grid } from './sheets';

// Reading and writing .xlsx files for bulk upload. The libraries load only when an admin uses
// them, so they stay out of the student pages' bundle.

/** Every sheet in an uploaded workbook. */
export async function readBook(file: Blob): Promise<Grid[]> {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file);
  return sheets.map((s) => ({ name: s.sheet, rows: s.data as Cell[][] }));
}

/** Empty rows given the text format under each text column, so typed times stay text. */
const TEXT_ROWS = 300;

/** The writer's sheets: bold headers, text-formatted time columns, widths and a frozen header. */
export function toSheets(grids: Grid[]) {
  return grids.map((g) => {
    const text = new Set(g.textColumns ?? []);
    const width = Math.max(...g.rows.map((r) => r.length));
    const rowCount = text.size ? Math.max(g.rows.length, TEXT_ROWS) : g.rows.length;
    const data = Array.from({ length: rowCount }, (_, i) =>
      Array.from({ length: width }, (_, j) => {
        const value = g.rows[i]?.[j] ?? null;
        if (i === 0) {
          return { value: value === null ? '' : String(value), fontWeight: 'bold' as const };
        }
        if (text.has(j)) {
          return { value: value === null ? '' : String(value), type: String, format: '@' };
        }
        if (value === null || value === '') return null;
        return { value, wrap: typeof value === 'string' && value.length > 40 };
      }),
    );
    return {
      sheet: g.name,
      data,
      columns: g.widths?.map((w) => ({ width: w })),
      stickyRowsCount: 1,
    };
  });
}

/** Saves the workbook to the device as `fileName`. */
export async function downloadBook(grids: Grid[], fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(toSheets(grids) as Parameters<typeof writeXlsxFile>[0]).toFile(fileName);
}
