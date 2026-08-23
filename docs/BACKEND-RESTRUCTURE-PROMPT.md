# Prompt: the backend restructure

Hand this to a fresh session working in `/home/beki-dev/dev/lomi-test`. It is written to be
read on its own — everything it needs is stated or named by file.

---

You are working on **Lomi-Exams**, a NestJS + Prisma + PostgreSQL API with a Next.js web app
in the same npm workspace repo. Read `CLAUDE.md`, `PRODUCT.md` and `TASK.md` before you
start; the working protocol in `TASK.md` applies to everything below.

The **front end for this work is already designed and partly built**. Read
`docs/design/HANDOFF.md` first — it records every decision, what is shipped, what is
designed-only, and which decisions reverse something in `PRODUCT.md`. Do not re-derive
those decisions. Where this prompt and `HANDOFF.md` disagree, `HANDOFF.md` is newer.

**Baseline rule.** `npm test`, `npm run lint`, `npm run typecheck` and `npm run build` must
all be green before you tick anything. Run `npm run db:dev` in its own terminal first.

---

## What the product became

It was one exam (a university exit exam, one Field per degree subject). It is now **four
kinds of exam programme**, and the schema has to carry that:

| Track                | Exam draws on | Year columns |
| -------------------- | ------------- | ------------ |
| Grade 6              | grades 4–6    | 3            |
| Grade 8              | grades 7–8    | 2            |
| Grade 12 Natural     | grades 9–12   | 4            |
| Grade 12 Social      | grades 9–12   | 4            |
| University exit exam | —             | 0            |

The existing `Field → Course → Topic → Question` taxonomy already fits: **Field** is the
track, **Course** is the subject, and `Field.examDate` already carries the countdown. Do not
invent a new hierarchy.

---

## Task 1 — `sourceGrade` on Question

**Do this first. It gets more expensive every day** — the owner is uploading spreadsheets
now, and retrofitting a column across a filled bank is the costly version.

Add `sourceGrade Int?` to `Question`. It is the school year the question came from: 9–12 for
Grade 12, 7–8 for Grade 8, 4–6 for Grade 6, `null` for the university exit exam.

It exists so the product can tell a student **"your weakness is Grade 10 Chemistry"** rather
than "your weakness is Chemistry". One is an instruction; the other is a shrug. It is the
single highest-value column in the design.

Also add it to `docs/question_import_template.csv` as a 17th column, and to the importer and
its validation: within a Field, a `sourceGrade` outside that track's span is a rejection, not
a warning.

**Test:** a question imported with `sourceGrade` outside its Field's year span is rejected
with a named reason; one inside is accepted and readable back.

---

## Task 2 — Grade 12 is two Fields

Seed **Grade 12 Natural** and **Grade 12 Social** as separate Fields.

Not one. A Natural candidate never sits Geography or History, so a single Grade 12 Field puts
questions they will never see into the denominator of their coverage figure — which is then
permanently wrong in a way they cannot detect.

`User.fieldId` stays a **study choice, not an entitlement boundary** (`PRODUCT.md` T-141b:
a plan grants the whole product, priced by duration only). Changing track must not require
paying again. Do not reopen the pricing decision.

**Test:** a user on Grade 12 Natural gets a question count that excludes every Social-only
Course.

---

## Task 3 — coverage, and what "beaten" means

The headline figure is no longer a weighted mean. It is **coverage**: of the questions in
your track, how many have you beaten, against a target of **80%**.

**A question is beaten when the student answered it correctly AND named the reason.** Not
when they guessed right.

This is load-bearing, not pedantry. The exam is drawn from a question bank, so questions
repeat — sometimes verbatim, sometimes with the numbers changed. A student who memorises the
letter passes the app and fails the paper, and a coverage figure built on lucky guesses would
be the product lying in the most damaging way available to it.

The second half uses content that already exists: after a correct answer, sometimes ask
_why_ it is right, with the question's own `conceptLine` among plausible alternatives drawn
from the `whyWrong` texts. Store both outcomes on the attempt.

Endpoints needed:

- `GET /me/coverage?fieldId=` → `{ total, beaten, targetPct: 80, toTarget, daysToExam, perDay }`
  where `perDay = ceil(toTarget / daysToExam)`, and **per-subject and per-`sourceGrade`
  breakdowns**.
- The per-`sourceGrade` breakdown is the "which year is holding you back" diagnostic. Return
  the year span from the Field so the client does not hard-code four columns — it is 2 for
  Grade 8 and 3 for Grade 6.

**Test:** a correct answer with the reason wrong does not increment `beaten`. Deleting that
condition must fail a named test.

---

## Task 4 — SMS sign-up (replaces Telegram-first)

**Phone → SMS OTP → set password → sign in → choose track → practise.** Profile comes later.

`User.phone` and `User.phoneVerifiedAt` already exist. `displayName` (public) and `name`
(private) already exist. Add `passwordHash`, the profile fields, and an OTP table.

Four constraints, all of which have bitten products doing this before:

1. **Link Telegram, do not replace it.** Phone becomes the identity; Telegram becomes a
   linked channel. Deleting it discards a finished phase (Mini App, daily-question bot,
   referrals) and the only good account-recovery path — a student who changes SIM otherwise
   loses everything.
2. **Do not block practice on the profile.** Name, school, region and gender come after the
   student has used the product, and only where they buy something (the school leaderboard).
   A wall of personal questions before the first question is a conversion killer and
   contradicts `PRODUCT.md`'s "signup stays light".
