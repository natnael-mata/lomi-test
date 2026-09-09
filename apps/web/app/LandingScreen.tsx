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
  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <span className="border-wrong text-wrong bg-wrong-soft rounded-[4px] border border-dashed px-2 py-0.5 text-[12px] font-medium">
      {children}
    </span>
  );
}

/** A section heading and its eyebrow, set the same way everywhere on this page. */
function Head({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-ink-2 uppercase">{eyebrow}</span>
      {/* Marketing is the one surface where the source style's poster tracking
          belongs; in product the display face is set tight. */}
      <h2 className="font-display text-[clamp(26px,3.6vw,42px)] leading-[1.08] font-extrabold tracking-[0.04em] uppercase">
        {title}
      </h2>
    </div>
  );
}

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
    'It counts the questions you answered correctly and could explain — not lucky guesses. The total is the number of questions in your track, and we show it, so you can check the figure yourself.',
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

/** Where the product actually has an account. Empty until it does. */
const SOCIALS: readonly { name: string; href: string }[] = [];

export function LandingScreen() {
  return (
    <div className="flex flex-col">
      {/* ---------------------------------------------------------- hero */}
      <section className="flex flex-col gap-8 py-14">
        <Logo size={38} wordmark />

        <h1 className="font-display max-w-[16ch] text-[clamp(32px,5.4vw,60px)] leading-[1.06] font-extrabold tracking-[0.03em] uppercase text-balance">
          The shortcuts are closed. The{' '}
          <mark className="bg-brand text-ink rounded-[10px] px-1">questions</mark> are open.
        </h1>

        <p className="text-ink-2 max-w-[54ch] text-[clamp(17px,2vw,20px)] leading-[1.6]">
          Exams are watched far more closely than they used to be, and the old ways through them are
          gone. What is still open is the bank the paper is drawn from — thousands of past
          questions, every one explained. Work through it and you walk in ready, not hoping.
        </p>

        <p className="text-ink-2 max-w-[48ch] text-[clamp(17px,2vw,20px)] leading-[1.6]">
          Start in September and it is three questions a day. Leave it until May and it is
          twenty-four.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link className="btn-primary w-auto px-6" href="/signin">
            Start with your phone number
          </Link>
          <a className="btn-ghost w-auto px-6" href="#how">
            See how it works
          </a>
        </div>

        <p className="text-caption text-ink-2 uppercase">
          Free questions in every subject, with the full explanation. No card needed.
        </p>
      </section>

      {/* --------------------------------------------------------- about */}
      <section className="border-border flex flex-col gap-6 border-t py-14">
        <Head eyebrow="About Lomi-Exams" title="The explanation is the product" />
        <p className="text-ink-2 max-w-[64ch] text-[17px] leading-[1.6]">
          Tighter exam control is good news for anyone who prepares. It means the work counts again,
          and the student who did it is no longer competing with someone who found a way round.
        </p>
        <p className="text-ink-2 max-w-[64ch] text-[17px] leading-[1.6]">
          Most practice apps tell you the answer. Lomi-Exams tells you <em>why</em> — a one-sentence
          idea, the worked solution, and a note on why each wrong option tempted you. A question
          that cannot be explained is never published, and that rule is enforced in the code rather
          than promised in an advert.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              'One rule',
              'Never an answer we cannot defend',
              'An unverified answer stays unpublished. A confidently wrong answer key is worse than a missing question.',
            ],
            [
              'Built for your phone',
              'Works on a slow connection',
              'Save questions, answer them offline, sync when you have signal. Made for a five-inch Android, not a laptop.',
            ],
            [
              'Honest numbers',
              'Every figure can be checked',
              'Your readiness is a count of questions you have beaten, out of a total we show you. Nothing is estimated.',
            ],
          ].map(([eyebrow, title, body]) => (
            <div key={title} className="card flex flex-col gap-2">
              <span className="text-caption text-ink-2 uppercase">{eyebrow}</span>
              <h3 className="font-display text-[18px] font-bold">{title}</h3>
              <p className="text-ink-2 text-[14px] leading-[1.5]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- how */}
      <section id="how" className="border-border flex flex-col gap-6 border-t py-14">
        <Head eyebrow="Four steps · about two minutes" title="How to use it" />
        <ol className="border-ink grid list-none gap-0 overflow-hidden rounded-[8px] border-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([n, title, body], i) => (
            <li
              key={n}
              className={`bg-surface flex flex-col gap-2 p-5 ${
                i < STEPS.length - 1 ? 'border-ink border-b-2 lg:border-r-2 lg:border-b-0' : ''
              }`}
            >
              <span className="text-caption text-ink-2">{n}</span>
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
      <section id="tracks" className="border-border flex flex-col gap-6 border-t py-14">
        <Head eyebrow="Choose the exam you are sitting" title="Tracks" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRACKS.map(([age, name, points, highlight]) => (
            <div
              key={name}
              className={`border-ink flex flex-col gap-2 rounded-[8px] border-2 p-5 ${
                highlight ? 'bg-brand' : 'bg-surface'
              }`}
            >
              <span className="text-caption text-ink-2 uppercase">{age}</span>
              <h3 className="font-display text-[20px] font-extrabold">{name}</h3>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-[14px]">
                {points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          {[
            ['6 months', 'Br 500', false],
            ['12 months', 'Br 800', true],
            ['Free tier', 'Br 0', false],
          ].map(([per, price, highlight]) => (
            <div
              key={per as string}
              className={`border-ink min-w-[180px] rounded-[8px] border-2 px-6 py-5 ${
                highlight ? 'bg-brand' : 'bg-surface'
              }`}
            >
              <span className="text-caption text-ink-2 uppercase">{per}</span>
              <div className="font-display num text-[34px] leading-none font-extrabold">
                {price}
              </div>
            </div>
          ))}
        </div>
        <p className="text-ink-2 flex flex-wrap items-center gap-2 text-[14px]">
          One price for the whole track — every subject, not one at a time. Pay with Telebirr or CBE
          Birr, or send a bank transfer and paste the reference.
          <Todo>school-track prices to confirm</Todo>
        </p>
      </section>

      {/* ----------------------------------------------------------- faq */}
      <section id="faq" className="border-border flex flex-col gap-6 border-t py-14">
        <Head eyebrow="Questions people actually ask" title="FAQ" />
        <div className="border-border bg-surface overflow-hidden rounded-[8px] border">
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
            <details key={q} className={`group ${i < FAQ.length - 1 ? 'border-border border-b' : ''}`}>
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
          <div className="border-border border-t p-4">
            <p className="text-ink-2 flex flex-wrap items-center gap-2 text-[15px]">
              Can I share one account with a friend? Two devices can be signed in at once.
              <Todo>household policy for Grade 6/8 to confirm</Todo>
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- contact */}
      <section id="contact" className="border-border flex flex-col gap-6 border-t py-14">
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

      {/* -------------------------------------------------------- footer */}
      <footer className="border-ink flex flex-col gap-7 border-t-2 py-12">
        <div className="border-ink max-w-[70ch] rounded-[8px] border-2 border-dashed p-5">
          <span className="text-caption text-ink-2 uppercase">What we are not showing you</span>
          <p className="text-ink-2 mt-2 text-[14px] leading-[1.55]">
            No testimonials, no pass rates, no school logos. We have not run a cohort through an
            exam yet, so we have no such numbers — and inventing them would break the only rule this
            product has. When there is evidence it will appear here, with its method attached.
          </p>
        </div>

        {/*
          Social links appear when there are links.

          These were three heavy bordered chips reading "Facebook link",
          "TikTok link", "Telegram link" — buttons in every respect except
          going anywhere. Three dead controls in a footer is a page that has
          been abandoned, which is the opposite of what a footer is for.
        */}
        {SOCIALS.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {SOCIALS.map(({ name, href }) => (
              <a
                key={name}
                href={href}
                className="border-ink bg-surface inline-flex items-center gap-2 rounded-[6px] border-2 px-4 py-2 text-[14px] font-semibold"
              >
                {name}
              </a>
            ))}
          </div>
        ) : (
          <Todo>social links to add — Facebook, TikTok, Telegram</Todo>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-caption text-ink-2 uppercase">Lomi-Exams</span>
          <p className="text-ink-2 max-w-[64ch] text-[14px] leading-[1.55]">
            Everything here is in English, because the exam is in English — the questions, the
            worked solutions and the app itself. We do not publish your real name anywhere.
          </p>
        </div>
      </footer>
    </div>
  );
}
