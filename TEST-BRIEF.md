# Lomi (ሎሚ) — test brief

Ten student accounts and two staff accounts, each in a state the others cannot reach.
Everything runs locally. Nothing here touches a real payment or a real Telegram account.

## Getting in

```bash
npm run db:dev               # keep running — everything needs it
npm run dev:api              # port 4000
npm run dev:web              # port 3100
npm run dev:testers -w api   # seeds the twelve accounts
```

Open **http://localhost:3100/dev-login**. All twelve accounts are buttons — press one.
Switching signs the previous account out first, so you can move between them freely.
There is also a **Sign out** control on Access, beside your device list.

> **Re-seed between passes.** `npm run dev:testers -w api` puts the accounts back as
> described. It _resets_ what your own testing moves — spent questions, a settled claim,
> an open paper — rather than adding to it.
>
> Two states are time-sensitive: **User F's open paper expires 45 minutes after seeding**,
> and **User D's paywall depends on questions answered correctly today**, so it reverts to
> re-practice tomorrow. Re-seed to restore either.

---

## The accounts

| Account      | State                                  | Start here                    |
| ------------ | -------------------------------------- | ----------------------------- |
| **User A**   | brand new, no programme                | `/choose`                     |
| **User B**   | 8 of 10 free used · bank claim pending | `/practice`, then `/checkout` |
| **User C**   | paid 12 months, 12 answered            | `/checkout`, `/exam`          |
| **User D**   | all 10 free spent                      | `/practice`                   |
| **User E**   | paid, lapsed yesterday                 | `/checkout`                   |
| **User F**   | subscribed · paper open, 3 of 20       | `/exam`, then `/practice`     |
| **User G**   | subscribed · paper finished            | `/progress`                   |
| **User H**   | 5 days engaged, points banked          | `/standing`                   |
| **User I**   | subscribed · 15 answered, 1 in 4 right | `/progress`                   |
| **User J**   | two live devices                       | Access → devices              |
| **Admin**    | ADMIN staff                            | `/admin/dashboard`            |
| **Provider** | PROVIDER staff                         | `/provider/health`            |

---

## The ten scenarios

Each is written so you can tell pass from fail without reading any code.

### 1 · User A — the first five minutes

- The chooser lists four programmes. **Three are marked "Being written" and cannot be
  selected** — they have no questions yet. Only Local Dev can be picked. If an empty one
  is selectable, that is a bug.
- Pick Local Dev, answer a few. The counter should start at **10** and drop by one per
  _new_ question. A question you have seen before is labelled as such and does not count.
- Get one wrong deliberately. Does the explanation tell you **why your answer** was wrong,
  not just what the right one was? Does anything make you feel stupid? That is a bug.

### 2 · User B — the wall, and the claim

- Two free left. Answer both. The tenth must **show its explanation** before anything else.
- Then you should be told your ten are used, that going over them again stays free, and
  where the new questions are. You should never be shown a question you cannot answer.
- `/checkout` shows your pending claim and its reference — **once**, not twice.
- Sign in as **Admin** → `/admin/payments` → approve it.
- Back as **User B**: access granted, receipt on Access, counter gone. **The screen and
  the gate must agree.**

### 3 · User D — the wall arrives first

- Go to `/practice`. You should meet the paywall **immediately**, without being shown a
  question first. Being shown a stem and four options and only then paywalled is the bug.

### 4 · User E — paid, and ran out

- `/checkout`. **Does the product tell "you never paid" apart from "you paid and it ran
  out"?** One is asked to start, the other to renew. Same words for both is worth reporting.

### 5 · User F — the open paper

- `/exam` should say a paper is **open**, how many you have answered, and offer to go back
  to **the question you left** — not question 1.
- Then try `/practice`. It should refuse, say why, **and give you a way to your exam.**
  A dead end with only "Try again" is a bug.
- In `/exam`, press Submit with questions blank. You should be **asked to confirm**, with
  the safe choice ("Go back to them") as the obvious one.

### 6 · User G — a finished paper

- `/progress`. A score, a trend, a weakest topic.
- Every number should be checkable. **Questions you never answered must not be captioned
  the same as ones you got wrong.**

### 7 · User I — the uncomfortable case

**The most important one.** Fifteen answered, a quarter right.

- `/progress`. Readiness will be low and the focus list long.
- There is a **"What each score rests on"** section — a topic scored from one answer says
  so. Check the caveat is there where the evidence is thin.
- **Read it as if you were them.** Does it tell the truth without making you feel worse for
  having practised? Write down how it made you feel. Judgement call, not pass/fail.

### 8 · User H — points and standing

- `/standing`. Points, a five-day streak, a leaderboard.
- Each ledger line should carry **its own date**. Two lines that read identically with
  nothing to tell them apart is a bug.
- A missed day must not reset the streak.

### 9 · User J — two devices

- Access → **Where you are signed in**. Two sessions, at the limit. Revoke one.
- Sign in again — the oldest should be evicted, not you locked out.
- **No IP address or phone number anywhere.**

### 10 · Admin and Provider

**Admin** — `/admin/dashboard`, payments, students, weights, import.

- `/admin/weights` must name the programme it is editing.
- `/admin/import`: upload a deliberately broken CSV (rename a column, or truncate a row).
  You should get a readable explanation **naming the line**. A bare 500 is a bug.

**Provider** — `/provider/health`, `/provider/activity`.

- The health board refreshes every 5 seconds with a visible countdown.
- It will say **degraded** — correct: the testing door is open and SMS is unconfigured.
- The activity feed shows display names, never database ids, IPs or phone numbers.

---

## Also, on every screen

- **On a phone.** 390px wide, or a real device on the same network. Nothing scrolls
  sideways; every control is tappable.
- **Keyboard only.** Tab through. You should always see where you are.
- **Slow connection.** Throttle to 3G. Does it say it is loading, or just sit there?

## Deliberately not finished — do not report

- **Amharic** is written but unreviewed and not reachable. English only.
- **There is no dark mode**, by decision. One cream-and-lemon palette.
- **Real Telegram sign-in and real card payment** are held until the rest is done. The
  `/dev-login` door and the manual bank-claim flow are what you are testing instead.
- **Only Local Dev has questions** (20 demo ones). The other three programmes are
  correctly marked "Being written".
- The health board reporting **degraded** for security and SMS, as above.

## How to report

For each finding: **which account**, **which screen**, what you did, what you expected,
what happened, and whether it stopped you (blocker), annoyed you (medium) or just looked
wrong (minor). Screenshots help. What you saw matters more than why you think it happened.
