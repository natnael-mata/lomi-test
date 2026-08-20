# Lomi (ሎሚ) — test brief

Ten student accounts and two staff accounts, each in a state the others cannot reach.
Everything runs locally. Nothing here touches a real payment or a real Telegram account.

## Getting in

```bash
npm run db:dev        # keep this running — everything needs it
npm run dev:api       # port 4000
npm run dev:web       # port 3100
npm run dev:testers -w api   # seeds the twelve accounts
```

Open **http://localhost:3100/dev-login**. All twelve accounts are buttons on that page —
press one. Switching signs the previous account out first, so you can move between them
freely. There is also a **Sign out** control on Access, next to your device list.

> **User F's open paper expires 45 minutes after seeding.** After that `/exam` correctly
> reports nothing open, because nothing is. Re-seed to get it back.
>
> Re-run `npm run dev:testers -w api` whenever you want the accounts back as described.
> It **resets** the states your own testing moves — spent questions, a settled claim, an
> open paper — rather than adding to them. User D in particular goes back to re-practice
> tomorrow, because the wall depends on questions answered correctly _today_.

---

## The accounts

| Account      | State                                       | Go here first                  |
| ------------ | ------------------------------------------- | ------------------------------ |
| **User A**   | brand new, no programme                     | `/choose` → `/practice`        |
| **User B**   | 8 of 10 free used · bank claim pending      | `/practice`, then `/checkout`  |
| **User C**   | paid, 12 months, 12 answered                | `/checkout` (receipt), `/exam` |
| **User D**   | all 10 free spent and right today           | `/practice` — the wall         |
| **User E**   | paid and lapsed yesterday                   | `/practice`, `/checkout`       |
| **User F**   | subscribed · a paper open, 3 of 20 answered | `/exam`, then try `/practice`  |
| **User G**   | subscribed · a paper finished               | `/progress`                    |
| **User H**   | 5 days engaged, points banked               | `/standing`                    |
| **User I**   | subscribed · 15 answered, 1 in 4 right      | `/progress`                    |
| **User J**   | two live devices — at the limit             | Access → devices               |
| **Admin**    | ADMIN staff                                 | `/admin/dashboard`             |
| **Provider** | PROVIDER staff                              | `/provider/health`             |

---

## What to actually do

Work through these in order. Each one is written so you can tell pass from fail without
reading any code.

### 1 · User A — the first five minutes

The account a real student starts from. Nothing has been set up for them.

- You land on the programme chooser. Pick one.
- Answer a few questions. **Check that the free counter goes down by one per question**,
  and that it only counts questions you have not seen before.
- Get one wrong on purpose. Read the explanation. **Does it tell you why your answer was
  wrong, not just what the right one was?**
- Does anything on this screen make you feel stupid for getting it wrong? That is a bug.

### 2 · User B — the wall, and the claim

Two free questions left and a bank transfer waiting to be checked.

- Answer both. **The tenth question must show its explanation** before anything else
  happens. Then the next one should be the paywall — you should never be shown a question
  you are not allowed to answer.
- Go to `/checkout`. You should see your pending claim, with its reference.
- Now sign in as **Admin**, go to `/admin/payments`, and approve it.
- Back as **User B**: you should have access, and `/checkout` should show a receipt.
  **The screen and the gate must agree** — being let in while being told you have not paid
  is the specific bug this checks.

### 3 · User D — the wall arrives first

- Go straight to `/practice`. You should meet the paywall **immediately**, without being
  shown a question first.
- If you are shown a stem, four options, and only then a paywall when you press Check,
  that is the bug. Say so.

### 4 · User E — paid, and ran out

- `/practice` and `/checkout`. **Does the product know the difference between "you never
  paid" and "you paid and it ran out"?** Someone who lapsed is being asked to renew;
  someone who never paid is being asked to start. If both get the same words, that is
  worth reporting.

### 5 · User F — the open paper

- `/exam` should drop you back into the paper you left, on the right question, with the
  timer still going.
- Now try `/practice`. It should refuse, **and tell you why** — something like "Finish or
  submit your exam before practising". "Something went wrong" is a bug.
- Back in `/exam`, press Submit with questions still blank. **You should be asked to
  confirm**, and the safe option ("Go back to them") should be the obvious one.
- Confirm. Check the result screen.

### 6 · User G — a finished paper

- `/progress`. There should be a score, a trend with a point on it, and a weakest topic.
- Every number should be one you can check. If a figure appears with no explanation of
  where it came from, report it.

### 7 · User I — the uncomfortable case

**The most important one.** This student has answered fifteen questions and got a quarter
of them right.

- `/progress`. The readiness figure will be low and the focus list will be long.
- **Read it as if you were them.** Does it tell the truth without making you feel worse
  for having practised? Does it say what to do next?
- This is a judgement call, not a pass/fail. Write down how it made you feel.

### 8 · User H — points and standing

- `/standing`. Points, a five-day streak, and a leaderboard.
- The streak counts **days you showed up**, and missing a day does not reset it. If
  anything on screen suggests otherwise, report it.

### 9 · User J — two devices

- Access → devices. Two sessions listed, and you are at the limit.
- Revoke one. Sign in again — the oldest should be evicted, not you locked out.
- **No screen anywhere should show an IP address or a phone number.**

### 10 · Admin and Provider

**Admin** (`/admin/dashboard`)

- Dashboard, payments, students, weights.
- `/admin/weights` — **it must tell you which programme you are editing.**
- `/admin/import` — try uploading a deliberately broken CSV (rename a column, or delete
  half a line). You should get a readable explanation naming the line. A bare "500" or
  "Internal server error" is a bug.

**Provider** (`/provider/health`, `/provider/activity`)

- The health board refreshes itself every 5 seconds. Watch the countdown.
- It will say **degraded** — that is correct right now. Security is flagged because the
  testing sign-in door is still open, and SMS is unconfigured on purpose.
- `/provider/activity` — the feed of everything that has happened, including your own
  actions from the steps above. **No IP addresses, no phone numbers, no legal names.**

---

## Please also check, on every screen

- **On a phone.** Resize the window to 390px wide or use your phone on the same network.
  Nothing should scroll sideways. Every button should be big enough to tap.
- **Keyboard only.** Tab through a screen. You should always be able to see where you are.
- **Slow connection.** Throttle to 3G in devtools. Does it tell you it is loading, or does
  it just sit there?

## What is deliberately not finished

Do not report these — they are known and scheduled:

- **Amharic** is written but unreviewed, and not reachable in the UI yet. English only.
- **There is no dark mode**, by decision. Lomi is a cream page under a lemon marker and
  has one palette. A dark sheet of paper is a different object, not the same one dimmed.
- **Real Telegram sign-in and real card payment** are held until the rest is done. The
  `/dev-login` door and the manual bank-claim flow are what you are testing instead.
- **The question bank is 20 demo questions**, not the real content.
- The health board saying "degraded" for security and SMS, as above.

## How to report

For each thing you find, please give:

1. **Which account** and **which screen**.
2. What you did, step by step.
3. What you expected, and what happened instead.
4. Whether it stopped you (blocker), annoyed you (medium), or just looked wrong (minor).

Screenshots help. Guesses about the cause are welcome but not needed — what you saw is
the valuable part.
