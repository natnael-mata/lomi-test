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

Each question is tagged so the platform can (a) show "this question is from *Data
Structures & Algorithms*" and (b) roll results up into a per-course/per-topic score.

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

| Concern        | Web app                          | Telegram Mini App                              |
|----------------|----------------------------------|------------------------------------------------|
| Auth           | email/phone + password           | validate Telegram `initData`, ID = Telegram ID |
| Registration   | full form                        | near-instant (identity comes from Telegram)    |
| UI chrome      | own header/nav                   | Telegram theme params + MainButton/BackButton  |
| Layout         | full responsive design           | constrained webview viewport, keep it compact  |
| Notifications  | email / web push                 | **bot messages** — ideal for streaks & challenges |
| Payment        | Chapa redirect + bank/verify.et  | Chapa in webview + bank/verify.et (Telegram Stars optional) |
| Distribution   | public URL                       | bot + Mini App launch button                   |

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

1. Project identity — is this the same as the earlier "Lomi-Test" spec (reuse brand,
   pricing, build plan) or a fresh brand?
2. Keep Fayda ID at registration, make it optional, or drop it for easy signup?
3. Fields at launch — start with Computer Science only, or multiple departments?
4. Exam config per field — question count + time limit (from MoE).
5. Subscription pricing for 6-month and 1-year plans.
6. verify.et access — API credentials and the exact verification response we key off.
7. Bulk question import format — lock the CSV/Excel column schema early.