3. **Collect less from children.** Grade 6 is eleven years old, and the parent — not the
   student — is the buyer and the consent. Region plus school supports every leaderboard and
   analysis worth building. Take wereda on senior tracks only.
4. **Rate-limit the OTP send.** Per phone AND per IP, a resend cooldown, an attempt cap per
   code, and a short expiry. Every SMS costs money, and an unthrottled send endpoint is how
   a telecom balance disappears overnight. This is not a follow-up task.

**Password reset is part of this task, not a later one.** See `docs/design/HANDOFF.md` §12b
for the designed flow, the four failure states and the exact limits. The short version:

| Rule                      | Value                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| Code length / expiry      | 6 digits / 10 minutes                                                 |
| Tries per code            | 3 — then the _code_ dies, not the account                             |
| Resend cooldown           | 60 s, surfaced to the client as a countdown                           |
| Sends per number / per IP | 5 per hour / 20 per hour                                              |
| Lockout                   | 15 minutes, and the API returns the **time it lifts**, not a duration |

The API must return, on every verify failure: `triesLeft`, and on lockout an absolute
`retryAt`. The client states both — "2 tries left", "try again at 14:32" — and cannot invent
either.

**Reset must not reveal whether a number is registered**; sign-up may. That asymmetry is
deliberate and is explained in §12b.

**An OTP that resets a password can take over an account.** Every limit above applies to the
reset path identically to the sign-up path.

### The privacy guard breaks quietly — fix it in the same commit

`PRODUCT.md` says _"no legal name is collected, so none can appear on a public surface"_ and
names `apps/api/src/payments/identity-privacy.e2e.test.ts` as the guard. That test forbids
exactly five strings:

```
verifiedName, verified_name, faydaFin, fayda_fin, rawFin
```

All Fayda-shaped. Adding `name`, `schoolName`, `region`, `wereda` and `gender` **will not
fail it**. The commitment becomes false while the guard stays green — the exact failure mode
this codebase is built to prevent.

**Extend `FORBIDDEN` to the new fields** so no student-reachable route can return them. The
leaderboard renders `displayName`; the guard has to be the thing that stops `name` reaching
it.

**Test:** a route returning `name` outside `/admin` fails the sweep.

---

## Task 5 — leaderboard in two bands

- **Junior:** Grade 6 and Grade 8. **Senior:** Grade 12 and the exit-exam fields.
- **Rank by coverage percentage, not points.** A Grade 12 package holds ~3,900 questions and
  a Grade 6 package ~1,310 — a points board ranks the package, not the student.
- **Weekly is the default board**; all-time is a secondary view. An all-time board is decided
  by January: the top places belong to whoever subscribed first and nobody joining later can
  reach them, so it stops motivating exactly the people who need it.
- **Junior students are opt-in; senior students stay opt-out.** This inverts T-194 for minors
  deliberately — the safe default for a child is not to appear. `User.leaderboardOptOut`
  already exists; junior tracks need the opposite default, not a second column.

**Test:** an eleven-year-old never appears on the senior board, and a junior student who has
not opted in appears on neither.

---

## Task 6 — mock sittings, kept and readable

Every sitting is retained and openable, not just the trend.

Return per sitting: `answered`, `correct`, `blank`, `minutesUsed`, and the date. The client
renders correct / wrong / blank as one bar summing to the paper's 100 questions.

The split is the point. A sitting reading 28% where only 62 questions were attempted is 45%
of what was attempted, with 38 blank — knowledge and pacing are opposite diagnoses and a bare
score tells you neither.

Keep the existing `unansweredInMocks` reasoning: **call it blank, never "ran out of time"**.
A paper submitted early leaves blanks too, and the figure cannot tell the difference.

---

## Task 7 — security, before launch

1. **Delete `POST /auth/dev-login`.** Already `T-206a`, already a launch blocker. It is an
   authentication bypass that lists every persona as a button, and it was used twice during
   the design session to reach the admin console with no password.
2. **Rate-limit the question endpoint.** `PRODUCT.md` lists Redis rate limits in future
   tense, so today one valid subscription can walk the entire bank — stems, concept lines,
   worked solutions, every why-wrong — through the normal API at any speed. You built no bulk
   endpoint precisely to prevent that and then left the retail door open. Since the exam is
   drawn from a bank, a complete verified copy of it is the most valuable study artifact in
   the country and the thing most worth stealing.
3. **Reconsider the two-device limit for school tracks.** It punishes a household with two
   children on one phone — the best customer, not an abuser. A velocity cap is better
   anti-sharing anyway: two friends sharing answer 40 questions a day, a scraper answers
   4,000.

---

## What the front end already expects

Shipped and green (483 tests): the Lomi v1 palette, English-only copy, the 640 / 960 / 1200
measures, the landing page at `/` with the hub moved to `/home`.

Designed but not implemented — these are the screens waiting on your endpoints: the coverage
ring with the 80% bar, the source-grade diagnostic, the derived daily target, the banded
leaderboard, the mock-sitting history, and the sign-up flow.

Two things the client will assume and you should not surprise it with:

- **Money and counts are exact.** No floats for anything a student can check.
- **A figure that cannot be computed is absent, not zero.** The client renders "unavailable"
  rather than a zero, because a zero against a target draws a full progress bar — the one
  wrong answer worse than no answer.
