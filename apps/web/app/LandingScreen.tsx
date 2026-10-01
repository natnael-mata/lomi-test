/**
 * The public landing page (`/`).
 *
 * **A server component with no session check, on purpose.** `HomeScreen` is the
 * signed-in hub and says so in its own docstring — *"a student with an exam
 * coming, not a prospect to be persuaded"*. This is the other audience, and it
 * moved to the root so the first thing a stranger sees is what the product is
 * rather than a hub they cannot use. The hub now lives at `/home`.
 *
 * No `useEffect`, no `api` call, no loading state: a marketing page that waits
 * on a subscription lookup before rendering is a blank screen on a slow
 * connection, which is exactly the audience arriving here for the first time.
 *
 * **English only** (2026-08-20). Copy is inline rather than in the dictionary —
 * `Copy` is the product's shape, and marketing prose that changes weekly does
 * not belong in a contract every screen is type-checked against.
 *
 * The `<Todo>` markers are unfilled facts: contact details, school-track pricing
 * and the household device policy. They render loudly **in development only** —
 * they used to render loudly to everybody, which is a different thing entirely.
 * See `Todo`.
 */
import Link from 'next/link';

import { Icon } from '../components/icons';
import { LemonMark } from '../components/LemonMark';
import { Logo } from '../components/Logo';

/**
 * A note to ourselves, and only to ourselves (T-269).
 *
 * **These were rendering to the public.** The landing page carried two of them
 * in dashed red — "school-track prices to confirm", "household policy for Grade
 * 6/8 to confirm" — and three more standing in for the contact details, so a
 * visitor's first sight of the product included our own unfinished homework in
 * the colour the app uses for a wrong answer. A tester reported them as page
 * content, which is exactly what they were.
 *
 * They are useful to keep, though: deleting them would lose the list of what is
 * still owed. So they stay in the source and show only in development, where
 * the person who can resolve them is looking.
 */
function Todo({ children }: { children: React.ReactNode }) {
  /*
   * Opt-in, not development-by-default (T-269).
   *
   * Gating on `NODE_ENV` was the obvious call and the wrong one: QA tests the
   * dev server, so "hidden in production" meant "visible in every environment
   * anybody actually looks at". A tester reported all six placeholders as
   * shipped page content for the second round running, and was right to —
   * telling them it is the intended state would be asking them to ignore what
   * is on the screen.
   *
   * So the default is the finished page, everywhere, and the outstanding list
   * is one env var away for whoever is filling it in:
   *
   *     NEXT_PUBLIC_SHOW_TODOS=1 npm run dev:web
   */
  if (process.env.NEXT_PUBLIC_SHOW_TODOS !== '1') return null;
  return (
    <span className="border-wrong text-wrong bg-wrong-soft rounded-[4px] border border-dashed px-2 py-0.5 text-[12px] font-medium">
      {children}
    </span>
  );
}

/**
 * A section heading and its eyebrow, set the same way everywhere on this page.
 *
 * **The poster tracking is gone** (redesign handoff, § Type). It used to be
 * `uppercase` at `+0.04em`, on the argument that marketing is the one surface
 * where wide caps belong. The handoff sets every heading in the display face at
 * negative tracking, title case, and the eyebrow carries the caps — so the page
 * had two heading voices, one here and one in the hero. The eyebrow keeps the
 * caps because that is what makes it read as a label rather than a first line.
 */
function Head({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-ink-2 uppercase">{eyebrow}</span>
      <h2 className="font-display max-w-[24ch] text-[clamp(26px,3.6vw,42px)] leading-[1.08] font-extrabold tracking-[-0.025em] text-balance">
        {title}
      </h2>
    </div>
  );
}

/**
 * The hero's floating slices — decoration, desktop only.
 *
 * `aria-hidden`, `pointer-events-none`, and `hidden lg:block`: on a 375px screen
 * these would sit under the headline and spend the one screen a stranger gives
 * this page on ornament. The `--delay` on each is why they do not rise and fall
 * in lockstep, which reads as one object rather than three.
 */
