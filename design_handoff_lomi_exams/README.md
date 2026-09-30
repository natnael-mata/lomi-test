# Handoff: Lomi-Exams student app redesign

## Overview
This is a full redesign of the Ethiopian university exit-exam prep platform (repo `natnael-mata/exitexam`, app in `apps/web`, Next.js with Tailwind). It also renames the product from **Lomi-Test** to **Lomi-Exams** and introduces a new lemon-slice logo. It covers:
- the public landing page
- auth: sign up, phone verification and sign in
- onboarding
- the student app: Today, Practice, Mocks, the exam simulator, Results, Progress, Account, and Plans & payment
- the admin console: Review queue, Payments and Structure

## About the design files
`Lomi-Exams.dc.html` is a **design reference built in HTML**. It's a clickable prototype showing the intended look and behavior, not production code. Open it in a browser; `support.js` must sit next to it. Use the "Screen" dropdown in the bottom-right corner to jump between screens.

The task is to **recreate these designs inside the existing Next.js app** using its patterns: the App Router route groups `(auth)`, `(student)` and `admin`, Tailwind tokens in `globals.css`, `components/icons.tsx`, and the `lib/api` client. Keep all existing API calls and business logic. Replace only the UI, the copy and the information architecture.

## Fidelity
**High fidelity.** The colors, type, spacing, radii and copy are final, so reproduce them exactly. The data in the prototype is sample data (names, counts, dates, payment references); wire it to the real API.

## Design tokens
- **Brand**
  - Lomi Yellow `#FACC15`, hover `#EAB308`
  - Yellow soft `#FEF9C3`, pale `#FEF08A`
  - Link / primary text on light `#A16207`, hover `#854D0E`
- **Ink**
  - `#0F172A` (hero/footer backgrounds), `#1E293B` (text, dark cards)
  - `#334155`, `#475569` (secondary text), `#64748B` (muted text)
- **Lines and surfaces**
  - Borders `#E2E8F0`, input borders `#CBD5E1`, `#94A3B8`
  - Surface `#F1F5F9`, page background `#F8FAFC`, card `#FFFFFF`
- **Status**
  - Correct `#4D7C0F` on `#ECFCCB` (dark text `#3F6212`)
  - Wrong `#DC2626` on `#FEE2E2` (dark `#B91C1C`)
  - Warning/focus topic `#C2410C` on `#FFEDD5`
  - Accent green `#84CC16`, leaf `#65A30D`
- **Type**
  - Headings use **Outfit** 600/700/800. Body text uses **Inter** 400/500/600/700. Formulas use `ui-monospace, Menlo`.
  - Use `font-variant-numeric: tabular-nums` for timers and scores.
- **Type scale, fluid, with `clamp()`**
  - Landing hero H1: `clamp(40px, 6vw, 80px)`, line-height 1.04, letter-spacing -0.035em
  - Section H2: `clamp(32px, 4vw, 56px)`, line-height 1.07, letter-spacing -0.025em
  - App page H1: `clamp(26px, 3vw, 32px)`
  - Card titles: Outfit 700 18px
  - Body: Inter 15–16px, line-height about 1.5
  - Eyebrow: Inter 600 12px, uppercase, letter-spacing 0.06em, color `#64748B`
- **Radii**
  - 8px: buttons in the app
  - 10–12px: options and list items
  - 16px: app cards
  - 20px: landing feature tiles
  - 999px: pills and landing CTAs
- **Shadows**
  - Artboard/card: `0 1px 2px rgb(11 17 32/.06), 0 8px 24px rgb(11 17 32/.08)`
  - Floating: `0 24px 48px rgb(0 0 0/.35)`
- **Minimum hit target:** 44px. Primary buttons are 48–56px tall.
- **Patterns**
  - Dark hero: dot grid `radial-gradient(rgb(255 255 255/.09) 1.2px, transparent 1.7px)` at 24px spacing
  - Yellow CTA: ink dots at `.14` opacity, 22px spacing

## Logo
A lemon slice drawn in SVG, viewBox `-100 -100 200 200`:
- rind: circle r94 `#EAB308`
- pith: circle r80 `#FEF08A`
- flesh: four quarter wedges r70 `#FACC15`, stroked `#FEF08A` at 9
- center: dot r7 `#FEF08A`

The wordmark is "Lomi" plus "-Exams" in Outfit 800, with "-Exams" in `#64748B` on light backgrounds and `#94A3B8` on dark. Replace `components/Logo.tsx` with this and rename every "Lomi-Test" to "Lomi-Exams".

## Responsive rules
- Breakpoints: mobile under 640px, tablet 640–1023px, desktop 1024px and up.
- **App shell**
  - Desktop: sticky 240px sidebar holding the logo, 5 nav items (Today, Practice, Mocks, Progress, Account) and an access card.
  - Tablet and mobile: sticky top bar (logo, page title, streak, avatar) plus a fixed 5-tab bottom bar with safe-area padding. Content gets about 104px of bottom padding.
- **Grids**
  - Cards use `repeat(auto-fit, minmax(min(100%, Npx), 1fr))`: 360px on Today, 280–300px for plans and features.
  - Topic rows are flex-wrap: the name block at `1 1 170px` and the bar block at `2 1 160px`.
- **Exam simulator**
  - Desktop: question column plus a 340px right panel with the 100-question grid, counts and "Review and submit".
  - Tablet and mobile: a footer with the current 10-question strip, a grid button that opens the full grid as an overlay, and Previous / Submit / Next.
