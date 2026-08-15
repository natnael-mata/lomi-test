'use client';

/**
 * Bulk question upload (PLAN.md § 4.6).
 *
 * **The screen that decides whether the people who own the content can do their
 * own job.** Until this existed, loading questions meant shell access to the
 * server and a developer running the CLI — so every content change went through
 * an engineer.
 *
 * Two things it must say plainly, because both protect the student:
 *
 * - **Nothing uploaded reaches anybody until a reviewer publishes it.** Every
 *   row lands `DRAFT` whatever the file claims (T-054). Somebody uploading a
 *   thousand rows should know they have not just gone live.
 * - **A rejected row says why, and names its line.** The whole content strategy
 *   is import everything now and close the gaps in review — so a rejection is an
 *   ordinary event, and the only useless version of it is one that does not say
 *   which row or what was wrong.
 */
import { useCallback, useState } from 'react';

import { Card } from '../../../components/Card';
import { Chip } from '../../../components/Chip';
import { StatedFigure } from '../../../components/StatedFigure';
import { ApiError, api, type ImportReport } from '../../../lib/api';
import { copy } from '../../../lib/i18n';

type State =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'done'; report: ImportReport }
  | { kind: 'error'; message: string };

export function ImportScreen() {
  const c = copy();
  const [csv, setCsv] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const readFile = useCallback(async (file: File): Promise<void> => {
    // Read in the browser rather than posting multipart: the file is a few
    // hundred KB of UTF-8, and text keeps the request something an operator can
    // paste back when describing a failure.
    setCsv(await file.text());
    setState({ kind: 'idle' });
  }, []);

  const upload = useCallback(async (): Promise<void> => {
    if (csv.trim().length === 0) return;
    setState({ kind: 'uploading' });
    try {
      const report = await api.adminImportCsv(csv);
      setState({ kind: 'done', report });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof ApiError ? error.message : c.importer.couldNotUpload,
      });
    }
  }, [c.importer.couldNotUpload, csv]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">{c.importer.title}</h1>
        {/* Said before they upload, not after. */}
        <p className="text-body text-ink-2">{c.importer.intro}</p>
      </header>

      <Card as="section" className="flex flex-col gap-3">
        <label className="text-caption text-ink-2 uppercase" htmlFor="csv-file">
          {c.importer.pickFile}
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
          }}
        />

        <label className="text-caption text-ink-2 mt-2 uppercase" htmlFor="csv-text">
          {c.importer.orPaste}
        </label>
        <textarea
          id="csv-text"
          className="field min-h-32 font-mono text-sm"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <p className="text-caption text-ink-2">{c.importer.formatHint}</p>

        <button
          type="button"
          className="btn-primary"
          onClick={() => void upload()}
          disabled={state.kind === 'uploading' || csv.trim().length === 0}
        >
          {state.kind === 'uploading' ? c.importer.uploading : c.importer.upload}
        </button>
      </Card>

      {state.kind === 'error' ? <p className="text-body text-wrong">{state.message}</p> : null}

      {state.kind === 'done' ? <Report report={state.report} /> : null}
    </div>
  );
}

function Report({ report }: { report: ImportReport }) {
  const c = copy();
  const rejected = report.rows.filter((r) => r.action === 'rejected');

  if (report.read === 0) {
    return <p className="text-body">{c.importer.nothingRead}</p>;
  }

  return (
    <section className="flex flex-col gap-3">
      {/*
        Stated figures, not a total bar. Read is not the sum of the other three
        in any meaningful sense — a row can be read and rejected — and a bar
        claiming they add up would be a claim somebody could check and find
        false.
      */}
      <div className="grid grid-cols-2 gap-2">
        <StatedFigure
          label={c.importer.read}
          value={String(report.read)}
          derivation={c.importer.formatHint}
        />
        <StatedFigure
          label={c.importer.created}
          value={String(report.created)}
          derivation={c.importer.allTaken}
        />
      </div>

      <p className="text-body">
        {rejected.length === 0 ? c.importer.allTaken : c.importer.someRejected(rejected.length)}
      </p>

      {rejected.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rejected.map((row) => (
            <li key={`${row.line}-${row.stableId}`} className="bg-surface-2 rounded-card p-3">
              <div className="flex items-center gap-2">
                <span className="text-label num">{row.stableId || '—'}</span>
                {/* The line number, because that is how a person finds the row
                    again in their spreadsheet. */}
                <Chip tone="pending">{c.importer.line(row.line)}</Chip>
              </div>
              <ul className="mt-1 flex flex-col gap-0.5">
                {row.messages.map((message) => (
                  <li key={message} className="text-caption text-ink-2">
                    {message}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