function FloatingShapes() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      {SHAPES.map(([top, right, size, delay, spin]) => (
        <span
          key={delay}
          /* 60%, not the 25% this first shipped at. A yellow at a quarter
             opacity over near-black is olive, and the wedge strokes then read as
             a crosshair — three smudges that look like a rendering fault rather
             than decoration. Past about half it is plainly a lemon slice again,
             which is the only state worth having. */
          className={`animate-float absolute opacity-60 ${spin ? 'motion-safe:[&>svg]:animate-spin-slow' : ''}`}
          style={{ top, right, animationDelay: delay }}
        >
          <LemonMark size={size} />
        </span>
      ))}
    </div>
  );
}

/**
 * Where the three sit, how big, and how far out of step.
 *
 * `[top, right, size, delay, spin]`. Right-anchored so they trail off the edge
 * the composite is on rather than crowding the headline.
 */
const SHAPES = [
  ['8%', '6%', 72, '0s', true],
  ['62%', '2%', 44, '-3s', false],
  ['34%', '46%', 32, '-6s', false],
] as const;

/**
 * The hero's product composite — **an illustration, not a reading.**
 *
 * The handoff draws a slab of live-looking product here: days to the exam, a
 * readiness percentage, a trend across recent mocks. There is no session on this
 * page to read any of that from, and this product's whole argument is that it
 * does not print a number it cannot defend — so a composite that *looked* live
 * would be the first dishonest thing a visitor saw.
 *
 * It is therefore built as a picture and labelled as one: the caption says
 * "Sample", the whole thing is `aria-hidden` so a screen reader is not read
 * figures about a student who does not exist, and the sentence above it is where
 * the actual claim lives. Desktop only — at 390px the hero is the headline.
 */