- Auth: a two-column split with a dark brand panel on desktop, a single column (max 420px) otherwise.
- Landing: every section is capped at 1280px wide with side padding of `clamp(16px, 5vw, 64px)`. The nav links hide below 1024px, and the floating question card over the hero appears on desktop only.

## Screens
1. **Landing** (`app/page.tsx` for the public view, `f/[slug]` for the field version)
   - Dark dotted hero containing:
     - the "2026" badge with a pulsing green dot
     - the H1 "Walk into your exit exam **already knowing** you'll pass." (the bold phrase in yellow)
     - two CTAs: "Start practicing free" and "See plans"
     - a product composite: a dashboard card with a 43-day countdown, a readiness bar that animates to 62%, focus topics and a mock trend line
   - Floating decorative shapes in the hero: spinning lemon slices, check marks, A/C answer chips and a "+10 pts" pill.
   - Then, in order:
     - a scrolling marquee of field names
     - 3 big stats
     - a 6-tile feature grid
     - the dark "Exam simulator" band
     - pricing (3 plans)
     - a yellow CTA with a spinning slice
     - a 4-column footer
2. **Sign up**
   - Step 1 of 2: full name, phone (+251 prefix), password (at least 8 characters), optional email, and a terms checkbox. Button: "Send code".
3. **Verify phone**
   - Step 2 of 2: 6 boxes, 58px tall. The active box has a 2px `#A16207` border on `#FEF9C3`.
   - "Resend in 0:42", then "Verify and continue", which leads to onboarding.
4. **Sign in**
   - Phone or email, password with a "Forgot?" link, and a "Sign in" button.
5. **Onboarding**
   - Field picker grid (8 fields shown with question counts), questions per day (15 / 25 / 40), an exam-date note, and "Build my plan".
6. **Today**
   - Dark countdown and readiness hero with a 60% pass-safe marker.
   - Today's plan: a progress ring 15/25, topic rows, and the only primary CTA.
   - Topics by exam weight: the bar turns orange below 60%.
   - Mock score line chart with the pass-safe line.
   - Streak card with a 7-day row.
7. **Practice**
   - Progress bar "N of 25", a "Question N" heading, the topic eyebrow and time allowed, the stem, and options A–D.
   - After an answer:
     - the correct option turns green and a wrong choice turns red
     - a verdict line appears
     - then "What was tested" (yellow soft), the numbered worked solution (the last step green), and "Why X is wrong" for each distractor
   - The "Next question" button is sticky at the bottom.
8. **Mocks**
   - "Next up" dark card with a "Start mock 5" button, then past mocks with score bars leading to Results.
9. **Mock exam**
   - Header: exit button, title, answered count and a live countdown timer (orange at 20% time left, red at 5%).
   - Flag toggle.
   - Grid cell states: answered yellow, blank gray, current outlined `#A16207`, flagged orange dot.
   - Keyboard: ← → to move, A–D or 1–4 to answer, F to flag.
   - Submit confirmation modal shows the answered, blank and flagged counts plus time left.
10. **Results**
    - Score out of 100 against the 50% pass mark, correct/wrong/time used, score by topic, and a missed-questions list that opens the Practice answer view.
11. **Progress**
    - 4 KPI tiles, readiness for all 9 topics (weight and number answered), and a 5-week activity heatmap.
12. **Account**
    - English / አማርኛ toggle.
    - Profile with a display name (leaderboard alias) and Fayda status.
    - Access card and plans button.
    - Devices: 2 max, with log-out for other devices.
    - "Staff: open admin console" and sign out.
13. **Plans & payment**
    - 3 selectable plan cards:
      - **Starter, 300 ETB:** full bank, worked solutions, practice by topic
      - **Standard, 400 ETB, "Most chosen":** everything in Starter, plus unlimited mocks and readiness by topic
      - **Full prep, 500 ETB:** everything in Standard, plus the daily plan, mock review by topic and priority Telegram help
    - Payment methods: telebirr, CBE Birr, card via Chapa, bank transfer with a receipt upload.
    - Summary with total, access until exam day, and a Fayda note. Button: "Pay N ETB with X", then a success state.
14. **Admin**
    - Dark top bar with tabs.
    - **Review queue:** list plus detail with the key shown, concept, and actions Publish / note / Send back. Authors can't publish their own questions.
    - **Payments:** KPIs plus a receipt list with Approve / Reject.
    - **Structure:** each field with a weight-sum badge (a field can publish only at 100%), Live/Draft status and topic chips.

## Motion
- Keyframes:
  - `float`: translateY 0 → -16px, rotate 6deg, 7–12s ease-in-out, staggered
  - `spin`: 40–60s linear
  - `marquee`: translateX(-50%) over 40s linear, on a duplicated list with edge fade masks
  - readiness `fill`: 0 → 62% over 6s, looping
  - `pulse`: 1.8s
  - option color changes: 200ms ease-out
- Respect `prefers-reduced-motion` by disabling all of it.

## State
- screen / route
- practice: question index, chosen option
- exam: current index, answers map, flags map, remaining seconds, confirm modal, grid overlay open
- selected plan, payment method, paid status
- selected field, daily goal, language
- admin: tab, selected queue item, review results, payment decisions

## Files
- `Lomi-Exams.dc.html`: the full prototype. The `<script data-dc-script>` block holds the sample data (TOPICS, PLANS, METHODS, PRACTICE, EXAM_Q, QUEUE, PAYMENTS).
- `support.js`: the runtime needed to open the prototype.
- `CLAUDE_CODE_PROMPT.md`: a prompt to paste into Claude Code.
