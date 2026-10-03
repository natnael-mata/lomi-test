'use client';

/**
 * A page that renders the app at a literal pixel width (T-269).
 *
 * **Because `resize_window` lies.** Two independent QA passes reported it
 * returning "Successfully resized" while the rendered viewport never moved —
 * confirmed against `read_page`'s own viewport report, not just by eye. So
 * every responsive finding came back caveated: measured at ~2174px, with the
 * whole 390–1024 band unverified. That band is exactly where the navigation's
 * bar-to-pill handover lives, and where the hole this round fixed used to be.
 *
 * The workaround is an iframe at a fixed width, which needs a same-origin page
 * whose markup the tester controls. There was none — `navigate` refuses `data:`
 * URLs, the extension cannot read non-HTML documents, and page zoom is
 * disabled. This is that page.
 *
 * Usage:
 *
 *     /dev-viewport?w=390&path=/practice
 *     /dev-viewport?w=768&path=/today
 *
 * The frame is the *only* thing on the page and carries no chrome of its own,
 * so a screenshot of it is a screenshot of the app at that width. Measurements
 * taken inside — `scrollWidth` against `clientWidth`, element boxes, computed
 * styles — are real layout at real CSS pixels, because the iframe establishes a
 * genuine viewport rather than a scaled one.
 *
 * Same-origin by construction, so the tester can reach into
 * `frames[0].document` and read anything they could read on the page itself.
 */
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

/** Widths worth one click, being the ones the navigation changes shape across. */
const PRESETS = [360, 390, 640, 768, 1023, 1024, 1280, 1440];

const DEFAULT_WIDTH = 390;
const DEFAULT_PATH = '/today';

/** A query value inside sane bounds, or the fallback. */
function bounded(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 200 && n <= 3000 ? n : fallback;
}

export function DevViewport() {
  /*
   * The URL is the state, not a seed for it.
   *
   * This read the query once in a mount effect, which is wrong for a harness:
   * navigating from `?w=390` to `?w=768` is a client-side transition on the
   * same route, so the component is not remounted, the effect does not re-run,
   * and the frame silently keeps the previous width. A probe asked for 768 and
   * measured 390 — which is the exact class of lie the tester is here to escape.
   *
   * `useSearchParams` re-renders on every navigation, so what the URL says is
   * what is rendered. It also makes a measurement reproducible: the width is in
   * the address bar, not in memory.
   */
  const params = useSearchParams();
  const width = bounded(params.get('w'), DEFAULT_WIDTH);
  const height = bounded(params.get('h'), 844);
  const fromQuery = params.get('path');
  // Same-origin only. A harness that will frame any URL is an open redirect
  // with a viewport attached.
  const initialPath = fromQuery?.startsWith('/') && !fromQuery.startsWith('//')
    ? fromQuery
    : DEFAULT_PATH;
  const [path, setPath] = useState(initialPath);

  /** Presets rewrite the URL, so the address bar always describes the frame. */
  const setWidth = (w: number): void => {
    const next = new URLSearchParams(params.toString());
    next.set('w', String(w));
    next.set('path', path);
    window.location.search = next.toString();
  };

  return (
    <div style={{ fontFamily: 'system-ui', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {PRESETS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            style={{
              minHeight: 32,
              padding: '4px 10px',
              border: '1px solid #b6b6b6',
              borderRadius: 8,
              background: w === width ? '#ffe95c' : '#fff',
              font: '13px ui-monospace, monospace',
              cursor: 'pointer',
            }}
          >
            {w}
          </button>
        ))}
        <input
          aria-label="path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          style={{
            minHeight: 32,
            padding: '4px 8px',
            border: '1px solid #b6b6b6',
            borderRadius: 8,
            font: '13px ui-monospace, monospace',
            minWidth: 220,
          }}
        />
        {/* The live numbers, so a reader never has to trust the buttons. */}
        <span style={{ font: '13px ui-monospace, monospace', color: '#46603a' }} data-frame-size="">
          {width} × {height}
        </span>
      </div>

      {/*
        No border, no margin, no shadow. Anything drawn around the frame ends up
        in a screenshot of it and gets measured as part of the app.
      */}
      <iframe
        title="viewport"
        data-viewport-frame=""
        src={path}
        width={width}
        height={height}
        style={{ border: '0', display: 'block', background: '#fff' }}
      />
    </div>
  );
}
