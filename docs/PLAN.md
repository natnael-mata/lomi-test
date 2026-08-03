# PLAN.md — Exit Exam Training Web App

## 1. Overview

A web platform that helps Ethiopian university students prepare for the national
**Exit Exam** (introduced ~5 years ago). Students register, practice with a curated
question bank sourced in partnership with the **Ministry of Education**, and take
either self-paced training or a timed mock exam that mirrors the real thing.
The platform is subscription-based (6 months – 1 year) with a free trial, and grows
into a community with gamified engagement.

**Core promise:** realistic practice + per-topic feedback so students know exactly
where they are weak, per department/stream.

---

## 2. Users & Roles

- **Student** — registers, practices, takes mock exams, subscribes, engages with community.
- **Admin** — manages accounts, uploads questions/content, resolves payment issues, moderates.
- **(Later) Moderator** — lighter admin for community/content only.

---

## 3. Release Scope

### V1 — MVP (launch)

1. Easy registration + login
2. Free trial (10 sample questions on signup)
3. Training mode (self-test with feedback)
4. Exam mode (timed mock)
5. Per-topic results & analytics
6. Payment + subscription (Chapa + manual bank via verify.et)
7. Admin panel (users, content upload, payment issues)

### V2 — Engagement

8. Community
9. Badging / achievements
10. Streaks & challenges (daily / weekly / monthly leaderboards)

---

## 4. Feature Specs

### 4.1 Registration & Auth

Two sign-in paths into **one shared account/user record**:

- **Web:** name, phone/email, password → verify → in.
- **Telegram Mini App:** near-zero friction — the app receives Telegram `initData`,
  the backend **validates it (HMAC against the bot token)**, and the student is
  identified by their Telegram ID. No password needed.
- A user who signs in both ways can be **linked to the same account** (match on
  phone/email, or an in-app "link Telegram" step).
- On first sign-in the student picks their **Field / Department** (e.g. Computer
  Science), which scopes all their questions.
- New account immediately unlocks **10 free sample questions** to demo how it works.
- **Decision needed:** keep Fayda ID verification (from the earlier spec) or drop it
  for "easy registration"? Options: optional Fayda for verified badge, or none at V1.

### 4.2 Question taxonomy (the backbone)

Everything hangs off this hierarchy, because per-topic results depend on it:

```
Field / Department  (Computer Science, ...)
   └─ Course         (Data Structures & Algorithms, Project Management, ...)
        └─ Topic      (Sorting, Trees, Risk Management, ...)
             └─ Question
                  ├─ options (A–D)
                  ├─ correct answer
                  └─ explanation (why correct / why the others are wrong)
```

Each question is tagged so the platform can (a) show "this question is from _Data
Structures & Algorithms_" and (b) roll results up into a per-course/per-topic score.

### 4.3 Training mode (self-test)

- Student answers a question.
- **Immediate feedback:** correct / incorrect.
- **Explanation** shown for why it's correct (and why the chosen wrong option is wrong).
- **Topic attribution** shown per question ("From: DSA → Sorting").
- **Session summary** at the end: overall score + breakdown by course/topic, e.g.
  - Data Structures & Algorithms — 8/10
  - Project Management — 5/8
  - Weakest topic: Sorting → suggests where to focus.

### 4.4 Exam mode (timed mock)

- Mirrors the real exit exam: fixed question count + **countdown timer**.
- **One question at a time**, with **Next** and **Back** navigation.
- **No feedback during the exam** (like the real one).
- On submit (or time-out): final score, then a **post-exam review** showing correct
  answers, explanations, and the same per-topic breakdown as training.
- **Decision needed:** exact question count and time limit per field — confirm from MoE.

### 4.5 Payment & subscription

Two payment paths, both ending in an active subscription:

1. **Chapa** — automated gateway; on success, subscription activates automatically.
2. **Manual bank transfer** — student pays into a bank account, submits the
   **transaction number**, we **verify via verify.et**, then activate.
   (Manual queue visible to admin for edge cases.)

- Plans: **6 months** and **1 year** (pricing TBD).
- Free tier = the 10 sample questions; full bank locked until subscribed.
- Subscription state drives access (active / expired / trial).

### 4.6 Admin panel

- **Users:** view, search, activate/deactivate, reset, manage subscription state.
- **Content:** upload questions (bulk import — CSV/Excel with columns for field,
  course, topic, question, options, answer, explanation), edit, retire.
- **Payments:** review manual transfers, verify.et status, approve/reject, resolve disputes.
- **Dashboard:** signups, active subs, revenue, most-missed topics.

### 4.7 Community & gamification (V2)

