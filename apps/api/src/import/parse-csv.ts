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

/** A row of raw cells, with the 1-based line of the file it started on. */
export interface RawRow {
  cells: string[];
  line: number;
}

/**
 * A typed row, with the line it came from.
 *
 * The line travels with the row rather than being recovered later, because after
 * parsing there is nothing left to recover it from — and "row 3 of the file" is
 * the only handle a person has on a 500-row spreadsheet.
 */
export interface ParsedRow {
  row: ImportRow;
  line: number;
}

/** Splits CSV text into rows of raw cells. No schema knowledge. */
export function splitRows(text: string): string[][] {
  return scanRows(text).map((r) => r.cells);
}

/**
 * The same scan, keeping each row's starting line.
 *
 * Counted while scanning rather than derived from the row's index, because
 * neither is a good proxy for the other: a quoted field can contain newlines, so
 * one row can span five lines, and blank lines are dropped. An error message
 * that names the wrong line is worse than one that names none — it sends
 * somebody to edit an innocent row.
 */
export function scanRows(text: string): RawRow[] {
  // Excel writes a BOM. Left in place it becomes part of the first header name,
  // so `question_id` silently stops matching.
  const input = text.replace(/^\uFEFF/, '');

  const rows: RawRow[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let cellWasQuoted = false;
  let line = 1;
  let rowStartedAt = 1;

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
        // Commas and newlines are literal inside quotes — but a newline is still
        // a newline as far as the file's line numbering goes.
        if (ch === '\n') line++;
        cell += ch;
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
      rows.push({ cells: row, line: rowStartedAt });
      row = [];
      cell = '';
      cellWasQuoted = false;
      line++;
      rowStartedAt = line;
    } else if (ch === '\r') {
      // CRLF — the \n handles the break.
    } else {
      cell += ch;
    }
  }

  // Trailing cell, unless the file simply ended with a newline.
  if (cell !== '' || cellWasQuoted || row.length > 0) {
    row.push(cell);
    rows.push({ cells: row, line: rowStartedAt });
  }

  if (quoted) {
    throw new CsvError('Unterminated quoted field — the file ends mid-quote.');
  }

  return rows.filter((r) => r.cells.some((c) => c.trim() !== ''));
}

/**
 * Parses import CSV text into typed rows, validating the header against the
 * canonical schema first.
 */
export function parseImportCsv(text: string): ParsedRow[] {
  const rows = scanRows(text);
  const header = rows.shift()?.cells;
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

  return rows.map(({ cells, line }) => {
    if (cells.length !== expected.length) {
      throw new CsvError(`Row has ${cells.length} cells, expected ${expected.length}.`, line);
    }
    const row = {} as Record<string, string>;
    expected.forEach((col, idx) => {
      row[col] = cells[idx] ?? '';
    });
    return { row: row as unknown as ImportRow, line };
  });
}
