# CONTENT-PIPELINE.md — Question Bank

## Headline

The MoE material is real and valuable — ~8 fields of genuine exit-exam questions —
but **none of it is import-ready**. The files are in inconsistent formats and, more
importantly, two of the app's headline features depend on data that mostly **isn't in
these files yet**:

- **Explanations** — the training mode promises "why correct / why wrong." There are
  essentially **zero** authored explanations in any file.
- **Per-topic tags** — the results-by-topic feature needs each question tagged to a
  course/topic. **None** of the questions are tagged (we only know the field, from the
  filename).

A third gap: **answer keys are only partial** — several fields have no correct answers
at all.

So getting from these files to the app is a **content-engineering pipeline**, not a
one-time upload. Below is the raw assessment, the target schema, and how to close the gaps.

---

## 1. Raw file assessment

Counts are approximate — extraction gaps and inconsistent numbering make exact counts unreliable.

| File (field)              | ~Questions | Answer key     | Explanations | Topic tags | Format / condition |
|---------------------------|-----------|----------------|--------------|------------|--------------------|
| Accounting & Finance      | ~62–102   | **Full**       | None         | None       | Moodle "attempt review" export — clean, "The correct answer is: …". Many multi-line numeric scenarios. |
| Computer Science          | ~95       | **Full** (`Ans.`) | None      | None       | Mostly clean; some OCR noise ("Question 2Answer"); includes code blocks. |
| Public Health (HO)        | ~75       | **Full** (`Ans.`) | None      | None       | Clean, consistent. |
| Exit Model 2015 (IT/multimedia) | ~96 | **None**       | None         | None       | Numbered, a–d options; inconsistent lettering; some question numbers skipped. |
| Geography                 | ~36       | **None**       | None         | None       | Clean options, no answers. |
| Economics (MoE 2023)      | ~90+      | **None**       | None         | None       | OCR, one question per page; **formulas corrupted** (e.g. `y, = 0.75' yp`) — math unreliable. |
| Biology                   | partial   | ~4 only        | None         | None       | Partial extraction; most answers missing. |
| Management                | few usable| few worked     | few (embedded "Assistant" text) | None | Heavily corrupted — repeated page headers, form-feeds, chat interjections mixed in. |

**Cross-cutting noise to strip:** repeated running headers, form-feed (`\f`) characters,
"Question N" concatenated onto option text, double lettering ("A. a."), OCR artifacts,
skipped/duplicated numbers, and (in Management) an AI assistant's answer text pasted into
the file.

---

## 2. Canonical import schema

Every question, from every file, is normalized into this one shape. This is what the
admin bulk-importer targets (see `question_import_template.csv`).

| Column         | Required | Notes |
|----------------|----------|-------|
| `question_id`  | yes      | Stable ID, e.g. `CS-0001`. |
| `field`        | yes      | Computer Science, Biology, … (from source file). |
| `course`       | yes*     | e.g. Data Structures & Algorithms. **Needs tagging.** |
| `topic`        | optional | Finer grain, e.g. Sorting. **Needs tagging.** |
| `question_text`| yes      | Cleaned stem. |
| `code_block`   | optional | For CS/code questions; kept separate from prose. |
| `option_a..d`  | yes      | Four options, letters normalized to a–d. |
| `correct_option` | yes*   | One of a/b/c/d. **Missing in several files.** |
| `explanation`  | yes*     | Why correct + why the wrong ones are wrong. **Missing everywhere.** |
| `difficulty`   | optional | easy/medium/hard. |
| `source`       | yes      | Origin file. |
| `year`         | optional | Exam year. |
| `status`       | yes      | Workflow flag (below). |

`*` = required for a question to go **live**, but the importer accepts it blank so
partial questions can be staged and finished in the admin queue.

### `status` values (the content workflow)
- `raw` — imported, not yet cleaned
- `needs_answer` — no verified correct option
- `needs_explanation` — no explanation authored
- `needs_topic_review` — course/topic not confirmed
- `ready` — passed review, safe to serve

Statuses can combine (e.g. `needs_answer;needs_explanation`). Only `ready` questions
appear in training/exam. This lets you **import everything now** and finish it over time.

---

## 3. Closing the three gaps

### Gap A — Answers (missing for Geography, Economics, Exit-2015, most of Biology)
An exam-prep app that tells students the wrong answer is worse than useless. So:
- Where the file has answers → parse and keep.
- Where missing → a **subject-matter reviewer supplies the answer**; optionally AI drafts
  a proposed answer, but a human must confirm before `ready`. Never auto-publish a guessed
  answer.

### Gap B — Explanations (missing everywhere)
This is the largest effort. Recommended: **AI-drafted + expert-reviewed**.
- AI drafts an explanation per question (correct rationale + why each distractor is wrong).
- Reviewer edits/approves. Only then → `ready`.
- **Fallback for a faster V1:** training mode can launch showing the correct answer *without*
  explanation, with explanations rolling out per field afterward. (Trades off the headline
  "why" feature for speed — your call.)

### Gap C — Topic tags (missing everywhere)
Needed for the results-by-topic feature.
- Define a **course/topic taxonomy per field** first (e.g. CS → DSA, DB, Web, OS, Networks,
  SE, PM…). MoE's exit-exam blueprint per program is the natural source.
- AI proposes `course`/`topic` per question against that taxonomy; reviewer confirms.

---

## 4. Recommended workflow

```
raw .md files
   → 1. CLEAN     (strip headers/form-feeds/OCR noise, split into discrete questions)
   → 2. PARSE     (map to canonical schema per source format; one parser per format family)
   → 3. STAGE     (bulk-import as `raw`/`needs_*`, nothing live yet)
   → 4. ENRICH    (AI drafts answers where missing + explanations + topic tags)
   → 5. REVIEW    (subject-matter reviewer confirms in admin queue → `ready`)
   → 6. PUBLISH   (`ready` questions serve to training + exam)
```

Build the **admin review queue** as part of Phase 1 — it's the tool that turns this messy
input into a trustworthy bank, and you'll use it continuously as more exams come in.

### Practical starting point
1. Start with the **three fields that already have answer keys** — Computer Science,
   Public Health, Accounting & Finance — so the first live content only needs
   explanations + topic tags, not answer authoring.
2. Lock the taxonomy for those three fields.
3. Stand up the importer + review queue, run those three through the pipeline, launch the
   trial (10 free questions) from real `ready` content.
4. Bring the answer-less fields (Geography, Economics, Exit-2015, Biology, Management) in
   behind them, since they need answer authoring first.