- **Community:** discussion/Q&A space per field or topic.
- **Badges:** milestones (first exam, 100 questions, topic mastery, streaks).
- **Streaks & challenges:** track questions solved daily; leaderboards for
  daily / weekly / monthly. Nudges to keep students returning.

---

## 5. Data Model (high level)

- `User` — profile, field, role, subscription status
- `Field` → `Course` → `Topic` → `Question` (with `options`, `correctAnswer`, `explanation`)
- `ExamSession` — mode (training | exam), field, started/ended, timer
- `Answer` — session, question, chosen option, correct?
- `Subscription` — plan, start/end, status
- `Payment` — method (chapa | bank), amount, txn number, verify.et status
- `Badge`, `UserBadge`, `Streak`, `Challenge` (V2)
- `CommunityPost`, `Comment` (V2)

---

## 6. Tech Stack & Platform Architecture

**One backend + one database, two frontends.** The Telegram Mini App and the web
app are built and shipped separately but share the same API and data.

- **Backend:** Node (Express or Fastify; NestJS if you want more structure) — REST API
- **Database:** PostgreSQL
- **Web frontend:** React (Vite) — standard browser SPA
- **Telegram frontend:** React (Vite) Mini App using the **Telegram Web App SDK**
- **Integrations:** Chapa API, verify.et API, Telegram Bot API
- **Shared code:** TypeScript types, API client, and business logic live in a shared
  package so both frontends stay in sync.

### Suggested monorepo layout

```
/server            Node + Express + PostgreSQL (the single API)
/apps/web          React web app
/apps/telegram     React Telegram Mini App
/packages/shared   types, API client, shared UI/logic
/bot               Telegram bot (launch Mini App, push reminders/streaks)
```

### Web vs Telegram — what's actually different

Same features, two surfaces. Build the differences in, don't fork the whole app:

| Concern       | Web app                         | Telegram Mini App                                           |
| ------------- | ------------------------------- | ----------------------------------------------------------- |
| Auth          | email/phone + password          | validate Telegram `initData`, ID = Telegram ID              |
| Registration  | full form                       | near-instant (identity comes from Telegram)                 |
| UI chrome     | own header/nav                  | Telegram theme params + MainButton/BackButton               |
| Layout        | full responsive design          | constrained webview viewport, keep it compact               |
| Notifications | email / web push                | **bot messages** — ideal for streaks & challenges           |
| Payment       | Chapa redirect + bank/verify.et | Chapa in webview + bank/verify.et (Telegram Stars optional) |
| Distribution  | public URL                      | bot + Mini App launch button                                |

The exam engine, question API, scoring, subscriptions, and admin are **identical
across both** — only the shell (auth, chrome, navigation, notifications) differs.
The Telegram bot doubles as the engagement channel for V2 (daily reminders,
streak nudges, leaderboard pings).

---

## 7. Build Roadmap

**Phase 1 — Foundations**

- Monorepo (server / web / telegram / shared), DB schema, taxonomy
  (Field/Course/Topic/Question), admin question upload.
- Dual auth: web password login + Telegram `initData` validation into one user record.
- Stand up both frontend shells (web + Telegram Mini App) against the shared API early,
  so every later feature lands on both surfaces at once.

**Phase 2 — Core exam engine**

- Training mode + feedback + explanations + per-topic scoring.
- Exam mode: timer, one-at-a-time nav, submit + review.

**Phase 3 — Access & payments**

- Free-trial gating (10 questions), Chapa integration, manual bank + verify.et flow,
  subscription lifecycle.

**Phase 4 — Admin & polish**

- Full admin panel (users, payments, dashboard), content management, QA.

**Phase 5 — V2 engagement**

- Community, badges, streaks, leaderboards, challenges.

---

## 8. Open Decisions (confirm before / during build)

Most of these were answered before the build began (D1–D8, recorded at the top of `TASK.md`).
What is left:

1. ~~Project identity~~ — **Lomi-Test (ሎሚ)**.
2. ~~Fayda at registration~~ — **binds at purchase only**, stored as a salted FIN hash.
3. ~~Fields at launch~~ — **three**: Computer Science, Public Health, Accounting & Finance.
4. ~~Exam config~~ — **100 questions, 3 hours**; 60s per concept question, 180s per calculation.
5. ~~Subscription pricing~~ — **Br 500 for 6 months, Br 800 for 12**.
6. **verify.et access — still open.** API credentials and the exact verification response to key
   off. Blocks the Fayda work in Phase 8.
7. ~~Bulk question import format~~ — locked as the 16-column `question_import_template.csv`.