function HeroComposite() {
  return (
    <div aria-hidden="true" className="relative hidden lg:block">
      <div className="bg-surface rounded-panel text-ink shadow-hero flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col items-center">
            <span className="text-caption text-ink-2 uppercase">Days to your exam</span>
            <span className="font-display num text-[44px] leading-none font-extrabold">43</span>
          </div>
          <span className="bg-brand-soft text-on-brand text-caption rounded-full px-3 py-1.5">
            Sample
          </span>
        </div>

        {/* The readiness bar. `--fill-to` is what the `fill` keyframe animates
            to, so the bar and the figure beside it can never disagree. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-2 text-[14px] font-semibold">Readiness</span>
            <span className="num text-ink text-[14px] font-semibold">62%</span>
          </div>
          <div className="bg-surface-2 h-2.5 overflow-hidden rounded-full">
            <div
              className="bg-brand animate-fill h-full rounded-full"
              style={{ '--fill-to': '62%', width: '62%' } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Recent mocks. Bars rather than a line: five readings is not a trend
            line, and drawing one would claim smoothness that is not there. */}
        <div className="flex flex-col gap-2">
          <span className="text-ink-2 text-[14px] font-semibold">Last five mocks</span>
          <div className="flex items-end gap-2">
            {MOCK_TREND.map((pct, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                {/*
                  Pixels, not a percentage.

                  `height: 38%` here resolves against the column, which is a flex
                  item with no definite height — so every bar computed to zero
                  and the card shipped with five numbers under an empty space.
                  `TRACK` is the 100% mark in pixels, which has a height whatever
                  the parent does.
                */}
                <div
                  className={`w-full rounded-t-[6px] ${i === MOCK_TREND.length - 1 ? 'bg-brand' : 'bg-brand-pale'}`}
                  style={{ height: `${Math.round((pct / 100) * TRACK)}px` }}
                />
                <span className="num text-ink-3 text-[11px]">{pct}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Five sample mock scores, rising. Illustration — see `HeroComposite`. */
const MOCK_TREND = [38, 44, 52, 57, 62] as const;

/** What 100% is worth in pixels, for the bars above. */
const TRACK = 96;

/**
 * The four steps, in the order a student does them.
 *
 * Step 03's promise — "works out how many a day you need" — is real: the daily
 * target comes from `planFor`, which divides the questions left by the days to
 * the exam date. It was a claim with nothing behind it until an admin could set
 * that date (T-269).
 */
const STEPS = [
  [
    '01',
    'Enter your phone',
    'We send a code by SMS. Type it in and choose a password. No email, no forms.',
  ],
  [
    '02',
    'Pick your exam',
    'Grade 6, Grade 8, Grade 12 Natural or Social, or a university exit-exam field. Every subject in it is included.',
  ],
  [
    '03',
    'Answer your daily few',
    'The app works out how many a day you need to reach 80% before your exam, and recalculates it every morning.',
  ],
  [
    '04',
    'Sit a full mock',
    '100 questions in 180 minutes, the same shape as the real paper. Every sitting is kept so you can watch the line move.',
  ],
] as const;

/**
 * The marquee of tracks.
 *
 * **Names, not question counts.** The handoff's marquee carries a count beside
 * each field — "Accounting & Finance 2,140" — and those are sample data. This
 * product has not got 2,140 Accounting questions and PRODUCT.md is explicit
 * that no figure may be printed that cannot be defended. A name is true; a
 * number next to it would be the first invented claim on the page.
 */
const MARQUEE = [
  'Accounting & Finance',
  'Computer Science',
  'Public Health',
  'Grade 12 Natural',
  'Grade 12 Social',
  'Grade 8',
  'Grade 6',
] as const;

/**
 * Three figures, and every one is checkable.
 *
 * The handoff puts three big numbers here and fills them with scale — students
 * enrolled, questions banked, fields covered. This product has no cohort and
 * says so a few sections down, so those numbers would be the one thing on the
 * page a reader could catch us inventing.
 *
 * These are facts about the product's shape instead: the mock is genuinely 100
 * questions in 180 minutes (D4), the free tier is genuinely ten questions with
 * the full explanation, and every published question genuinely carries a worked
 * solution because `publish-gate.ts` refuses one that does not.
 */
const STATS = [
  ['100', 'questions in a mock', 'Three hours, the shape of the real paper'],
  ['10', 'free questions', 'Full explanations, no card needed'],
  ['100%', 'answers explained', 'A question without its reasoning cannot be published'],
] as const;

/** The six tiles. Each one is a thing the product does, not a thing we claim. */
const FEATURES = [
  [
    'Every answer explained',
    'A one-sentence idea, the worked solution, and why each wrong option tempted you.',
  ],
  [
    'Timed mocks',
    '100 questions in 180 minutes, marked at the end, kept so you can watch the line move.',
  ],
  [
    'Readiness by topic',
    'Weighted by each topic\u2019s share of past papers, so you study what the paper is made of.',
  ],
  ['A plan to exam day', 'How many questions a day to reach 80%, recalculated every morning.'],
  ['Built for your phone', 'A 16px floor, 44px targets, and no download you did not ask for.'],
  ['Pay the way you pay', 'telebirr, CBE Birr, card, or a bank transfer with the reference.'],
] as const;

const TRACKS = [
  [
    'Ages 11–12',
    'Grade 6',
    ['Drawn from grades 4–6', 'Maths, English', 'Science, Social Studies'],
    false,
  ],
  [
    'Ages 13–14',
    'Grade 8',
    ['Drawn from grades 7–8', 'Maths, General Science', 'English, Social Studies'],
    false,
  ],
  [
    'Ages 17–18',
    'Grade 12',
    ['Drawn from grades 9–12', 'Natural or Social stream', 'Every subject in your stream'],
    true,
  ],
  ['University', 'Exit exam', ['Computer Science', 'Public Health', 'Accounting & Finance'], false],
] as const;

const FAQ = [
  [
    'Do I need Telegram to sign up?',
    'No. You sign up with your phone number and a code sent by SMS. You can connect Telegram afterwards if you want the daily question in your chat, but it is optional.',
  ],
  [
    'What does “beaten 62%” mean?',
    // Names the figure, because the app does. A student who has been taught the
    // word here meets it again on `/progress` instead of two unexplained
    // percentages — coverage, and the readiness beside it.
    'That is your coverage. It counts the questions you answered correctly and could explain — not lucky guesses. The total is the number of questions in your track, and we show it, so you can check the figure yourself. Readiness is the other figure: how you are doing on the questions you have tried, weighted by each topic’s share of past papers.',
  ],
  [
    'Is the free tier really free?',
    'Yes. A limited number of questions in every subject, with the full explanation — not a teaser that hides the answer. The count remaining is always shown.',
  ],
  [
    'Can I use it without internet?',
    'Save questions while you have signal, answer them offline, and they sync when you reconnect. Built for metered and slow connections.',
  ],
  [
    'Will my name appear on the leaderboard?',
    'Only a display name you choose, never your real name. Grade 6 and 8 students are not listed at all unless they choose to be.',
  ],
  [
    'What if I miss a day?',
    'Nothing breaks. Tomorrow’s target adjusts by one or two questions and your streak keeps counting. Missing a day is not a failure and the app will not treat it as one.',
  ],
  [
    'Can I share one account with a friend?',
    'Two devices can be signed in at once, and school tracks get four so a household sharing a phone is not fighting over it. Signing in on one more ends the oldest session rather than locking you out.',
  ],
] as const;

/**
 * How to reach a person, once there is a person to reach.
 *
 * `value` is the real thing and `null` means it is still owed — which is what
 * `todo` names, in development only. Nothing here may be invented: a phone
 * number on a landing page is a promise, and a wrong one is worse than none.
 */
const CONTACTS: readonly { label: string; value: string | null; todo: string; why: string }[] = [
  {
    label: 'Telegram',
    value: null,
    todo: '@handle to add',
    why: 'Fastest. Someone answers during the day.',
  },
  {
    label: 'Phone',
    value: null,
    todo: '+251 … to add',
    why: 'For payment questions and bank transfers.',
  },
  {
    label: 'Email',
    value: null,
    todo: 'address to add',
    why: 'For schools and bulk enquiries.',
  },
];

/**
 * The reading measure, applied per section rather than by the shell.
 *
 * `AppShell` used to wrap this page in `max-w-[1080px] px-5` like any other
 * unframed screen. The redesign alternates light sections at this measure with
 * full-bleed dark bands, and a band inside a 1080px padded box is a card. So the
 * shell hands `/` the full width and each section says which it is: `MEASURE`
 * for the ones that are read, `BAND` for the three that are dark.
 */
const MEASURE = 'mx-auto w-full max-w-[1080px] px-5';

/** A full-bleed dark band. Its own contents still sit on `MEASURE`. */
const BAND = 'bg-ink-deep text-on-deep w-full px-5';

/**
 * The footer's two link columns.
 *
 * **Only routes that exist.** The handoff's footer carries Pricing, Blog,
 * Careers, Press and a Privacy policy; this product has one page of each of the
 * first five and none of the last, and a footer link to a 404 is the same broken
 * promise as a dead social chip. Every href below is a route in this app or an
 * anchor on this page, and `layout-measure.test.ts` holds that.
 */
const FOOTER_COLUMNS: readonly (readonly [string, readonly (readonly [string, string])[]])[] = [
  [
    'The product',
    [
      ['How it works', '#how'],
      ['Tracks', '#tracks'],
      ['Plans and prices', '#plans'],
      ['Questions people ask', '#faq'],
    ],
  ],
  [
    'Get started',
    [
      ['Create an account', '/signup'],
      ['Sign in', '/signin'],
      ['Talk to a person', '#contact'],
    ],
  ],
];

/** Where the product actually has an account. Empty until it does. */
const SOCIALS: readonly { name: string; href: string }[] = [];

export function LandingScreen() {
  return (
    <div className="flex flex-col">
      {/*
        ---------------------------------------------------------------- hero

        A dark dotted ground, per the handoff. `ink-deep` is a SURFACE here, not
        a dark mode — this product has one theme and the hero is simply a dark
        object on a light page, the way the exam band and the footer are.
      */}
      <section className={`${BAND} relative overflow-hidden py-16 sm:py-24`}>
        {/* The dot grid. `aria-hidden` and pointer-events-none: it is texture,
            and a screen reader reading a background is noise. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-100"
          style={{
            backgroundImage:
              'radial-gradient(color-mix(in srgb, var(--color-on-deep) 9%, transparent) 1.2px, transparent 1.7px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Floating decoration — desktop only. On a phone it would sit under the
            headline and steal the one screen a visitor gives this page. */}
        <FloatingShapes />

        <div className="relative mx-auto grid w-full max-w-[1080px] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col items-start gap-7">
            <Logo size={34} wordmark onDark />

            <span className="border-on-deep/15 bg-on-deep/5 text-caption inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
              {/* The pulsing dot. Decoration beside a word, never the word. */}
              <span
                aria-hidden="true"
                className="bg-accent animate-pulse-dot size-2 rounded-full"
              />
              2026 exam
            </span>

            <h1 className="font-display max-w-[16ch] text-[clamp(40px,6vw,80px)] leading-[1.04] font-extrabold tracking-[-0.035em] text-balance">
              Walk into your exit exam <span className="text-brand">already knowing</span>{' '}
              you&rsquo;ll pass.
            </h1>

            <p className="max-w-[48ch] text-[clamp(16px,2vw,19px)] leading-[1.6] text-on-deep-2">
              Thousands of past questions, every one explained — the idea behind it, the worked
              solution, and why each wrong option tempted you. Work through them and you walk in
              ready, not hoping.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                className="bg-brand hover:bg-brand-hover text-on-brand inline-flex min-h-12 items-center rounded-full px-7 text-[16px] font-semibold"
                href="/signup"
              >
                Start practising free
              </Link>
              <a
                className="inline-flex min-h-12 items-center rounded-full border-on-deep/20 text-on-deep hover:bg-on-deep/5 border px-7 text-[16px] font-semibold"
                href="#plans"
              >
                See plans
              </a>
            </div>

            <p className="text-caption text-on-deep-3">
              Ten free questions in every subject, explanations included. No card needed.
            </p>
          </div>

          {/* The product composite. Decorative sample data on a public page —
              there is no session here to read a real figure from, and inventing
              one that looked live would be the dishonesty this product is built
              against. It is drawn as an illustration and labelled as one. */}
          <HeroComposite />
        </div>
      </section>

      {/* ------------------------------------------------------- marquee */}
      <section
        aria-label="Exams covered"
        className="border-border w-full overflow-hidden border-b py-5"
        style={{
          maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
        }}
      >
        {/* Duplicated so -50% lands exactly on the second copy and the loop has
            no seam. The copy is `aria-hidden` — a screen reader should hear the
            list once. */}
        <div className="animate-marquee flex w-max gap-10">
          {[0, 1].map((pass) => (
            <ul
              key={pass}
              className="flex shrink-0 gap-10"
              {...(pass === 1 ? { 'aria-hidden': 'true' as const } : {})}
            >
              {MARQUEE.map((name) => (
                <li key={name} className="text-ink-3 text-[15px] font-semibold whitespace-nowrap">
                  {name}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- stats */}
      <section className={`${MEASURE} grid gap-6 py-14 sm:grid-cols-3`}>
        {STATS.map(([value, label, why]) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="font-display num text-[clamp(36px,5vw,56px)] leading-none font-extrabold">
              {value}
            </span>
            <span className="text-ink text-[16px] font-semibold">{label}</span>
            <span className="text-ink-2 text-[14px] leading-[1.5]">{why}</span>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------ features */}
      <section className={`${MEASURE} border-border flex flex-col gap-8 border-t py-14`}>
        <Head eyebrow="What you get" title="The explanation is the product" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, body]) => (
            <div
              key={title}
              className="border-border bg-surface flex flex-col gap-2 rounded-panel border p-6"
            >
              <h3 className="font-display text-[18px] font-bold">{title}</h3>
              <p className="text-ink-2 text-[15px] leading-[1.55]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ simulator band */}
      <section className={`${BAND} flex flex-col gap-6 py-14 sm:py-20`}>
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
          <span className="text-caption text-on-deep-3 uppercase">Exam simulator</span>
          <h2 className="font-display max-w-[20ch] text-[clamp(28px,4vw,48px)] leading-[1.07] font-extrabold tracking-[-0.025em]">
            Sit the paper before you sit the paper.
          </h2>
          <p className="max-w-[56ch] text-[17px] leading-[1.6] text-on-deep-2">
            100 questions, 180 minutes, one clock. Flag what you want to come back to, jump the
            grid, and get every answer explained the moment you submit — not a score and a shrug.
          </p>
          <div className="flex flex-wrap gap-6 pt-2">
            {[
              ['100', 'questions'],
              ['180', 'minutes'],
              ['1', 'clock, no pausing'],
            ].map(([v, l]) => (
              <div key={l} className="flex flex-col">
                <span className="font-display num text-[32px] leading-none font-extrabold">
                  {v}
                </span>
                <span className="text-on-deep-3 text-[14px]">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- how */}
      <section
        id="how"
        className={`${MEASURE} border-border flex flex-col gap-6 border-t py-14 scroll-mt-4`}
      >
        <Head eyebrow="Four steps · about two minutes" title="How to use it" />
        {/*
          Four cards, not one slab.

          This was a single `rounded-[8px] border-2` frame with 2px ink rules
          between the steps — the heavy-border look the whole app carried before
          the redesign. The handoff's object is a white card with a hairline and
          a 16px radius, and four of them read as four steps rather than as one
          table someone has drawn lines in.
        */}
        <ol className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([n, title, body]) => (
            <li
              key={n}
              className="border-border bg-surface rounded-card flex flex-col gap-2 border p-5"
            >
              <span className="bg-brand-soft text-on-brand num text-caption inline-flex size-7 items-center justify-center rounded-full">
                {n}
              </span>
              <h3 className="font-display text-[17px] font-bold">{title}</h3>
              <p className="text-ink-2 text-[14px] leading-[1.5]">{body}</p>
            </li>
          ))}
        </ol>
        <p className="text-ink-2 max-w-[64ch] text-[14px]">
          Your name, school and region are asked for later — after you have used it, and only
          because they unlock the school leaderboard.
        </p>
      </section>

      {/* -------------------------------------------------------- tracks */}
      <section
        id="tracks"
        className={`${MEASURE} border-border flex flex-col gap-6 border-t py-14 scroll-mt-4`}
      >
        <Head eyebrow="Choose the exam you are sitting" title="Tracks" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/*
            Pressable, because they look it (T-269).

            These were inert `<div>`s, and one of the four was filled brand
            yellow — which in a row of otherwise pale cards reads as the one
            already chosen. On a section headed "Choose the exam you are
            sitting", a card that looks selected and cannot be selected is a
            trap, and a tester named it as one. Either the emphasis goes or the
            cards do something; they do something, because "choose your exam" is
            what this page is for.

            The yellow now says what it means rather than implying a state.
          */}
          {TRACKS.map(([age, name, points, highlight]) => (
            <Link
              key={name}
              href="/signup"
              className={`rounded-card flex flex-col gap-2 border p-5 ${
                // The emphasised one gets the brand wash and a brand hairline,
                // not a solid fill: a filled card in a row of pale ones reads as
                // the one already chosen, which a tester reported as a trap.
                highlight ? 'bg-brand-soft border-brand' : 'bg-surface border-border'
              }`}
            >
              <span className="text-caption text-ink-2 uppercase">
                {highlight ? `${age} · most students` : age}
              </span>
              <h3 className="font-display text-[20px] font-extrabold">{name}</h3>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-[14px]">
                {points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Link>
          ))}
        </div>

        <div id="plans" className="flex flex-wrap gap-4 scroll-mt-20">
          {/* Same reasoning as the track cards: the filled one read as chosen.
              It is the best value per month, so it says that. */}
          {[
            ['6 months', 'Br 500', ''],
            ['12 months', 'Br 800', 'best value'],
            ['Free tier', 'Br 0', ''],
          ].map(([per, price, why]) => (
            <Link
              key={per}
              href="/signup"
              className={`rounded-card min-w-[180px] border px-6 py-5 ${
                why ? 'bg-brand-soft border-brand' : 'bg-surface border-border'
              }`}
            >
              <span className="text-caption text-ink-2 uppercase">
                {why ? `${per} · ${why}` : per}
              </span>
              <div className="font-display num text-[34px] leading-none font-extrabold">
                {price}
              </div>
            </Link>
          ))}
        </div>
        <p className="text-ink-2 flex flex-wrap items-center gap-2 text-[14px]">
          One price for the whole track — every subject, not one at a time. Pay with Telebirr or CBE
          Birr, or send a bank transfer and paste the reference.
          <Todo>school-track prices to confirm</Todo>
        </p>
      </section>

      {/* ----------------------------------------------------------- faq */}
      <section
        id="faq"
        className={`${MEASURE} border-border flex flex-col gap-6 border-t py-14 scroll-mt-4`}
      >
        <Head eyebrow="Questions people actually ask" title="FAQ" />
        <div className="border-border bg-surface rounded-card overflow-hidden border">
          {/*
            Every question here has an answer, and now looks like it does.

            `list-none` removed the disclosure triangle and nothing replaced it,
            so six questions sat as plain bold text with no affordance of any
            kind. A tester read the whole section as questions printed without
            answers — the reasonable conclusion, since the only way to discover
            otherwise was to click text that gave no sign it was clickable.

            The marker is drawn rather than left to the browser because the
            native one differs on every platform and sits outside the padding.
            It rotates on open, which is the one thing that says "there is more
            here" before you press it.
          */}
          {FAQ.map(([q, a], i) => (
            <details
              key={q}
              className={`group ${i < FAQ.length - 1 ? 'border-border border-b' : ''}`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-[16px] font-semibold">
                {q}
                <span
                  aria-hidden="true"
                  className="text-ink-2 shrink-0 transition-transform duration-150 group-open:rotate-45"
                >
                  <Icon name="plus" size={18} />
                </span>
              </summary>
              <p className="text-ink-2 max-w-[70ch] px-4 pb-4 text-[15px]">{a}</p>
            </details>
          ))}
          {/*
            The household question is a seventh FAQ row, not a footnote.

            It sat outside the list as a bare `<div>` styled like the six above
            it — same border, same padding, same type — with its answer printed
            inline and no disclosure marker. A tester reported it as a row that
            invites a tap and does nothing, which is exactly what it was: the
            one entry that got special-cased because it carried a placeholder,
            and then never converted when the rest became collapsible.

            It lives in `FAQ` now, so there is one list and one behaviour.
          */}
          <Todo>household policy for Grade 6/8 to confirm</Todo>
        </div>
      </section>

      {/* ------------------------------------------------------- contact */}
      <section
        id="contact"
        className={`${MEASURE} border-border flex flex-col gap-6 border-t py-14 scroll-mt-4`}
      >
        <Head eyebrow="Contact us" title="Talk to a person" />
        {/*
          A card only exists once there is something on it to contact.

          Every one of these was a label, a red "to add" marker and a sentence
          about how fast we answer — so hiding the markers would have left three
          cards promising a reply through a channel with no address on it, which
          is worse than not offering the channel. `value` is the card: null and
          it does not render, and the section goes with the last one.
        */}
        {CONTACTS.some((contact) => contact.value !== null) ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {CONTACTS.filter((contact) => contact.value !== null).map((contact) => (
              <div key={contact.label} className="card flex flex-col items-start gap-2">
                <span className="text-caption text-ink-2 uppercase">{contact.label}</span>
                <span className="text-[16px] font-semibold">{contact.value}</span>
                <span className="text-ink-2 text-[14px]">{contact.why}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-2 max-w-[54ch] text-[15px]">
            {/* Said plainly rather than dressed as three empty cards. */}
            We are setting up our support channels. Until then, sign in and use the question thread
            on any topic — a person reads those.
          </p>
        )}
        {CONTACTS.filter((contact) => contact.value === null).map((contact) => (
          <Todo key={contact.label}>{contact.todo}</Todo>
        ))}
      </section>

      {/*
        ---------------------------------------------------------------- footer

        Four columns on desktop, stacked below (redesign handoff, § Footer), on
        the same `ink-deep` ground as the hero and the exam band — the page opens
        and closes on the dark object.

        **The honesty note stays, and stays first.** It was a dashed box in the
        old footer saying what we are *not* showing: no testimonials, no pass
        rates, no school logos, because we have not run a cohort through an exam
        yet. The redesign has no slot for it, and it is the most important
        paragraph on the page — PRODUCT.md's one rule, written where a sceptical
        reader looks for the catch. So it gets the first column.
      */}
      <footer className={`${BAND} mt-14 py-14`}>
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-4">
              <Logo size={30} wordmark onDark />
              <p className="text-on-deep-2 max-w-[40ch] text-[14px] leading-[1.55]">
                No testimonials, no pass rates, no school logos. We have not run a cohort through an
                exam yet, so we have no such numbers — and inventing them would break the only rule
                this product has. When there is evidence it will appear here, with its method
                attached.
              </p>
            </div>

            {FOOTER_COLUMNS.map(([heading, links]) => (
              <nav key={heading} aria-label={heading} className="flex flex-col gap-3">
                <span className="text-caption text-on-deep-3 uppercase">{heading}</span>
                <ul className="flex list-none flex-col gap-0 p-0">
                  {links.map(([label, href]) => (
                    <li key={href}>
                      {/* 44px of target in a footer too. A 20px link in a stack
                          of them is the one a thumb misses, and the layout sweep
                          does not stop checking at the fold. */}
                      <a
                        href={href}
                        className="text-on-deep-2 hover:text-on-deep -mx-1 inline-flex min-h-11 items-center px-1 text-[15px]"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <div className="flex flex-col gap-3">
              <span className="text-caption text-on-deep-3 uppercase">Elsewhere</span>
              {/*
                Social links appear when there are links.

                These were three heavy bordered chips reading "Facebook link",
                "TikTok link", "Telegram link" — buttons in every respect except
                going anywhere. Three dead controls in a footer is a page that
                has been abandoned, which is the opposite of what a footer is
                for.
              */}
              {SOCIALS.length > 0 ? (
                <ul className="flex list-none flex-col gap-0 p-0">
                  {SOCIALS.map(({ name, href }) => (
                    <li key={name}>
                      <a
                        href={href}
                        className="text-on-deep-2 hover:text-on-deep -mx-1 inline-flex min-h-11 items-center px-1 text-[15px]"
                      >
                        {name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <p className="text-on-deep-2 max-w-[32ch] text-[14px] leading-[1.55]">
                    Nowhere yet. When there is an account to follow it will be linked here rather
                    than named without a link.
                  </p>
                  <Todo>social links to add — Facebook, TikTok, Telegram</Todo>
                </>
              )}
            </div>
          </div>

          <p className="border-on-deep/10 text-on-deep-3 max-w-[64ch] border-t pt-6 text-[13px] leading-[1.6]">
            Everything here is in English, because the exam is in English — the questions, the
            worked solutions and the app itself. We do not publish your real name anywhere.
          </p>
        </div>
      </footer>
    </div>
  );
}
