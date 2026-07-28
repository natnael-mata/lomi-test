# Lomi-Test (ሎሚ)

Exit-exam preparation for Ethiopian university students. Practice questions where **every
answer is fully explained**, timed mock exams that mirror the real sitting, per-topic readiness,
and a study plan counting down to exam day. Web PWA + Telegram Mini App from one codebase, plus
a Telegram bot.

## The one rule

**Never show an answer the product cannot defend.** An unverified answer stays unpublished. For
exam prep, a confidently wrong answer key is worse than a missing question. Everything below
exists to hold that line.

## Read these before writing code

| File | What it governs |
|---|---|
| `PRODUCT.md` | Product truth — users, capabilities, constraints, confirmed decisions. |
| `DESIGN.md` | The visual system — tokens, type, components, do's and don'ts. |
| `design-system/tailwind-theme.css` | Normative Tailwind v4 `@theme`. Paste into `globals.css`. |
| `TASK.md` | **The build backlog.** 173 micro-tasks, each with its own test. Start here. |
| `docs/PLAN.md` | Original product brief. Superseded by `PRODUCT.md` where they disagree. |
| `docs/CONTENT-PIPELINE.md` | State of the source question files and how to get them live. |
| `docs/question_import_template.csv` | Canonical 16-column import schema, with worked examples. |

## How to build this

Work `TASK.md` top to bottom. One task at a time. Run its test. Only then tick the box.

```bash
# tell Claude Code:
"Read TASK.md and start from the first unchecked task."
```

Do not batch tasks, and never tick a box you have not actually tested.

## Confirmed decisions

- **Name:** Lomi-Test (ሎሚ). Assets: `apps/web/public/brand/lomi-test-*`.
- **Launch fields:** Computer Science, Public Health, Accounting & Finance — the only three
  source files that arrived with usable answer keys.
- **Plans:** 6 months Br 500 · 12 months Br 800, measured from activation.
- **Mock exam:** 100 questions, 180 minutes. Pacing budgets 60s concept / 180s calculation,
  which implies a 60/40 concept-to-calculation mix.
- **Identity:** signup is light (phone + OTP, or Telegram). Fayda binds once, at purchase.
- **Retakers:** captured via `isRetaker`, but drives no behaviour yet.
- **No official blueprint exists.** Topic weights are *derived* from the observed share of
  questions in past papers. Student-facing copy says **"share of past papers"**, never
  "% of exam".

## Still open

- Does a plan grant one field or all fields? (`TASK.md` T-141b)
- verify.et credentials and the response field that authorises activation.
- Fayda relying-party approval from the National ID Program.

## Related

The earlier implementation lives at `../exitexam` — a working NestJS + Prisma API, Next.js web
app and grammY bot, roughly 11 of 12 planned weeks in. Its API, schema, publish gate, payments
and bot are proven and worth porting rather than rewriting. Its UI predates the current
`DESIGN.md` and is superseded by it.
