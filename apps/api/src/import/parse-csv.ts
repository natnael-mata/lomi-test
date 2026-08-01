/**
 * CSV parsing for the question importer.
 *
 * RFC4180: fields may be quoted, quoted fields may contain commas, newlines and
 * escaped `""`. Written by hand rather than pulled in as a dependency because
 * the input is one known 16-column schema and the failure modes need to name a
 * row number — a generic parser's "unexpected token" helps nobody staring at a
 * 500-row export from a ministry paper.
 */
import { IMPORT_COLUMNS, type ImportRow } from './csv-schema';

export class CsvError extends Error {
  constructor(
    message: string,
    readonly line?: number,
  ) {
    super(message);
    this.name = 'CsvError';
  }
}

/** Splits CSV text into rows of raw cells. No schema knowledge. */
export function splitRows(text: string): string[][] {
  // Excel writes a BOM. Left in place it becomes part of the first header name,
  // so `question_id` silently stops matching.
  const input = text.replace(/^\uFEFF/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let cellWasQuoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"'; // escaped quote
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch; // commas and newlines are literal inside quotes
      }
      continue;
    }

    if (ch === '"' && cell === '') {
      quoted = true;
      cellWasQuoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
      cellWasQuoted = false;
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      cellWasQuoted = false;
    } else if (ch === '\r') {
      // CRLF — the \n handles the break.
    } else {
      cell += ch;
    }
  }

  // Trailing cell, unless the file simply ended with a newline.
  if (cell !== '' || cellWasQuoted || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (quoted) {
    throw new CsvError('Unterminated quoted field — the file ends mid-quote.');
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * Parses import CSV text into typed rows, validating the header against the
 * canonical schema first.
 */
export function parseImportCsv(text: string): ImportRow[] {
  const rows = splitRows(text);
  const header = rows.shift();
  if (!header) throw new CsvError('File is empty.');

  const expected = [...IMPORT_COLUMNS];
  if (header.length !== expected.length || header.some((h, i) => h.trim() !== expected[i])) {
    // Name the difference rather than dumping both lists: a reordered or
    // renamed column would otherwise be read as a different field entirely.
    const missing = expected.filter((c) => !header.map((h) => h.trim()).includes(c));
    const unexpected = header.map((h) => h.trim()).filter((h) => !expected.includes(h as never));
    const detail = [
      missing.length ? `missing: ${missing.join(', ')}` : '',
      unexpected.length ? `unexpected: ${unexpected.join(', ')}` : '',
      !missing.length && !unexpected.length ? 'columns are out of order' : '',
    ]
      .filter(Boolean)
      .join('; ');
    throw new CsvError(`Header does not match the import schema (${detail}).`, 1);
  }

  return rows.map((cells, i) => {
    const lineNo = i + 2; // 1-based, and the header was line 1
    if (cells.length !== expected.length) {
      throw new CsvError(`Row has ${cells.length} cells, expected ${expected.length}.`, lineNo);
    }
    const row = {} as Record<string, string>;
    expected.forEach((col, idx) => {
      row[col] = cells[idx] ?? '';
    });
    return row as unknown as ImportRow;
  });
}
