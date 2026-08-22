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
 * The eight `<Todo>` markers are unfilled facts: social links, contact details,
 * school-track pricing and the household device policy. They render loudly on
 * purpose so the page cannot go live with an invented phone number.
 */
import Link from 'next/link';

import { Logo } from '../components/Logo';

/** An unfilled fact. Deliberately ugly — see the note above. */
function Todo({ children }: { children: React.ReactNode }) {
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
          {FAQ.map(([q, a], i) => (
            <details key={q} className={i < FAQ.length - 1 ? 'border-border border-b' : ''}>
              <summary className="cursor-pointer list-none p-4 text-[16px] font-semibold">
                {q}
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
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Telegram', '@handle to add', 'Fastest. Someone answers during the day.'],
            ['Phone', '+251 … to add', 'For payment questions and bank transfers.'],
            ['Email', 'address to add', 'For schools and bulk enquiries.'],
          ].map(([label, todo, why]) => (
            <div key={label} className="card flex flex-col items-start gap-2">
              <span className="text-caption text-ink-2 uppercase">{label}</span>
              <Todo>{todo}</Todo>
              <span className="text-ink-2 text-[14px]">{why}</span>
            </div>
          ))}
        </div>
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

        <div className="flex flex-wrap gap-3">
          {['Facebook', 'TikTok', 'Telegram'].map((name) => (
            <span
              key={name}
              className="border-ink bg-surface inline-flex items-center gap-2 rounded-[6px] border-2 px-4 py-2 text-[14px] font-semibold"
            >
              {name} <Todo>link</Todo>
            </span>
          ))}
        </div>

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
