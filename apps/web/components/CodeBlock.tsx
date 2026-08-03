/**
 * Code shown with a question (T-116).
 *
 * DESIGN.md: "code sits in its own well, separate from prose." Two reasons, and
 * only one of them is aesthetic:
 *
 * - Code is read differently from prose. Monospaced, on its own ground, it is
 *   scannable; wrapped into a paragraph it is noise.
 * - **It must not push the page sideways.** A CSS rule or a SQL statement is
 *   easily wider than 375px, and a page that scrolls horizontally on a phone
 *   makes every other element on it hard to read. The well scrolls; the page
 *   never does.
 *
 * `white-space: pre` rather than `pre-wrap`: wrapping code changes what it says.
 * An indented block that rewraps mid-line is a different program to a student
 * trying to read it.
 */
export interface CodeBlockProps {
  code: string;
  /** For a screen reader — "the CSS this question is about". */
  label?: string | undefined;
}

export function CodeBlock({ code, label = 'Code for this question' }: CodeBlockProps) {
  return (
    <div
      data-code-block=""
      // tabIndex so a keyboard user can scroll it; a scrollable region that
      // cannot be focused is unreachable without a mouse.
      tabIndex={0}
      role="region"
      aria-label={label}
      className="bg-surface-2 rounded-card overflow-x-auto p-3"
    >
      <pre className="text-caption w-max font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
