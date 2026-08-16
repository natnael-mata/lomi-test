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
3. Click one of four buttons: **Student one**, **Student two**, **Student three**, **Admin**

Each button signs you in as that person and keeps their history. Use **Student one** for
the student journey and **Admin** for the admin screens.

## What to test, in order

Take a screenshot at every numbered step, on **desktop width first**, then repeat steps
1–6 at **phone width (375px)**.

### 1. First run — choosing a programme

Sign in as **Student one**. If you land anywhere other than a programme chooser, go to
`/practice` — a student with no programme should be sent to `/choose`.

- Are the programmes listed and selectable?
- Is there a question asking whether you have sat the exam before, with a reason given for
  why it is asked?
- Does the page say the choice can be changed later?

Choose **Local Dev** — it is the only programme with practisable questions today.

### 2. Practising

- Does a question appear, with its options and the topic it came from?
- **Before you answer:** is the correct answer visible anywhere on screen? It must not be.
  Check the visible page only.
- Answer one question. Is the explanation shown, including why the wrong options are wrong?
- Is there a count of free questions remaining, and does it go down?

### 3. Progress

Go to **Progress**. Is there a readiness figure, a weakest topic, and does every number say
where it came from rather than appearing bare?

### 4. Standing

Go to **Standing**. Check the points figure, the streak, the tier badge and the board.

- Does every points row say **why** it was earned, not just a number?
- Is there a button to hide yourself from the board? Click it — are you removed from the
  list but still told your rank?

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

### 7. Admin

Sign in as **Admin** (go to `/dev-login` again).

- **`/admin/dashboard`** — do the four signup figures add up to the total shown?
- **`/admin/import`** — upload a questions file. Use
  `docs/question_import_template.csv` from the project folder. Does it report how many rows
  were read, added or refused, and does a refused row say which line and why?
- **`/admin/weights`** — does it show topic weights and a running total?

Then sign back in as **Student one** and try to open `/admin/dashboard`. You should be
refused.

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

- **The three real programmes have no questions.** Only "Local Dev" does. Choosing
  Accounting & Finance, Computer Science or Public Health correctly says there is nothing
  to practise.
- **There is no sign-in screen** — that is why `/dev-login` exists.
- **Telegram and card payments are switched off.** No keys are configured.
- **No profile page, no password change** — the product has no passwords.
- **No admin screen for approving payments or deactivating users** yet.

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