---

## 9. Decisions made during the build

Recorded as they were taken, with the reasoning, because each closed off an alternative that
looked reasonable at the time. Task IDs point at the tests that hold them.

### Content and the question bank

- **Why-wrongs and the concept line are authored in review, not imported** (T-031a, owner's
  decision). They are deliberately not columns in the template: no MoE source file contains that
  text, so the columns would be empty on every real import, and a question carrying them from a
  spreadsheet would look publishable without a human having read it. Consequence, accepted: **no
  question reaches a student without a human pass.**
- **The importer stages; it never judges.** A half-finished question is the normal case, so a
  missing answer or explanation is flagged rather than rejected (T-053). The exceptions are rows
  nobody could finish — no id, no stem, no field, or a missing option (T-057), because inventing
  a distractor changes how hard the question is.
- **What a row actually contains beats what the file claimed.** A row saying `ready` with no
  answer still gets `NEEDS_ANSWER`, or it sits in nobody's queue (T-053).
- **An import never decides a lifecycle.** It cannot publish, and it cannot un-publish: a
  re-imported file that changes a published question sends it to `IN_REVIEW` rather than
  silently withdrawing it or silently updating what students are reading (T-054).
- **Re-import preserves reviewer work.** Why-wrongs exist in no CSV column, so options are
  matched by label rather than deleted and recreated (T-055).
- **`difficulty` is stored rather than dropped** (T-053a). Nothing consumes it yet, but the
  ministry files already carry it and discarding data on import is the irreversible choice.

### Serving and the free tier

- **Answer content is released only on attempt**, and the payload is built by listing what goes
  in — never by deleting from a row (T-106). The Prisma query selects only the allowed columns,
  so answer content does not leave the database at all.
- **One question endpoint, serving one question.** No collection route, no `:id` route (T-107).
- **Selection is random among eligible questions.** A deterministic order means every student in
  a field sees the same sequence, which turns the bank into a shareable answer list (T-105).
- **Pacing is a separate axis from correctness.** Over the limit is `pacing: 'over'`, never a
  boolean a UI could render as failure (T-109).
- **The free tier is 10 distinct questions per field**, refused with **402** and no answer
  content (T-111). It sits behind a `SubscriptionAccess` seam whose default answers _false_ —
  a permissive default would mean the limit is never enforced, and Phase 8's arrival would
  silently change everyone's access.
- **"Session" means today's practice** (T-118), reusing the day boundary T-110 already defines
  rather than adding a second notion that disagrees at midnight.

### Identity and access

- **Sessions are rows, not just JWT claims** (T-080). A device list and immediate revocation are
  promised, and a stateless token can deliver neither.
- **The two-device limit evicts on login, never refuses it** (T-082). Refusing strands a student
  who has lost the phone they signed in on; sharing is made inconvenient, not punishing.
- **Two populated accounts are never merged** (T-081). Folding attempts and a subscription
  together has no correct default and is unrecoverable if done wrongly.
- **The display name is generated, never derived** (T-086) — not from the legal name and not
  from the Telegram name, which usually _is_ the person's real name.

### Interface

- **The OS dark preference is handled in CSS, not JavaScript** (T-098). React owns `<html>`'s
  attributes and strips a class an inline script adds, so the JavaScript approach showed a light
  page to every system-dark user. Cost, accepted: the dark tokens are declared twice, with a
  test asserting the two copies stay identical.
- **The answer view has one fixed order and nothing behind a tap** (T-113). A collapsed
  explanation is one most students never open, and the explanation is what they are paying for.
- **Weights read "share of past papers", never "% of exam"** (T-097a, decision D5), enforced by
  a copy lint because the wrong phrase is the more natural English and will be reached for again.
- **Fonts are self-hosted from committed files** (T-091). `next/font/google` downloads at build
  time and _silently falls back to system-ui_ when it cannot — a failure that looks exactly like
  success.
- **The web app reaches the API same-origin through `/api/*`** (T-112), not cross-origin with
  CORS: no preflight on every submission, no allow-list per environment, and moving the session
  token to an httpOnly cookie later stays a one-file change.

### Process

- **Two sessions, two worktrees, two databases.** Phase 8 runs in parallel on
  `phase-8-payments`; the rules keeping them apart are in that worktree's `HANDOFF.md`.
- **Batch 3–5 related tasks per commit** (owner's decision). One commit per task spent more time
  on tooling than on work; every task still keeps its own test.
- **Dev conveniences are scripts, never endpoints.** A `/auth/dev-login` route is an
  authentication bypass shipped in the bundle, one misconfigured variable from being live.
