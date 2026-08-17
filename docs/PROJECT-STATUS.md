# Lomi-Test (ሎሚ) — project status

**Date:** 2026-08-15 · **For:** the product owner, and anyone picking this up

One document, honestly stated. Where the detail lives:

| Document                   | What it holds                                             |
| -------------------------- | --------------------------------------------------------- |
| `docs/PLAN.md`             | The original plan — scope, feature specs, roadmap         |
| `PRODUCT.md`               | Confirmed product decisions and the invariants            |
| `DESIGN.md`                | The design system — colour, type, layout, navigation      |
| `TASK.md`                  | Every task, ticked or not, with the reasoning behind each |
| `docs/CONTENT-PIPELINE.md` | How questions get from a spreadsheet into the bank        |
| `docs/TEST-PROMPT.md`      | A brief for a human or agent to test the product          |

---

## 1. What it is

A web app that helps Ethiopian university students prepare for the national **Exit Exam**.
Students practise questions with full explanations, sit timed mock exams, see where they
are weak per topic, and pay for access by the month.

**The promise:** realistic practice plus per-topic feedback, so a student knows exactly
where they are weak — and a product that never lies to them about it.

Three programmes at launch: **Computer Science**, **Public Health**, **Accounting &
Finance** — the only three with usable answer keys.

**Price:** Br 500 for six months, Br 800 for twelve, counted from the day of purchase.

---

## 2. What is built and working

Verified by running it, not by reading the task list.

| Area                                                     | State                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| Question bank — Field → Course → Topic → Question        | Working, with a publish gate that refuses incomplete questions |
| Practice with explanations and topic attribution         | Working                                                        |
| Mock exam — 100 questions, 3 hours, review afterwards    | Working                                                        |
| Per-topic results, readiness, score trend                | Working                                                        |
| Payments — telebirr, CBE Birr, Chapa page, bank transfer | Working; three need a Chapa key                                |
| Subscriptions, expiry, renewal                           | Working                                                        |
| Admin — dashboard, question upload, topic weights        | Working                                                        |
| Points, streaks, badges, leaderboard                     | Working                                                        |
| Community — threads, verified replies, moderation        | Working                                                        |
| Navigation, programme choosing                           | Working (built 2026-08-15)                                     |
| Sign-in screen, payment approval, user management        | Working (built 2026-08-16 to the design handoff)               |
| Receipt and payment history                              | Working                                                        |

**Tests:** 1,011 API · 490 web · 33 bot. All passing.

---

## 3. What is not built

One thing, and it is the launch blocker.

| Missing                 | Why it matters                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------- |
| **Real exam questions** | **The launch blocker.** Only demo content exists; the three real programmes have none |

Everything else on this list has been built. Sign-in, payment approval, user management and
the receipt landed on 2026-08-16 against the design handoff; the phone-app install landed on
2026-08-17, with an offline page that deliberately caches no question content — the bank is
the asset, and a cache is a copy on a device.

Sign-in still needs a Telegram bot token to do anything. The screen mints a pairing request
and says so plainly when the server has no bot configured.

---

## 4. Decisions taken

| Decision                    | Outcome                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Sign-in                     | **Telegram only.** No passwords anywhere in the product                                                            |
| National ID (Fayda)         | **Dropped.** Approval was never granted, so the anti-sharing control is now the two-device limit alone             |
| verify.et bank verification | **Dropped.** Bank transfers are settled by a person reading a statement — permanently, not as a stopgap            |
| What a plan buys            | **Every programme**, not one                                                                                       |
| Exam-day countdown          | **Not built on purpose** — no sitting date has been supplied, and inventing one would put a false number on screen |
| Hosting                     | AletCloud app hosting, with the old server kept running alongside                                                  |

---

## 5. Where it runs

|                |                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------- |
| **Local**      | http://localhost:3100 — for testing now                                                     |
| **AletCloud**  | https://lomi-test.app.aletcloud.com — live, 360 ETB/month                                   |
| **Old server** | https://lomi.196-190-212-158.nip.io — still running, to be retired once AletCloud is proven |
| **Code**       | github.com/natnael-mata/lomi-test (private)                                                 |

---

## 6. What is needed to launch

In order of what blocks the most.

1. **Real exam questions** — a reviewed spreadsheet per programme. Upload them yourself at
   `/admin/import`; no developer needed.
2. **A Telegram bot token** — from @BotFather. Without it nobody can sign in. It also
   unblocks the receipt, the contact capture, and lets the temporary testing door be
   deleted.
3. **A Chapa key** — turns on three of the four ways to pay.
4. **The bank account number** — set `NEXT_PUBLIC_BANK_ACCOUNT`. Until it is set the
   bank-transfer screen says the account is not published rather than showing an invented
   one, which means nobody can complete a transfer.
5. **A Chapa key and a bot token** — see above; nothing else is waiting on code.

---

## 7. A note on the task count

`TASK.md` says **187 of 197**. Read it carefully: for most of the build it counted tasks
that were **API-only**. Sign-in, the navigation, the programme choice and the admin upload
were all ticked or assumed while the screens did not exist — the product owner found this
by asking where the menu was, not by reading a report.

Phase 13 in `TASK.md` now records that class of gap explicitly, and a test
(`layout-measure.test.ts`) reads the layout rules **out of `DESIGN.md`** so the code fails
if it drifts from the document again.

**The percentage measures tasks, not whether a student can use the product.** Until there
are real questions and a way to sign in, they cannot.
