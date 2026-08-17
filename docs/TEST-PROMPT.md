# Test prompt — Lomi-Test (ሎሚ)

Paste everything below the line into the Claude browser extension. It is written to be
self-contained: it says what the product is, how to get in, what to check, what "correct"
looks like, and what is already known to be missing so those are not reported as new bugs.

---

You are testing **Lomi-Test (ሎሚ)**, an exit-exam preparation web app for Ethiopian
university students. It runs locally at **http://localhost:3100**.

Your job is to use it as a real person would, judge it against the rules below, take
screenshots, and write a report. **Do not read or change any code.** Test only what you can
see and click.

## How to sign in

There is **no username and password**. Sign-in normally happens through Telegram, which is
not connected yet, so use the testing door:

1. Go to **http://localhost:3100/dev-login**
2. The password box is already filled in — leave it alone
3. Click one of four buttons

Each button signs you in as that account and keeps its history. The four are set up in
different states on purpose, so between them they reach every screen:

| Button     | Where it starts you                                    | Use it for                                                            |
| ---------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| **User A** | nothing chosen yet                                     | first run: choosing a programme, the first question, the free counter |
| **User B** | 8 of 10 free questions used, one bank transfer waiting | the free wall, two answers away                                       |
| **User C** | paid for 12 months                                     | the receipt, the payment history, the mock exam                       |
| **Admin**  | admin staff                                            | every `/admin` screen, including settling User B's transfer           |

Do the student journey as **User A**, then switch to **User B** for the paywall and
**User C** for everything a paying student sees.

## What to test, in order

Take a screenshot at every numbered step, on **desktop width first**, then repeat steps
1–6 at **phone width (375px)**.

### 1. First run — choosing a programme

Sign in as **User A**. If you land anywhere other than a programme chooser, go to
`/practice` — a student with no programme should be sent to `/choose`.

- Are the programmes listed and selectable?
- Is there a question asking whether you have sat the exam before, with a reason given for
  why it is asked?
- Does the page say the choice can be changed later?

Choose **Local Dev** — it is the only programme with questions in it today. It holds twenty
demo questions across four topics: Processes and Scheduling, Depreciation, Study Design and
Value Added Tax.

### 2. Practising

- Does a question appear, with its options and the topic it came from?
- **Before you answer:** is the correct answer visible anywhere on screen? It must not be.
  Check the visible page only.
- Answer one question. Is the explanation shown, including why the wrong options are wrong?
- Is there a count of free questions remaining **before** you answer, and does it go down?
- Do the four options stay on screen after you check, with the right one marked and your own
  marked if it was wrong?

### 3. Progress

Go to **Progress**. Is there a readiness figure, a weakest topic, and does every number say
where it came from rather than appearing bare?

### 4. Standing

Go to **Standing**. Check the points figure, the streak, the tier badge and the board.

- Does every points row say **why** it was earned, not just a number?
- Is there a button to hide yourself from the board? Click it — are you removed from the
  list but still told your rank?

### 4b. Running out of free questions

Sign in as **User B**, who has two left. Answer two questions.

- The third should be a **different screen with a different action** — not an error, not a
  red box. It should say it was your tenth free question, show both plans with the per-month
  price worked out, and offer one button.
- Go to **Access**. Your pending bank transfer should be listed with its reference and a word
  saying it is being checked.

### 5. Getting access

Go to **Access** (the checkout). There should be **four ways to pay**, all on one screen,
each saying what will happen when you choose it.

- Try **telebirr**: it should refuse clearly (no payment key is configured). Does the
  message tell you what still works?
- Try **Bank transfer** with any reference number. Does it tell you somebody will check it,
  and show you your reference?

### 6. The menu

The design specifies **exactly five destinations**, with labels always visible.

- On desktop: a **left rail**. On a phone: a **bottom bar**.
- Are there five, with words next to the icons at both sizes?
- Is the current page marked in a way you could still see **in black and white**?

### 6b. What a paying student sees

Sign in as **User C**.

- **Access** should show a receipt — plan, amount, method, reference, the date paid, and the
  date access ends — plus a payment history underneath.
- **Mock** should start a paper. It is **20 questions in 45 minutes** here rather than the
  100 in 3 hours the intro text promises: the real paper is sampled from a real bank, and the
  demo bank only holds twenty. Check the timer, the question navigator and flagging.
- **Practise** should never hit a paywall.

### 7. Admin

Sign in as **Admin** (go to `/dev-login` again).

- **`/admin/payments`** — User B's transfer should be waiting. Open the row: does it give you
  enough to check against a bank statement? Try rejecting without a reason — it should refuse.
  Approve it, then sign in as User B and check their Access tab now shows a receipt.
- **`/admin/users`** — search for `User`. Both actions should say what they do to a person.
- **`/admin/dashboard`** — do the four signup figures add up to the total shown?
- **`/admin/import`** — upload a questions file. Use
  `docs/question_import_template.csv` from the project folder. Does it report how many rows
  were read, added or refused, and does a refused row say which line and why?
- **`/admin/weights`** — does it show topic weights and a running total?

Then sign back in as **User A** and try to open `/admin/dashboard`. You should be refused.

## The rules to judge against

These come from the product's own design document. Report anything that breaks one.

1. **Nothing shames the student.** No "you failed", "you lost your streak", "you broke your
   streak". A missed day must never be punished.
2. **Colour never carries meaning alone.** Correct, wrong, pending, the active menu item,
   the badge tiers — each needs an icon or a word too. Judge this by imagining the screen
   in black and white.
3. **Every number says where it came from.** A figure with no explanation beside it is a
   fault.
4. **The answer is never visible before you answer.**
5. **Errors say what to do next**, not just what went wrong.
6. **Text is never smaller than 16px** for body copy, and buttons are comfortably tappable
   on a phone.
7. **Nothing scrolls sideways.** The page must never move left-to-right at any width.

## Already known — do not report as new

- **The three real programmes have no questions.** Only "Local Dev" does, and its twenty
  questions are invented for testing. Choosing Accounting & Finance, Computer Science or
  Public Health correctly says there is nothing to practise.
- **The mock exam is 20 questions in 45 minutes locally**, not the 100 in 3 hours the intro
  promises. The paper is sampled from the bank, and the demo bank is twenty questions.
- **Telegram is not connected.** `/signin` renders and explains itself; nothing reaches
  Telegram, which is why `/dev-login` exists.
- **Card and wallet payments are switched off.** No Chapa key is configured.
- **The bank account is not published.** The bank-transfer screen says so rather than showing
  an invented account number. You can still submit a claim and settle it as Admin.
- **No profile page, no password change** — the product has no passwords.

If you find one of these, note it as _confirmed known_, not as a new bug.

## The report

Write it as a document with:

1. **A one-paragraph verdict** — would you let a student use this tomorrow, and why.
2. **A table**: step, what you expected, what happened, pass or fail, and the screenshot.
3. **Every screenshot**, labelled with the step and the width you used.
4. **Bugs**, worst first. For each: what you did, what happened, what should have happened,
   and how badly it hurts a student.
5. **Rule breaches** — anything from "the rules to judge against" above, quoting which rule.
6. **What confused you.** You are a first-time user; anything you had to work out is worth
   more than a styling opinion.

Be blunt. A report that says everything is fine is not useful. If something looks
unfinished, say so.
