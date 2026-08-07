/**
 * Removes comments from a source file, for the source-lint tests.
 *
 * Several tests in this workspace assert that a file does *not* contain some
 * string — `localStorage`, `% of exam`, `Authorization`. Those files also
 * explain, at length, why they avoid exactly those things, so a naive check
 * flags the note documenting its own rule. A lint that cannot tell a rule from
 * its explanation gets weakened rather than obeyed.
 *
 * **The order of the passes is the whole point.** It has been wrong twice:
 *
 * 1. Removing block comments first lets a line comment mentioning a path like
 *    `/api` + `/*` open a block that swallows everything up to the next close
 *    marker. The code under test disappears and the ban passes on an empty
 *    string — which is how this was found, with a real check silently disabled.
 * 2. Dropping `*`-prefixed lines before removing blocks strips a doc comment's
 *    body and its closing marker, leaving the opener orphaned to swallow the
 *    rest of the file the same way.
 *
 * So: line comments, then blocks, then any stray continuation lines. Every test
 * using this must also assert that something near the *end* of the file
 * survived — a guard that only checks the beginning passes happily while the
 * stripper eats everything after the first awkward comment.
 *
 * Not imported by any runtime module, so it is never bundled.
 */
export function stripComments(source: string): string {
  const withoutLineComments = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

  const withoutBlocks = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, '');

  return withoutBlocks
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('*') && !trimmed.startsWith('{/*');
    })
    .join('\n');
}
