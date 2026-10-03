/**
 * Every word the interface says (T-210).
 *
 * **One object per locale, and the type makes them agree.** `Copy` is derived
 * from the English dictionary, so a missing Amharic key is a compile error
 * rather than a screen that silently falls back to English — which is the
 * failure mode that makes a half-translated app feel broken rather than
 * unfinished.
 *
 * Interpolation is a function, not a `{0}` placeholder. Ethiopic word order is
 * not English word order, so a translator who cannot move the number relative to
 * the words around it cannot write a correct sentence — and a template that
 * forces "3 questions" ordering into every language is how you get copy that
 * reads like a machine.
 *
 * ⚠️ **The Amharic below is a first draft and needs a native review.** It was
 * written to be structurally correct and to keep the product's voice; the
 * wording is Bereket's call. Nothing here is user-visible in Amharic yet — there
 * is no locale switcher, and `DEFAULT_LOCALE` is English — so a wrong string
 * costs a review comment rather than a student's confusion.
 */

/**
 * A wait, said the way a person would say it (T-268).
 *
 * Seconds are right up to about a minute and a half and wrong after that: an
 * escalated rate limiter hands back numbers like 1103 or 84238, and "in 84238
 * seconds" is a sum, not a sentence. Nobody works out that it means tomorrow.
 *
 * Deliberately coarse above a minute — "in 18 minutes" rather than "18m 23s" —
 * because a student reading this is deciding whether to wait or come back, and
 * the seconds do not change that decision.
 */
export function plainDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 90) return `${whole}s`;
  const minutes = Math.round(whole / 60);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'an hour' : `${hours} hours`;
}

export const en = {
  common: {
    tryAgain: 'Try again',
    cancel: 'Cancel',
    save: 'Save',
    back: 'Back',
    next: 'Next',
    somethingSaved: 'Nothing you have answered is lost — your work is saved as you go.',
  },

  importer: {
    title: 'Upload questions',
    intro:
      'Questions arrive as drafts. Nothing you upload reaches a student until a reviewer publishes it.',
    pickFile: 'Choose a CSV file',
    orPaste: 'Or paste the file contents',
    upload: 'Upload',
    uploading: 'Reading the file…',
    // 22 now, six of them optional — a file may stop at `status` and still
    // import, it just lands with blockers on it.
    formatHint: 'Use the columns in docs/question_import_template.csv.',

    read: 'Rows read',
    created: 'Added',
    updated: 'Updated',
    rejected: 'Not taken',
    nothingRead: 'That file had no rows in it. Check it is the right file and try again.',
    couldNotUpload: 'The upload did not go through. Nothing was changed — try again.',
    allTaken: 'Every row was taken. They are drafts until a reviewer publishes them.',
    /*
     * What the ADDED figure means, said without claiming anything about the
     * rows that were not added.
     *
     * The tile used `allTaken`, so a file with one good row and one bad one
     * showed "ADDED 0 — Every row was taken", contradicting the number directly
     * above it. Whether every row was taken is the *paragraph's* job, and the
     * paragraph already gets it right.
     */
    addedAreDrafts: 'Added as drafts. A reviewer publishes them.',
    someRejected: (count: number) =>
      `${count} row${count === 1 ? '' : 's'} could not be taken. Each one says why below.`,
    line: (n: number) => `line ${n}`,
  },

  choose: {
    notReady: 'Being written',
    notReadyWhy: 'No questions in this programme yet. Pick another for now.',
    questionsAvailable: (count: number) => `${count} question${count === 1 ? '' : 's'} ready`,
    setUp: 'Set up your plan',
    title: 'Which programme are you sitting?',
    intro: 'This decides every question you practise. You can change it later.',
    working: 'Loading programmes…',
    couldNotLoad: 'The programmes could not be loaded. Nothing is lost — try again.',
    none: 'No programmes are available yet. Check back shortly.',

    retakerQuestion: 'Have you sat the exit exam before?',
    retakerYes: 'Yes, I am retaking it',
    retakerNo: 'No, this is my first time',
    retakerWhy:
      'It changes nothing about your questions today. We ask so we can help retakers better later.',

    /*
     * The exam-day note (redesign handoff, § Onboarding).
     *
     * The handoff writes it as settled fact — "Exam day: Thursday, November 12.
     * That's 43 days, so your plan covers every topic at least twice" — on a
     * screen where nothing has been chosen yet and, for most programmes here,
     * where no date has been set. So it renders only when the selected field
     * actually carries one, and the sentence about coverage is dropped: it is a
     * claim about a plan that does not exist until the choice is saved.
     */
    examDayLabel: 'Exam day',
    examDayIn: (days: number) =>
      days <= 0
        ? 'That date has passed — tell us if it has moved.'
        : `That is ${days} day${days === 1 ? '' : 's'} away. Your daily target is worked out from it, and again every morning.`,
    // Said plainly rather than left blank, and it names who can fix it. A
    // missing date is not the student's problem to solve.
    examDayUnset:
      'No sitting date is set for this programme yet. Everything else works; the daily target starts once there is one.',
    fieldLegend: 'Your programme',

    confirm: 'Start practising',
    saving: 'Saving…',
    couldNotSave: 'That did not save. Choose again — nothing else is affected.',
    chosen: (name: string) => `You are practising ${name}.`,
    change: 'Change programme',
  },

  nav: {
    /*
     * The mark's accessible name (T-269).
     *
     * It is the only route to `/home` in the whole interface — nothing else
     * linked there — so it cannot be an unlabelled image to a screen reader.
     */
    home: 'Lomi-Exams home',
    signedInAs: 'Signed in as',
    /*
     * Five destinations, down from six (redesign, 2026-10-01).
     *
     * Today replaces the hub, Mocks replaces Mock, and Account absorbs Access.
     * Standing and Ask leave the bar — their routes stay and stay linked, from
     * Progress and from Today — because six icons on a 375px screen was already
     * the limit DESIGN.md warned about, and the bar is for the five places a
     * student goes daily.
     */
    today: 'Today',
    practice: 'Practice',
    mocks: 'Mocks',
    progress: 'Progress',
    account: 'Account',
    exam: 'Mock',
    standing: 'Standing',
    // "Ask", not "Community" — it says what you do there, and it is shorter,
    // which matters in a six-item bar on a phone.
    community: 'Ask',
    checkout: 'Access',

    /*
     * Two navigations, two names (T-269).
     *
     * The bar and the pill are the same six destinations in two shapes, and
     * both carried `aria-label="Main"` — so the markup holds two identically
     * named navigation landmarks at once. Only one is ever visible, so assistive
     * tech sees one at a time and nothing is broken, but a landmark list with
     * "Main" twice in it is a smell, and it costs nothing to say which is which.
     */
    main: 'Main',
    /* The sidebar's access card. Says what a student asks this product most. */
    accessLabel: 'Access until',
    manage: 'Manage plan',
    freePlan: 'Free plan',
    freePlanBody: 'Ten free questions',
    seePlans: 'See plans',
    mainBottom: 'Main, bottom bar',
    accessUntil: (date: string) => `Access until ${date}`,
  },

  theme: {
    // Says which theme is on and what pressing it does. Half of that sentence
    // on its own leaves somebody guessing which half they are looking at.
    lightSwitchToDark: 'Light · switch to dark',
    darkSwitchToLight: 'Dark · switch to light',
  },

  answer: {
    // The words that sit beside a resolved option. Short because they share a
    // 56px row with the option text, and set in capitals with an icon so the
    // row still reads in greyscale.
    correct: 'Correct',
    yours: 'Yours',
    selected: 'Selected',
  },

  account: {
    title: 'This account',
    devicesTitle: 'Where you are signed in',
    // The account's own cap, from the server. School tracks get four (T-260),
    // so a fixed "two" here contradicted the four rows printed under it.
    devicesIntro: (max: number) =>
      `${max} devices at a time. Signing in on one more ends the oldest.`,
    thisDevice: 'This device',
    unknownDevice: 'Unknown device',
    signedInAt: (when: string) => `Signed in ${when}`,
    lastSeen: (when: string) => `Last used ${when}`,
    revoke: 'Sign this one out',
    revoking: 'Signing out…',
    noDevices: 'Nothing else is signed in.',
    devicesLoading: 'Loading…',
    devicesFailed: 'Could not load your devices.',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    signOutFailed: 'Could not sign out. Try again.',
  },

  /*
   * The refusal in front of every staff screen.
   *
   * Says what happened without accusing anybody: most people who land here did
   * so by following a link or typing a URL they half-remembered, not by trying
   * to break in. It names no roles and confirms nothing about who does have
   * access.
   */
  staff: {
    refusedTitle: 'This part is for staff',
    refusedBody:
      'Your account does not have access to this page. If you think it should, ask whoever set it up.',
    refusedHome: 'Back to your home page',
  },

  /*
   * Sign-up and password reset (T-266, HANDOFF §12b).
   *
   * **The states are the design.** A happy path is four taps and needs no
   * writing; what a student meets is a late code, a mistyped one, or a number
   * they no longer have. Two rules run through all of it, both from §12b:
   *
   * - **The remaining try count is stated.** Somebody who does not know how
   *   many are left cannot decide whether to guess again or start over.
   * - **Expiry is a rule, not a fault.** Nothing here implies the student broke
   *   something by being slow.
   */
  /** The frame the three doors share. See `AuthShell`. */
  auth: {
    back: 'Back',
    // "Step 2 of 3", not the handoff's 2 of 2. Its sign-up collects a name, an
    // email and a password on one screen and then verifies; ours is phone,
    // code, password, because the server's register flow is three calls and
    // this redesign changes the interface, not the API.
    step: (n: number, of: number) => `Step ${n} of ${of}`,
  },

  codeFlow: {
    phoneLabel: 'Your phone number',
    phoneHint: 'The number this phone uses. We send a code to it.',
    sendCode: 'Send me a code',
    sending: 'Sending…',
    couldNotSend: 'The code could not be sent just now. Try again in a moment.',

    sentTo: (phone: string) => `We sent a six-digit code to ${phone}.`,
    // When the server refused to send another one. Says plainly that nothing
    // went out, and points at the code they may already have rather than
    // leaving them waiting for an SMS that is not coming.
    notSentYet: (phone: string) =>
      `We have not sent another code to ${phone} yet. If one arrived earlier, it still works.`,
    codeTitle: 'Enter the code',
    codeLabel: 'The six-digit code',
    codeHint: 'It arrives by SMS and lasts ten minutes.',
    // The number, and the way to correct it. Without this a typo in the number
    // is a dead end — the code goes to a handset nobody is holding, and the
    // only way back is the browser's own back button.
    sentToShort: (phone: string) => `Sent to ${phone}.`,
    changeNumber: 'Change',
    noCodeYet: 'Didn’t get it?',
    continue: 'Continue',
    checking: 'Checking…',
    resend: 'Send another code',
    // A live countdown, never a dead button: "wait" with no number is
    // indistinguishable from broken, and the student presses it again.
    //
    // Read as time, not as seconds. The cooldown is a minute, so seconds are
    // right for the ordinary case — but a rate limiter that has escalated hands
    // back numbers like 1103, and "in 1103s" is a number a student has to do
    // arithmetic on to discover it means eighteen minutes.
    resendIn: (seconds: number) => `Send another code in ${plainDuration(seconds)}`,
    couldNotVerify: 'That did not go through. Try again in a moment.',

    triesLeft: (left: number) => `${left} ${left === 1 ? 'try' : 'tries'} left, or send a new one.`,
    /*
     * `tryAgainAt` is gone.
     *
     * The rule it served — a lockout names a clock time, never "later" — is now
     * kept by the server's own refusal message, which has to carry the time
     * anyway for the bot and any other API caller. Two sentences meant one
     * instant printed twice in two locale formats, one line under the other.
     */
    nothingWrong: 'Nothing is wrong with your account — codes simply do not last long.',

    passwordHint: 'At least 8 characters. Anything you will remember.',
    weakPassword: 'That password is too short. Use at least 8 characters.',
    saving: 'Saving…',

    signUp: {
      title: 'Create your account',
      intro: 'Your phone number is your username. No email, no forms.',
      passwordTitle: 'Choose a password',
      passwordLabel: 'Password',
      finish: 'Create my account',
      /*
       * Not "no code yet?" — the line directly above it already asks that.
       *
       * It read "No code yet? It can take a minute on a slow network", sitting
       * under "Didn't get it? Send another code in 55s". Two sentences about
       * the same wait, and the one with the live countdown is the useful one.
       * What this says instead is the thing the resend control cannot: that the
       * delay is the network, not the account, and that nothing is lost by
       * waiting.
       */
      lostNumber: 'On a slow network an SMS can take a minute. Nothing is lost while you wait.',
    },

    reset: {
      title: 'Reset your password',
      // Deliberately says nothing about whether the number is registered.
      // Confirming would make this a directory of who has an account here.
      intro: 'Type your number and we will send a code to it.',
      passwordTitle: 'Choose a new password',
      passwordLabel: 'New password',
      finish: 'Save and sign in',
      // The one real dead end in this flow, so it gets a route out rather than
      // an apology. A student who has lost the number cannot prove anything by
      // SMS, by definition.
      lostNumber:
        'No longer have this number? Message us on Telegram and we will move your account.',
    },
  },

  devLogin: {
    title: 'Sign in for testing',
    intro: 'Choose who to sign in as. This page is for local testing only.',
    password: 'Password',
    passwordHint: 'The password dev:testers sets. Already filled in — leave it as it is.',
    signingIn: 'signing in…',
    // 401 here means the seeded account is not on this database — which is the
    // ordinary state of every server except a developer's own. Not an error to
    // fix: the accounts are local fixtures and exist nowhere else.
    notSeeded:
      'No such test account on this server. Run `npm run dev:testers -w api` against a local database.',
    failed: (status: number) => `Could not sign in (${status}). Check the API is running.`,
    noServer: 'Could not reach the server. Is the API running?',
    // Each says what STATE the account is in, not what kind of person it is.
    // "A normal student" tells a tester nothing about which screens that button
    // will let them reach, which is the only thing they need to choose by.
    userA: 'User A',
    userANote: 'Brand new — no programme chosen yet. Start here.',
    userB: 'User B',
    userBNote: '8 of 10 free questions used, and a bank transfer waiting to be checked.',
    userC: 'User C',
    userCNote: 'Paid for 12 months — receipt, payment history and the mock exam.',
    userD: 'User D',
    userDNote: 'All 10 free questions spent, never paid — meets the paywall on arrival.',
    userE: 'User E',
    userENote: 'Paid once and lapsed yesterday — the renewal offer, not the first-time one.',
    userF: 'User F',
    userFNote: 'A mock exam open and unsubmitted — resuming it, and the practice lock.',
    userG: 'User G',
    userGNote: 'A mock exam finished — the result, the review and the trend.',
    userH: 'User H',
    userHNote: 'Five days engaged with points banked — the standing and the leaderboard.',
    userI: 'User I',
    userINote: 'Answered 15 and got a quarter right — readiness when the news is bad.',
    userJ: 'User J',
    userJNote: 'Two live devices, at the limit — the device list, and being evicted.',
    // The five school-track accounts. Between them they are the only way to
    // reach the junior band, the Grade 12 split and a coverage figure that is
    // not zero, which is why their absence from this list cost a whole QA pass.
    userK: 'User K',
    userKNote:
      'Grade 12 Natural, 5 of 12 beaten — and two right answers whose reason was wrong, which do not count.',
    userL: 'User L',
    userLNote: 'Grade 6, 4 of 6, chose to appear — the junior board, with somebody on it.',
    userM: 'User M',
    userMNote:
      'Grade 6, all 6 beaten, never asked about the board — on no board, and still ranked.',
    userN: 'User N',
    userNNote: 'Grade 8, 2 of 4, chose to appear — the other half of the junior band.',
    userO: 'User O',
    userONote:
      'Grade 12 Social, 3 of 4 — the half of Grade 12 that Natural must never be measured on.',
    admin: 'Admin',
    adminNote: "Sees the admin pages and can settle User B's payment.",
    provider: 'Provider',
    providerNote: 'Above admin — the activity log and the live health board.',
  },

  home: {
    // "Your exit exam" was written when that was the only thing this product
    // prepared anybody for. It now runs from Grade 6 upwards, and a page that
    // greets an eleven-year-old with "your exit exam" is talking to somebody
    // else. Neutral about which exam, specific about the method.
    tagline: 'Practise for your exam, one question at a time.',
    chooseFirst: 'Choose your programme to begin.',
    chooseFirstWhy:
      'It decides every question you practise, and it is the only thing standing between you ' +
      'and your first one. You can change it later.',
    chooseProgramme: 'Choose a programme',
    working: 'Loading…',

    /*
     * The product told three different stories about how to get in (T-268).
     *
     * `/home` said "Open Lomi-Exams from the Telegram bot", `/signin` asks for
     * a phone number and a password, and `/signup` sends an SMS code. Telegram
     * deep-link was the only door once; phone-and-password replaced it, and
     * this screen kept the old sentence. A visitor who follows it goes looking
     * for a bot they do not need.
     */
    signedOut: 'Sign in with your phone number to pick up where you left off.',
    signedOutWhy: 'New here? Creating an account takes a number and a code we text you.',

    /*
     * The five destination tiles are gone (T-269).
     *
     * `/home` opened with Practise, Mock exam, Progress, Where you stand and
     * Get full access — the same five the navigation bar carries directly
     * above, in the same order, minus Ask. A menu printed twice on one screen,
     * the second copy incomplete. What is left is the state only this screen
     * knows, one action, and Ask.
     */
    goCheckout: 'Get full access',
    /** The default next step, for anybody who can still answer something. */
    startPractising: 'Start practising',
    /*
     * Ask survives the cull, alone.
     *
     * It is in the bar like the others, but it is the one destination a student
     * does not reach by habit — the rest are where the daily loop already lives
     * — so a line pointing at it is the difference between a discussion surface
     * that is used and one that is not.
     */
    goAsk: 'Ask a question',
    goAskWhy: 'Stuck on something? Another student, or a reviewer, can answer.',

    accessUntil: (date: string) => `Full access until ${date}.`,
    freeTier: 'You are on the free questions.',
    // Says what happened and what is still true. Everything they answered is
    // kept, which is the fact a lapsed student most wants and least expects.
    lapsedOn: (date: string) =>
      `Your access ended on ${date}. Everything you have answered is still here.`,
    /*
     * The free counter, said the same way the practice badge says it.
     *
     * Zero gets its own sentence: "0 questions left" is a number to decode,
     * and the thing a student in that state needs is what is still free.
     */
    freeLeft: (left: number) =>
      left === 0
        ? 'Your free questions are used up. Anything you have already answered is still free to redo.'
        : `${left} free question${left === 1 ? '' : 's'} left.`,
    // Named by its reference, because that is what somebody quotes when they
    // ask where their money went.
    claimWaiting: (txRef: string) => `Your transfer ${txRef} is with our team to be checked.`,
  },

  /*
   * Today — the hub (redesign handoff, 2026-10-01, § Today).
   *
   * Every figure on that screen is read from the API: the countdown from
   * coverage, the ring from today's practice summary over the daily target, the
   * topic bars from readiness, the mock bars from the trend, the streak from
   * standing. Where the handoff prints a number nothing can supply — "Week 9 of
   * 15", "About 25 minutes", "Mock 5 opens Saturday" — it is not printed.
   */
  today: {
    greeting: (hour: number, name: string | null) => {
      const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      return name ? `Good ${part}, ${name}` : `Good ${part}`;
    },

    // The hero. Coverage, not readiness — see `TodayScreen`.
    daysLeft: (days: number) => (days === 1 ? 'day left' : 'days left'),
    examToday: 'Your exam is today.',
    examPassed: 'The date set for this exam has passed.',
    noDate: 'No sitting date is set for this programme yet.',
    coverage: 'Coverage',
    coverageLine: (beaten: number, total: number, toTarget: number, target: number) =>
      toTarget === 0
        ? `${beaten} of ${total} beaten — past the ${target}% target.`
        : `${beaten} of ${total} beaten. ${toTarget} more to reach ${target}%.`,

    // Today's plan.
    planTitle: "Today's plan",
    /*
     * The ring's caption, by state.
     *
     * "Done" is said as done and not as "0 to go": a student who has hit the
     * target should be told so in words, because a zero next to a full ring
     * still reads as a number to check.
     */
    toGo: (n: number) => `${n} question${n === 1 ? '' : 's'} to go`,
    doneToday: 'Done for today',
    doneTodayWhy: 'Anything more is ahead of pace.',
    answeredToday: (n: number) => (n === 0 ? 'Nothing answered yet today' : `${n} answered today`),
    noTarget: 'There is no daily target until a sitting date is set.',
    continueWith: (topic: string) => `Continue with ${topic}`,

    // Topics by exam weight.
    topicsTitle: 'Topics by exam weight',
    allTopics: (n: number) => `All ${n} topics`,
    // "Share of past papers", never "% of exam": D5, and `copy.test.ts`.
    weightOf: (pct: number) => `${pct}% of past papers`,
    notTried: 'Not tried yet',
    noneTried: 'Answer a few questions and each topic shows how you are doing on it.',
    belowLine: (n: number, line: number) =>
      n === 0
        ? `Every topic you have tried is above ${line}%.`
        : `${n} topic${n === 1 ? ' is' : 's are'} below ${line}% — that is where today's questions come from.`,

    // Mocks.
    mocksTitle: 'Mock scores',
    sinceLast: (delta: number, label: string) =>
      delta === 0
        ? `Level with ${label}`
        : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} since ${label}`,
    sitAMock: 'Sit a mock',

    /*
     * The streak — and it is NOT "in a row".
     *
     * The handoff writes "9 study days in a row". This product's streak is a
     * count of distinct days the student showed up, ever, and nothing
     * subtracts from it (T-191, `engagement.service.ts`: "Nothing subtracts from
     * it"). Calling it "in a row" would tell somebody who missed Tuesday that
     * their 9 is a lie, or that it is about to be taken away — the punishment
     * the design rules out.
     */
    streak: (days: number) =>
      days === 0 ? 'No study days yet' : `${days} study day${days === 1 ? '' : 's'}`,
    points: (total: number, today: number | null) =>
      today !== null && today > 0
        ? `${total.toLocaleString('en')} points · +${today} today`
        : `${total.toLocaleString('en')} points`,
    streakWhy: 'Every day you show up counts. A missed day never takes one away.',
    weekLabel: 'The last seven days',
    weekDayDone: (label: string) => `${label}: studied`,
    weekDayOpen: (label: string) => `${label}: no activity`,

    couldNotLoad: 'Part of this page did not load. Everything you have answered is safe.',
  },

  practice: {
    title: 'Practise',
    /*
     * What the clock on a practice question is (T-269).
     *
     * It had no label at all, so a countdown simply appeared above the question
     * — the largest, most urgent-looking thing on a screen belonging to a
     * student who is already anxious. A tester read it as a limit and waited to
     * find out what happened at zero. Nothing does: the pace is advisory, and
     * this is the word that says so before the waiting starts.
     */
    suggestedTime: 'Suggested',
    startPractising: 'Start practising',
    doneForToday: 'Done for today',
    freeLimit: 'That is your ten free questions',
    seePlans: 'Get full access',
    nextQuestion: 'Next question',
    practiseTopic: (topic: string) => `Practise ${topic}`,
    whyRanked:
      "Ranked by how many marks each topic cost — a topic's share of past papers against how much of it you missed, not the number of misses.",

    loading: 'Loading a question…',
    checkAnswer: 'Check answer',
    checking: 'Checking…',
    chooseFirst: 'Choose an answer first',
    nothingLeftToday: 'Nothing left to practise in this programme today.',
    didNotLoad: 'That did not load. Nothing you have answered is lost — try again.',

    // Uppercased in the chip; written here in sentence case so the Amharic,
    // which has no capitals to set, is not asked to imitate them (T-101).
    freeLeft: (count: number) => `${count} free left`,
    seenBefore: 'You have answered this one before',

    /*
     * The reason check (T-255).
     *
     * Framed as the second half of getting it right, never as a re-test. The
     * student has already answered correctly; this asks what made it right, and
     * a wrong pick costs them nothing they had — the question stays unbeaten and
     * comes round again. The copy is careful never to call it a failure.
     */
    // Stands where the concept line will be while the reason check is still
    // being asked. Says the explanation is coming, so its absence does not read
    // as this question simply not having one.
    conceptAfterReason: 'The concept behind this answer appears once you have named the reason.',
    // The notes on the other options are the check's own wrong answers. Saying
    // they are coming, rather than leaving a gap that reads as "this question
    // has none".
    whyWrongsAfterReason:
      'Why the other options were wrong appears once you have named the reason.',
    reasonTitle: 'Why is that the right answer?',
    reasonWhy: 'Getting this too is what marks the question as done.',
    reasonSkip: 'Skip for now',
    // Beside the skip control, because that is where somebody deciding looks.
    // Says the cost without discouraging: it comes round again, nothing is lost.
    reasonSkipCost: 'The question stays unbeaten and comes round again.',
    reasonChecking: 'Checking…',
    reasonRight: 'That is the reason. This question is done.',
    reasonWrong: 'Not quite the reason — this is what makes the answer work.',
    reasonNext: 'Next question',
    goToExam: 'Go to your exam',
    outOfNewTitle: 'That is your ten free questions',
    lapsedTitle: 'Your access has ended',
    lapsedBody:
      'You can keep going over the ones you have already answered as often as you like. ' +
      'New questions come back when you renew.',
    outOfNewBody:
      'You can keep going over the ones you have already answered as often as you like — ' +
      'that stays free. New questions need full access.',
  },

  /**
   * The tenth free question (design handoff 1e).
   *
   * A different screen with a different action, not an error — so it has its
   * own copy rather than borrowing the error strings. The per-month figure is
   * stated beside the price because a number a student cannot reconstruct is a
   * number they have to trust.
   */
  paywall: {
    title: 'You have used your ten free questions',
    intro:
      'Every question in the bank comes with a full explanation. Unlock the rest of your ' +
      'programme — nothing in it is held back or sold separately.',
    months: (count: number) => `${count} months`,
    perMonth: (etb: number) => `Br ${etb} / month`,
    price: (etb: number) => `Br ${etb}`,
    bestValue: 'Best value',
    footnote: 'Counted from the day you pay. telebirr, CBE Birr, card, or bank transfer.',
    cta: 'See plans and pay',
  },

  /**
   * Signing in (design handoff 2a, 2b).
   *
   * There is no password anywhere in this product, so there is no password
   * copy here — no reset, no "forgot", no email verification. The pairing code
   * is sent BY the student TO the bot, which is why nothing on this screen is
   * secret and why the code can sit in 34px type on a laptop in a lab.
   */
  signIn: {
    /*
     * Phone-and-password sign-in (T-263).
     *
     * "Phone number", never "username": the field is a thing the student
     * already has in their hand, and calling it a username invites them to
     * invent one they will forget.
     */
    phoneLabel: 'Phone number',
    phoneHint: 'The number you signed up with — 09… or 07…',
    passwordLabel: 'Password',
    forgotPassword: 'Forgot your password?',
    noAccount: 'Create an account',
    signInAction: 'Sign in',
    signingIn: 'Signing in…',
    /*
     * One message for every failure, matching the server byte for byte. Telling
     * a wrong password apart from an unknown number would publish which numbers
     * hold accounts, and mobile numbers are issued in guessable blocks.
     */
    signInFailed: 'That phone number and password do not match an account.',
    /*
     * When the fault is ours, say so (T-268).
     *
     * Every failure that was not a 429 rendered `signInFailed`, so a service
     * returning 500 to every sign-in told each student their password was
     * wrong. A tester watched seven accounts get that message against an API
     * that could not mint a session for anybody, and a real student would spend
     * the evening retyping a password that was never the problem.
     */
    // Names the cause, clears the reader, gives the move. "Something went
    // wrong" is banned by the voice rules for the middle reason: it leaves
    // somebody holding a problem with nothing to do about it.
    signInBroken: 'We could not reach the server. Your password is fine — try again in a moment.',
    tooMany: (seconds: number) =>
      `Too many attempts on this number. Try again in ${plainDuration(seconds)}.`,
    /*
     * Thirteen Telegram sign-in strings were removed here with the redesign.
     *
     * `orTelegram`, `title`, `intro`, `open`, `beforeYouApprove`, `checkCode`,
     * `waiting`, `expiresIn`, `newCode`, `starting`, `continue`, `signedIn` and
     * `goPractise` described the pairing flow that T-263 replaced with a phone
     * and a password. Every one had been unreferenced since, and `title` and
     * `intro` in particular still said "No passwords, no forms" — directly
     * above a password field, had anything rendered them.
     *
     * Dead copy is not harmless. It is the first thing found by anyone
     * searching the dictionary for what this screen says, and it describes a
     * door that is not there.
     */
    /*
     * The heading on the sign-in door.
     *
     * It was "Ready for your exam", itself a repair: the original read "Ready
     * for the Exit Exam" while the fine print at the foot of the same screen
     * said "For school tracks and university exit exams alike", so a Grade 6
     * parent signing their child in was told they were ready for a university
     * exam. Track-neutrality is still the rule and "Welcome back" keeps it for
     * free — this door is for somebody who already has an account, and the
     * pitch belongs on the landing page they came through.
     */
    welcomeTitle: 'Welcome back',
    /*
     * Rewritten for the phone-first door (T-263).
     *
     * These said "Open Telegram and press Start — that is the whole sign-up"
     * and "No password, ever", and they now sit directly beneath a password
     * field. A screen that contradicts itself in two lines is worse than one
     * that explains nothing.
     *
     * They describe what is true *today*: sign-in is phone and password, and
     * accounts are still created through the bot because SMS registration is
     * not built. When it is, step 2 changes and not before — promising a code
     * that never arrives is the worse half of this trade.
     */
    /*
     * `step1`, `step2` and `step3` are gone with the explainer card.
     *
     * Three sentences under the sign-in form: the first described the form
     * directly above it, the second is what the "Create an account" link says,
     * and only the third — ten free questions — was news. That one is on the
     * landing page, several times, where somebody deciding reads it. A
     * returning student does not need the pitch between their password and the
     * button.
     */
    // Named tracks went stale the moment there were seven of them, and "one
    // plan covers every programme" went stale when school tracks got their own
    // Br 300 price. What survives both is the range the product spans, said
    // without implying one price or one plan across it.
    coverage: 'For school tracks and university exit exams alike.',

    /*
     * The subtitle under "Welcome back", and it is deliberately not the
     * handoff's.
     *
     * The handoff writes "43 days to exam day. Keep going." — on the SIGNED-OUT
     * screen, where there is no student, no chosen track and therefore no exam
     * date. It is the hero composite's sample figure printed as if it were this
     * reader's. This says the one thing that is true of everybody standing at
     * this door.
     */
    welcomeBody: 'Pick up where you left off.',
    newHere: 'New to Lomi-Exams?',
  },

  exam: {
    title: 'Mock exam',
    /*
     * The paper you are about to sit, not the one the product hopes to ship.
     * This said "100 questions in 3 hours" over whatever had actually been
     * built — QA was promised a hundred and given twenty.
     */
    intro: (questions: number, minutes: number) =>
      `${questions} questions in ${minutes} minutes, sat once through. ` +
      'Nothing is marked until you submit.',
    start: 'Start the mock',
    reviewLoading: 'Opening your paper…',
    /*
     * One message for "not yours" and "no such paper".
     *
     * Sitting ids are opaque, but answering "that belongs to somebody else"
     * confirms a real paper on a real account, which nobody trying ids is
     * entitled to learn.
     */
    reviewNotFound: 'That paper is not here. It may have been sat on another account.',
    reviewFailed: 'Your paper could not be opened just now. Try again in a moment.',
    reviewBackToProgress: 'Back to your progress',
    resumeTitle: 'You have a paper open',
    /*
     * Said when starting had to close an expired paper first.
     *
     * "Marked", not "lost" — because it was marked, and that is the fact the
     * student is missing. It names where the result went, so the sentence ends
     * somewhere they can act rather than in an apology.
     */
    previousExpired:
      'Your last paper ran out of time, so it was marked as it stood. The result is on your progress page. This is a new one.',
    resumeBody: (answered: number, total: number) =>
      `${answered} of ${total} answered. Your answers are saved and the clock has kept running.`,
    resume: (position: number) => `Go back to question ${position}`,
    preparing: 'Preparing your paper…',
    chooseProgramme: 'Choose a programme first.',
    seePlans: 'Get full access',
    finished: 'Sitting finished',
    answersRecorded: 'Your answers are recorded. The review is on its way.',
    questionOf: (position: number, total: number) => `Question ${position} of ${total}`,
    flag: 'Flag for review',
    unflag: 'Remove flag',
    firstQuestion: 'This is the first question',
    lastQuestion: 'This is the last question',
    submit: (answered: number, total: number) => `Submit — ${answered} of ${total} answered`,
    confirmTitle: 'Submit with questions unanswered?',
    confirmBody: (left: number) =>
      `${left} question${left === 1 ? ' has' : 's have'} no answer. ` +
      'Unanswered questions are marked wrong, and a submitted paper cannot be reopened.',
    confirmBack: 'Go back to them',
    confirmSubmit: 'Submit anyway',
    pendingSync: (count: number) =>
      `${count} answer${count === 1 ? '' : 's'} saved on this phone, waiting to send. ` +
      'Keep going — they go up when the connection returns.',
    questionNavigator: 'Question navigator',
    everyQuestion: 'Every question',
    questionNumber: (position: number) => `Question ${position}`,
    showMore: (count: number) => `Show ${count} more`,
    ranOutOfTime: 'The time ran out before you submitted. Everything you answered was kept.',
  },

  summary: {
    thisMock: 'This mock',
    ofThePaper: (pct: number) => `${pct}% of the paper`,
    ofThePaperWithUnanswered: (pct: number, unanswered: number) =>
      `${pct}% of the paper · ${unanswered} left unanswered`,
    nothingToSummarise: 'Nothing to summarise',
    noQuestions: 'This paper had no questions on it.',
    reviseNext: 'Revise next',
    practiseNext: 'Practise next',
    today: 'Today',
    nothingAnswered: 'Nothing answered yet',
    answerToStart: 'Answer a question and the summary starts here.',
    shareOfPastPapers: (pct: number) => `${pct}% share of past papers`,
    shareNotWorkedOut: 'Share of past papers not worked out yet',
    acrossTopics: (pct: number, topics: number) =>
      `${pct}% across ${topics} topic${topics === 1 ? '' : 's'}`,
  },

  progress: {
    title: 'Progress',
    working: 'Working out where you are…',
    couldNotLoad: 'Your progress did not load. Nothing you have answered is lost — try again.',
    nothingYet:
      'Nothing answered yet, so there is no readiness figure to show. Answer a few questions and it starts here.',
    chooseProgramme: 'Choose a programme to see your progress.',
    mockScores: 'Mock scores',
    mocksSat: 'Mocks sat',
    noneYet: 'none yet',
    mostRecent: (pct: number) => `most recent: ${pct}%`,
    trendEmpty: 'Your mock scores appear here once you have sat one.',
    notReached: (count: number) => `${count} not reached`,
    readiness: 'Readiness',
    focus: 'Focus',
    chooseFirst: 'Choose a programme',
    evidenceTitle: 'What each score rests on',

    /*
     * Coverage (T-256), the headline that replaces the weighted mean.
     *
     * "Beaten" is said plainly wherever it appears, because it is not the
     * obvious meaning of a count: it is answered right *and* the reason named.
     * A student who thinks it means "answered" will find the number lower than
     * they expect and conclude the product is broken.
     */
    coverageTitle: 'Your coverage',
    coverageOf: (beaten: number, total: number) => `${beaten} of ${total} questions beaten`,
    // Appended to the line above. Reads as "0 of 20 questions beaten · 15
    // answered so far" — the work sits beside the score instead of the score
    // standing alone looking like a verdict on it.
    coverageAlsoAnswered: (answered: number) => ` · ${answered} answered so far`,
    coverageWhatBeaten: 'Beaten means you answered it right and named the reason.',
    coverageTarget: (pct: number) => `Target ${pct}%`,
    coverageToTarget: (n: number) => `${n} more question${n === 1 ? '' : 's'} to reach the target.`,
    coverageDone: 'You are past the target. Everything from here is margin.',
    coverageDaily: (n: number) => `${n} a day`,
    coverageDailyWhy: (toTarget: number, days: number) =>
      `${toTarget} to go, ${days} day${days === 1 ? '' : 's'} left.`,
    coverageNoDate: 'No exam date is set yet, so there is no daily target to work out.',
    coverageByGrade: 'Which year is holding you back',
    coverageBySubject: 'By subject',
    coverageRow: (beaten: number, total: number, pct: number) => `${beaten}/${total} · ${pct}%`,
    coverageUnavailable: 'Coverage is not available for this programme yet.',
    /*
     * The two big percentages, told apart.
     *
     * Coverage and readiness answer different questions and can differ wildly —
     * a student who has tried seven questions and got them all right reads 41%
     * coverage and 100% readiness on one screen. Both are true. Side by side and
     * unexplained they look like a bug, and the student's reasonable conclusion
     * is that the product cannot count.
     */
    readinessVsCoverage:
      'This is how you are doing on the questions you have tried. Coverage above is how ' +
      'much of the whole exam you have beaten.',

    /*
     * Mock history (T-258, handoff § 11).
     *
     * "Left blank" and never "ran out of time": the figure counts blanks and
     * knows nothing about why — a paper submitted early leaves them too.
     */
    sittingsTitle: 'Your mock papers',
    sittingCorrect: 'Correct',
    sittingWrong: 'Wrong',
    sittingBlank: 'Left blank',
    sittingLegend: (correct: number, wrong: number, blank: number, total: number) =>
      `${correct} correct · ${wrong} wrong · ${blank} left blank — of ${total}`,
    sittingMinutes: (minutes: number) => `${minutes} min used`,
    sittingOfAttempted: (pct: number, attempted: number) =>
      `${pct}% of the ${attempted} you attempted`,
    // The way back into a paper already sat. "Read", not "review" — reviewing
    // is what a marker does; this is the student reading their own answers.
    readThisPaper: 'Read this paper',
    sittingsEmpty: 'No mock papers sat yet.',
    /*
     * The count, and not the percentage again (T-269).
     *
     * This read "40% from 5 answers", and the readiness rows a few centimetres
     * above already print "Depreciation 40% · 25% share of past papers" — so
     * every topic's score appeared twice on one screen, and an audit read the
     * whole section as a duplicate list.
     *
     * It is not a duplicate; it carries the one fact the rows above cannot,
     * which is how much each score rests on. Saying only that is what makes the
     * section earn its place.
     */
    fromAnswers: (answered: number) => `from ${answered} answer${answered === 1 ? '' : 's'}`,
    thinEvidence: 'too few to be sure',
    unansweredInMocks: (count: number) =>
      `${count} mock question${count === 1 ? '' : 's'} ${count === 1 ? 'was' : 'were'} ` +
      `left unanswered and ${count === 1 ? 'is' : 'are'} not counted above.`,
  },

  checkout: {
    title: 'Get full access',
    working: 'Loading…',
    perMonth: (etb: number) => `Br ${etb} a month`,
    forMonths: (etb: number, months: number) => `Br ${etb} for ${months} months`,
    bestValue: 'Best value',
    savingVs: (pct: number) => `${pct}% less per month`,
    howToPay: 'How would you like to pay?',

    telebirr: 'telebirr',
    telebirrHow: 'We send a request to your phone — you approve it there.',
    cbebirr: 'CBE Birr',
    cbebirrHow: 'We send a request to your phone — you approve it there.',
    chapa: 'Card or another wallet',
    chapaHow: "Opens Chapa's secure payment page.",
    bank: 'Bank transfer',
    bankHow: 'Pay from any bank, then paste the reference — a person verifies it.',

    mobileLabel: 'The phone number you pay with',
    mobileHint: 'For example 0911223344.',
    mobileFromTelegram:
      'From the number you shared on Telegram. Change it if you pay with another.',
    mobileInvalid: 'That does not look like an Ethiopian mobile number. Check it and try again.',
    txRefLabel: 'Transfer reference',
    // Names what is missing, like every other blocked control in the product.
    txRefNeeded: 'Add the transfer reference first',
    txRefHint:
      "The reference is on your bank's confirmation SMS. A person checks every claim — access is " +
      'granted after it is verified, usually within a few hours.',
    txRefRequired: 'Enter the transaction number from your transfer receipt.',
    txRefTaken:
      'That transaction number has already been sent to us. Support can look it up for you.',

    // The screen title in the rail's words, so the tab a student pressed and
    // the heading they land on say the same thing.
    heading: 'Access',
    chosen: 'Chosen',
    /*
     * "One plan covers every programme" was true and stopped being true.
     *
     * It dated from a single price for everybody. School tracks now pay Br 300
     * and exit exams Br 500 or Br 800, and a live school plan will not carry a
     * student onto an exit-exam programme — `crossesPricingLine` refuses it. So
     * the sentence contradicted the three different prices printed directly
     * above it, on all three versions of this page.
     *
     * What is still true is the part that matters to somebody deciding: nothing
     * inside their own programme is held back or sold separately.
     */
    countedFromToday: 'Counted from today. Covers every question in your programme.',

    // telebirr / CBE Birr, waiting for the handset.
    waitingBanner: 'Check your phone',
    requestSentTo: (method: string, mobile: string) =>
      `We sent a ${method} request to ${mobile}. Approve it there — this page updates by itself.`,
    waitingFor: (clock: string) => `Waiting ${clock} — requests usually arrive within a minute.`,
    slowBanner: 'Taking longer than usual',
    slowBody:
      'The request can take up to two minutes on a slow network. Nothing has been charged yet — ' +
      'you can wait, or send a fresh request.',
    sendAgain: 'Send the request again',
    payDifferently: 'Pay a different way',

    // Bank transfer.
    transferTo: (amount: string) => `Transfer ${amount} from any bank to:`,
    accountLabel: 'Account',
    accountNotPublished:
      'The account to pay into is not published on this server. Ask support for it before you ' +
      'transfer — a claim with no matching transfer cannot be verified.',
    submitForVerification: 'Submit for verification',
    submittedBanner: 'Submitted — being verified',
    submittedBody: (ref: string) =>
      `Reference ${ref} is with our team. We will message you on Telegram the moment it is ` +
      'confirmed — you can keep practising your free questions meanwhile.',

    verifiedBanner: 'Payment verified',

    /*
     * The lapsed student, who is not a new one.
     *
     * The schema keeps EXPIRED apart from PENDING because the two need
     * different words, and until now the checkout used the same first-time page
     * for both: someone who bought twelve months and ran out was shown "Get full
     * access · Counted from today", with no end date, no history and nothing
     * acknowledging they had ever paid. Both QA passes filed it.
     */
    lapsedBanner: 'Your access has ended',
    lapsedBody: (ended: string) =>
      `Your access ran until ${ended}. Renew below and it picks up from today — ` +
      'everything you have answered is still here.',
    renew: 'Renew',

    pay: 'Pay',
    sending: 'Sending…',
    checkYourPhone: (mobile: string) =>
      `A payment request has been sent to ${mobile}. Approve it on your phone, and this page ` +
      'updates on its own.',
    stillWaiting:
      'Still waiting for the payment. If you have approved it, give it another moment — nothing ' +
      'is lost if you close this page.',
    openingChapa: 'Opening Chapa…',
    confirmed: 'You have full access.',
    accessUntil: (date: string) => `Your access runs until ${date}.`,
    yourReference: (ref: string) => `Your reference is ${ref}. Keep it — support can look it up.`,
    /*
     * For where the reference has already been said in the sentence above.
     * The pending panel ran "Reference FT… is with our team." straight into
     * "Your reference is FT…", which is the same number twice in consecutive
     * sentences — it reads as a mistake and buries the part that matters.
     */
    keepReference: 'Keep it — support can look it up.',
    manualPending:
      'Thank you. Someone checks the transfer against the bank statement, usually the same day, ' +
      'and your access starts as soon as it is found.',
    couldNotStart: 'The payment could not be started. Nothing has been charged — try again.',
    unavailable:
      'That way of paying is not available right now. The bank transfer below still works.',
  },

  /**
   * The receipt and the history behind it (T-154, design handoff 2f).
   *
   * Lives under the Access tab rather than on a screen of its own: a student
   * looking for proof of payment goes to the place they paid, and a sixth
   * destination for a page read twice a year would break the five.
   */
  receipt: {
    working: 'Loading your payments…',
    couldNotLoad: 'Your payments could not be loaded. Nothing is lost — try again.',

    plan: 'Plan',
    planValue: (months: number) => `${months} months · every programme`,
    amount: 'Amount',
    method: 'Method',
    reference: 'Reference',
    paid: 'Paid',
    accessUntil: 'Access until',

    history: 'Payment history',
    historyRow: (amount: string, months: number) => `${amount} · ${months} months`,
    historyMeta: (method: string, date: string) => `${method} · ${date}`,
    noHistory: 'Nothing yet. Anything you pay for appears here, with its reference.',

    verified: 'Verified',
    pending: 'Pending',
    notAccepted: 'Not accepted',

    backToPractising: 'Back to practising',
  },

  standing: {
    title: 'Where you stand',
    working: 'Counting…',
    couldNotLoad: 'Your standing could not be loaded. Nothing is lost — try again.',

    points: 'Points',
    pointsFrom: 'from every award you have earned',
    /*
     * What points are not (T-269).
     *
     * Points are the largest figure on this screen and the board beside them
     * ranks by something else entirely — questions beaten — so the biggest
     * number is not the number anybody is ranked on. An audit put it plainly:
     * "the biggest number on the screen is not the number the board uses", and
     * User M showed it at its starkest, reading POINTS 0 next to "You are 1st ·
     * 100% · 6 of 6".
     *
     * Both figures stay, because they measure two things a student genuinely
     * wants: turning up, and getting things right. What was missing was the
     * sentence saying which is which.
     */
    pointsNotRanked: 'Points are for turning up. The board ranks by questions beaten.',
    streak: 'Days practised',
    streakNever: 'No days yet. The first one counts from today.',
    streakDays: (days: number) => `${days} day${days === 1 ? '' : 's'}`,
    toNextTier: (points: number, tier: string) => `${points} points to ${tier}`,
    topTier: 'You are at the top tier.',

    howEarned: 'How you earned them',
    recentOnly: 'Your most recent awards. Older ones are counted in the total above.',
    ledgerEmpty: 'Nothing yet. Points appear here the moment you answer a question.',

    board: 'The board',
    /*
     * Why the numbers skip.
     *
     * T-194 ranks over everybody and then filters, so hiding one student never
     * promotes the one below them — the board reports the same competition to
     * every viewer. The consequence is visible gaps (2, 3, 3, 6, 7) and both QA
     * passes reported them as broken arithmetic, correctly by the rule this
     * product sets itself: a figure nobody can account for should be reported.
     *
     * States the rule rather than the count. "Three students are hidden" would
     * explain the gaps and quietly publish something about people who asked not
     * to be published.
     */
    /*
     * The banded board (T-257).
     *
     * The band is named on screen because "why am I not competing with my
     * cousin" is a question a student will ask, and the answer — you are not in
     * the same exam — is a good one. Ranked by share of your own bank, which is
     * the only figure comparable across tracks of different sizes.
     */
    scopeLabel: 'Who you are ranked against',
    // Named by the exam wherever possible — a student sitting Accounting
    // recognises "Accounting" and has to decode "your track". This is only the
    // fallback, before a programme is chosen.
    scopeYourExam: 'Your exam',
    scopeEveryone: 'Everyone',
    scopeEveryoneNote: 'Every student, every exam',
    bandJunior: 'Grade 6 and Grade 8',
    bandSenior: 'Grade 12 and exit exams',
    boardThisWeek: 'This week',
    boardAllTime: 'All time',
    boardWhyWeekly: 'A new board every Monday, so it stays winnable.',
    boardCoverageRow: (pct: number, beaten: number, total: number) =>
      `${pct}% · ${beaten} of ${total}`,
    boardWhyGaps:
      'Ranks are counted across everyone. Anyone who has chosen not to appear keeps ' +
      'their place, so the numbers can skip.',
    boardEmpty: 'Nobody has scored yet. Answer a question and you are first.',
    /*
     * The board is empty of *rows*, not of people (T-269).
     *
     * `rows` leaves out anybody not listed, so a hidden student who has scored
     * empties the list while still holding a rank — and `boardEmpty` then told
     * them nobody had scored, directly above a card saying they were first.
     * This says what is actually true, and the rank card below fills in the
     * rest.
     */
    boardNobodyListed: 'Nobody on this board has chosen to appear yet.',
    yourRank: (rank: number) =>
      `You are ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}`,
    notListed: 'You are not shown on the board. Your rank is still yours to see.',
    // For a student who IS listed but sits below the last visible row. It says
    // where they are without dressing up the distance, and without implying
    // they were left off.
    belowTheCut: 'The board shows the top few. This is your place on it.',
    hideMe: 'Hide me from the board',
    showMe: 'Show me on the board',
  },

  community: {
    title: 'Ask about this topic',
    working: 'Loading…',
    couldNotLoad: 'The discussion could not be loaded. Try again.',
    empty: 'No questions on this topic yet. Ask the first one.',

    askTitle: 'Your question, in a few words',
    askBody: 'What is confusing you?',
    ask: 'Ask',
    // On the button itself while it is blocked, so the reason and the control
    // are in the same place.
    indexTitle: 'Ask a question',
    // Names the programme, so it is obvious this is not everybody on the app.
    indexIntro: (field: string) => `Questions and answers from other ${field} students.`,
    indexLoading: 'Loading your topics…',
    indexFailed: 'Your topics could not be loaded. Try again in a moment.',
    indexEmpty: 'No topics in your programme yet.',
    indexWhat: 'Stuck on something? Ask here and another student can answer.',
    askNeedsBoth: 'Add a title and a question first',
    asking: 'Posting…',
    titleRequired: 'Give your question a title so somebody can find it.',
    bodyRequired: 'Write your question before posting.',

    replies: (count: number) => `${count} repl${count === 1 ? 'y' : 'ies'}`,
    reply: 'Reply',
    replyPlaceholder: 'Answer or add to this',
    verified: 'Reviewer',
    verifiedMeans: 'Checked by the people who review the questions.',
    yours: 'You',
    hidden: 'Hidden by a moderator. Only you can see this.',

    report: 'Report',
    // Named separately from `report` so the question and the replies under it
    // do not present four identical "Report" links with different targets.
    reportQuestion: 'Report this question',
    reported: 'Reported. Somebody will look at it.',
    reportWhy: 'Why are you reporting this?',
    reportWrong: 'The answer is wrong',
    reportAbusive: 'Abusive',
    reportSpam: 'Spam',
    reportOffTopic: 'Off topic',

    tooFast: 'You are posting quickly. Give it a moment and try again.',
    chooseProgramme: 'Choose a programme before joining the discussion.',
  },

  dashboard: {
    title: 'Overview',
    working: 'Counting…',
    couldNotLoad: 'The figures could not be loaded. Nothing is wrong with the data — try again.',

    signups: 'Signups',
    paying: 'Paying',
    lapsed: 'Lapsed',
    trialling: 'Trialling',
    dormant: 'Not started',
    awaitingSettlement: 'Awaiting settlement',
    awaitingHow: (count: number) =>
      count === 1
        ? '1 claimed transfer is waiting for somebody to check the statement.'
        : `${count} claimed transfers are waiting for somebody to check the statement.`,
    nothingWaiting: 'Nothing is waiting to be settled.',

    revenue: 'Taken',
    revenueTotal: 'Total',
    paymentsCounted: (count: number) => `${count} confirmed payment${count === 1 ? '' : 's'}`,
    methodTelebirr: 'telebirr',
    methodCbebirr: 'CBE Birr',
    methodChapa: 'Chapa page',
    methodBank: 'Bank transfer',

    findStudent: 'Find a student',
    searchLabel: 'Phone, name or transaction number',
    searchHint: 'A transaction number has to be exact. Three characters or more.',
    searching: 'Looking…',
    noHits: 'Nobody matched that.',
    matchedOnTxRef: 'matched the transaction number',
    matchedOnPhone: 'matched the phone number',
    matchedOnName: 'matched the name',
    deactivated: 'Deactivated',
  },

  admin: {
    /*
     * Reported posts (T-197).
     *
     * The tone is deliberately flat. This screen decides whether a student's
     * words stay up, and copy with any warmth in it — "great work keeping the
     * community safe" — pushes an operator towards acting rather than judging.
     */
    moderation: {
      title: 'Reported posts',
      intro: 'A student reported each of these. One report is one opinion — read the post.',
      loading: 'Loading the queue…',
      couldNotLoad: 'The queue could not be loaded. Nothing has changed — try again.',
      waiting: (count: number) => (count === 0 ? 'Nothing waiting' : `${count} waiting`),
      // Not a congratulation: an empty queue is the ordinary state.
      empty: 'No reports are waiting.',
      isHidden: 'Hidden',
      postGone: 'That post no longer exists.',
      reporterSaid: (note: string) => `They added: ${note}`,
      /*
       * Who wrote it, and what it was answering.
       *
       * Each part is dropped when it is missing rather than printed as
       * "Unknown" — a moderator reading "by Unknown in Unknown" learns nothing
       * and has to work out whether that is a deleted account or a bug.
       */
      context: (author: string | null, topic: string | null, thread: string | null): string => {
        const parts = [
          author ? `By ${author}` : null,
          topic ? `in ${topic}` : null,
          thread ? `· ${thread}` : null,
        ].filter(Boolean);
        return parts.length === 0 ? '' : parts.join(' ');
      },

      hiddenTitle: 'Currently hidden',
      hiddenIntro: 'Posts students cannot see. Anything here can be put back.',
      hiddenEmpty: 'Nothing is hidden.',
      hiddenNote: (note: string) => `Note when hidden: ${note}`,
      hide: 'Hide this post',
      hideWhy: 'Students stop seeing it. You can put it back.',
      // Which of the two is being ruled on. Hiding a question is a bigger act
      // than hiding a reply and the screen has to say which one this is.
      isQuestion: 'Question',
      isReply: 'Reply',
      hideQuestion: 'Hide this question',
      hideQuestionWhy:
        'The question and every answer under it stop being seen. Nothing is deleted, and it ' +
        'all comes back together.',
      takesReplies: (count: number) =>
        count === 1 ? '1 answer under it' : `${count} answers under it`,
      restore: 'Put it back',
      restoreWhy: 'Students see it again.',
      hidden: 'Hidden, and the report is settled.',
      restored: 'Back up, and the report is settled.',
      couldNotAct: 'That did not go through. Nothing has changed — try again.',
    },

    nav: {
      title: 'Lomi-Exams Admin',
      label: 'Admin sections',
      dashboard: 'Dashboard',
      payments: 'Payments',
      import: 'Import',
      review: 'Review',
      weights: 'Weights',
      users: 'Students',
      /*
       * "Reports" meant the wrong thing (T-269).
       *
       * In an admin console that word is exports and statistics. This is the
       * forum moderation queue, and the page it opens is headed "Reported
       * posts" — so the label and the destination disagreed on what kind of
       * report was meant. `Users` → `Students` for the same reason: the page
       * has always been headed "Students".
       */
      moderation: 'Reported posts',
      /** Staff are students too, and the console had no way back to the app. */
      backToApp: 'Student app',
    },

    /**
     * Settling a claimed bank transfer (T-224, design handoff 2g).
     *
     * Every string here is written for somebody with a bank statement open in
     * another window. That is why the summary restates the reference, the
     * amount and the account rather than assuming the row above is still on
     * screen, and why the reason field says plainly that it is kept whichever
     * button is pressed — a note written believing it is private is a different
     * note.
     */
    payments: {
      title: 'Claimed bank transfers',
      working: 'Loading claims…',
      couldNotLoad: 'The claims could not be loaded. Nothing has been settled — try again.',
      waiting: (count: number) => `${count} waiting`,
      nothingWaiting: 'Nothing is waiting to be checked.',

      colClaimed: 'Claimed',
      colStudent: 'Student',
      colPhone: 'Phone',
      colReference: 'Reference',
      colAmount: 'Amount',
      colStatus: 'Status',

      open: 'Open this claim',
      close: 'Close this claim',

      checkAgainst: 'Check against the bank statement',
      expected: (reference: string, amount: string, account: string) =>
        `Reference ${reference} · expected ${amount} to ${account}.`,
      expectedNoAccount: (reference: string, amount: string) =>
        `Reference ${reference} · expected ${amount}.`,
      claimedBy: (student: string, joined: string) => `Claimed by ${student}, signed up ${joined}.`,
      priorPayments: (verified: number, total: number) =>
        `${total} prior payment${total === 1 ? '' : 's'}, ${verified} verified.`,
      noPriorPayments: 'No prior payments on this account.',

      reasonLabel: 'Reason — required for reject, kept on the record either way',
      reasonPlaceholder: 'Amount received matches, reference found on the statement.',
      approve: 'Approve — grant access',
      approving: 'Granting access…',
      reject: 'Reject with reason',
      rejecting: 'Recording the rejection…',
      approveNote: 'Approval grants access immediately and messages the student on Telegram.',
      rejectNeedsReason: 'Say why before rejecting — the student is told this reason.',
      settled: 'Settled. The list below no longer shows it as waiting.',
      couldNotSettle: 'That did not go through. Nothing was granted or refused — try again.',
    },

    /**
     * The two controls an operator has over an account (T-225).
     *
     * Both are worded as what they do to a person, not as what they do to a
     * row. "Reset devices" sounds harmless until you are the student locked
     * out of a mock at 11pm, so the copy says which of those is happening.
     */
    users: {
      title: 'Students',
      intro:
        'Find an account by phone, name or transaction number, then reset its devices or close ' +
        'it. Both are recorded against your name.',
      resetDevices: 'Reset devices',
      resetDevicesWhy:
        'Signs this student out everywhere and lets them sign in on two devices again. Use it ' +
        'when somebody has changed phones.',
      resetting: 'Signing them out…',
      deactivate: 'Close the account',
      deactivateWhy:
        'Stops this account signing in. Their answers and payments are kept — nothing is ' +
        'deleted.',
      deactivating: 'Closing…',
      reasonLabel: 'Why, for the record',
      reasonPlaceholder: 'Student asked for a device reset after losing their phone.',
      needsReason: 'Say why first — this is written to the record with your name.',
      // Never "nobody matched". A search that could not run has found nothing
      // out about the data, and saying otherwise hides the real problem.
      searchFailed:
        'That search could not run. You may not have permission, or the server is down.',
      devicesReset: 'Devices reset. They can sign in again on a new phone.',
      accountClosed: 'Account closed. It can be reopened by whoever runs the server.',
      alreadyClosed: 'Already closed',
      couldNotDo: 'That did not go through. Nothing was changed — try again.',
    },

    /**
     * The review queue (T-231).
     *
     * Written for the person who has just uploaded a spreadsheet and wants to
     * know what happened to it. Every row says what is stopping it in the gate's
     * own words, because "12 drafts" answers nothing anybody asked.
     */
    review: {
      title: 'Review',
      intro:
        'Everything uploaded lands here as a draft. Nothing reaches a student until somebody has read it and published it.',
      working: 'Reading the queue…',
      couldNotLoad: 'The queue could not be read. Nothing has changed — try again.',

      draft: 'Drafts',
      inReview: 'Waiting on a reviewer',
      published: 'Published',
      retired: 'Withdrawn',
      countsFrom: 'counted across every programme in the bank',

      ready: 'Ready to publish',
      notReady: (count: number) =>
        count === 1 ? '1 thing to fix first' : `${count} things to fix first`,
      andMore: (count: number) => `${count} more drafts not shown`,
      noDrafts: 'No drafts. Everything uploaded has been dealt with.',

      sendToReview: 'Send to review',
      sending: 'Sending…',
      sentToReview: 'Sent. It is now waiting on a reviewer.',

      nothingWaiting: 'Nothing is waiting on a reviewer.',
      reviewing: 'Waiting on you',
      author: 'Written by',
      bounced: 'Sent back before',
      publish: 'Publish it',
      publishing: 'Publishing…',
      published2: 'Published. Students can see it now.',
      bounce: 'Send it back',
      bouncing: 'Sending it back…',
      bounceLabel: 'What needs fixing — the author reads this',
      bouncePlaceholder: 'Option C is also correct, and the concept line repeats the stem.',
      bounceTooShort: 'Say what needs fixing — a note this short leaves the author guessing.',
      bounced2: 'Sent back to its author.',
      cannotPublish: 'This cannot be published yet:',
      topicUnweighted: 'Topic has no weight',

      // The editor (T-233). Every label says what the gate wants, in the words
      // it uses to refuse — so a reviewer reading a blocker finds the field.
      whichCorrect: 'Which answer is correct, and why the others are not',
      whyWrongPlaceholder: 'Why somebody would pick this, and what it gets wrong.',
      whyWrongFor: (label: string) => `Why option ${label} is wrong`,
      conceptLine: 'The one thing to remember',
      conceptPlaceholder: 'VAT inside a gross amount is extracted with ×15/115.',
      conceptHint: 'One sentence. Two is a second explanation, and the first stops being read.',
      explanation: 'The explanation',
      explanationPlaceholder: 'What makes the right answer right, in a couple of sentences.',
      stepsLabel: 'The working, step by step',
      stepPlaceholder: 'Depreciable base = cost − residual value',
      stepNumber: (n: number) => `Step ${n}`,
      formulaPlaceholder: 'e.g. 620,000 − 20,000 = 600,000',
      formulaFor: (n: number) => `Formula for step ${n}`,
      addStep: 'Add a step',
      removeStep: 'Remove',
      lastStepHint: (label: string) =>
        `The last step has to name the answer — "… → answer ${label}".`,
      timeLimit: 'Time limit, in seconds',
      timeLimitHint: 'Between 15 and 600. It sets the pacing line a student sees after answering.',
      save: 'Save changes',
      saving: 'Saving…',
      savedChanges: 'Saved.',
      nothingChanged: 'Nothing has been changed yet.',
      couldNotSave: 'That did not save. Nothing has changed — try again.',
      couldNotAct: 'That did not go through. Nothing has changed — try again.',
    },

    topicWeights: 'Topic weights',
    recompute: 'Recompute from the bank',
    override: 'Override',
    backToBank: 'Back to the bank',
    setByReviewer: 'Set by a reviewer',
    noProgramme: 'No published programme to weight yet.',
    weightingProgramme: 'Weighting',
    switchProgramme: 'Programme to weight',
    weightsScope: (name: string) =>
      `These weights shape every mock paper generated for ${name}, and nothing outside it.`,

    /*
     * The sitting date, which nothing could set until T-269.
     *
     * The copy says what it governs, because it governs a lot: the study plan
     * divides the questions a student has left by the days remaining, so one
     * wrong date gives a whole programme a wrong daily target that looks
     * exactly as authoritative as a right one.
     */
    examDateLabel: 'Exam date for this programme',
    examDateGoverns: (name: string) =>
      `Every ${name} student's daily target counts down to this date.`,
    examDateNone: 'No date set, so no student in this programme has a daily target.',
    publishedBankSays: (published: number, derived: number) =>
      `${published} published · bank says ${derived}%`,
    weightLabel: (topic: string) => `Weight for ${topic}, whole percent`,
    reasonLabel: (topic: string) => `Why ${topic} is being overridden`,
    reasonPlaceholder: 'Past papers give this more than the bank does.',
    balanced: 'Balanced',
    withdrawTitle: (stableId: string) => `Withdraw ${stableId}?`,
    withdrawIntro:
      'The question stops being served and stops being sampled into new papers. It is not deleted — students’ history keeps pointing at something real.',
    withdrawIt: 'Withdraw it',
    sayWhyFirst: 'Say why first',
    withdrawReasonLabel: 'Why is it being withdrawn?',
    withdrawReasonPlaceholder: 'Option B is also correct.',
    notKnown: 'Not known',
    attemptsRecorded: 'attempts recorded',
    attemptsNote: 'Kept as they are. A past answer stays what it was.',
    sittingsInProgress: 'sittings in progress',
    sittingsNote: 'Students in a timed exam right now, with this question on their paper.',
    readinessFigures: 'students’ readiness figures',
    readinessNote: 'Their readiness rests partly on this question.',
  },

  /**
   * The provider's two screens (T-227, T-228).
   *
   * Written for somebody whose job is oversight rather than operation. Every
   * figure names what was measured to get it, because a status board is where
   * an unexplained number does the most damage — somebody acts on it at two in
   * the morning.
   */
  provider: {
    // The bar's own name when a provider is looking at it. A provider outranks
    // an admin and sees screens an admin cannot, so badging their session
    // "Admin" is simply the wrong word for what they are.
    nav: { title: 'Lomi-Exams Provider', activity: 'Activity', health: 'Health' },

    activity: {
      title: 'Activity',
      intro:
        'Everything that has happened, newest first — staff actions, sign-ins, payments, practice and mock exams, in one feed.',
      working: 'Reading the record…',
      couldNotLoad: 'The activity could not be read. Nothing is lost — try again.',
      empty: 'Nothing has happened yet on this server.',
      more: 'Show older',
      loadingMore: 'Reading…',
      end: 'That is the whole record.',

      all: 'Everything',
      kindStaff: 'Staff actions',
      kindSignin: 'Sign-ins',
      kindSignout: 'Sign-outs',
      kindPayment: 'Payments',
      kindPractice: 'Practice',
      kindExam: 'Mock exams',

      staffTag: 'Staff',
      counted: (shown: number) => `${shown} events shown`,
      scanned: (staff: number, signins: number, payments: number, attempts: number) =>
        `read from ${staff} staff actions, ${signins} sessions, ${payments} payments and ${attempts} attempts`,
    },

    health: {
      title: 'Health',
      intro: 'Measured now, every time this page asks. Nothing here is cached.',
      working: 'Checking…',
      couldNotLoad: 'The health check did not answer. That is itself worth knowing — try again.',

      live: 'Live',
      lastChecked: (clock: string) => `checked ${clock}`,
      nextIn: (seconds: number) => `next in ${seconds}s`,
      pause: 'Pause',
      resume: 'Resume',
      recent: (count: number) => `last ${count} checks`,

      database: 'Database',
      api: 'API',
      web: 'Front end',
      security: 'Security',
      vps: 'Server',
      sms: 'SMS',

      ok: 'Working',
      degraded: 'Needs a look',
      down: 'Not answering',
      notConfigured: 'Not set up',

      allWell: 'Everything is answering.',
      somethingUp: 'Something needs a look.',
      somethingDown: 'Something is not answering.',
    },
  },

  error: {
    didNotLoad: 'That did not load',
    routeBody: (digest: string) =>
      `Nothing you have answered is lost — your work is saved as you go. Try again, and if it ` +
      `keeps happening, tell support${digest ? ` and quote ${digest}` : ''}.`,
    generic: 'Something we did not expect happened. Try again.',
  },
};

/**
 * The shape every locale must satisfy. Derived, so it cannot drift from `en`.
 *
 * No `as const` on `en`, deliberately: it would make every string a literal
 * type, and `Copy` would then demand that Amharic say the English words. The
 * widened shape is the contract — same keys, same argument lists, any wording.
 */
export type Copy = typeof en;

/**
 * Amharic was removed on 2026-08-20 (owner decision: English only).
 *
 * It was ~718 lines of first-draft translation that no student could ever
 * reach — there was no locale switcher and `DEFAULT_LOCALE` was English, so it
 * was waiting on a native review that is no longer coming. Deleting it also
 * drops a 198KB Ethiopic font from every first load, which on a metered
 * connection is the largest single saving available anywhere in this app.
 *
 * The exam is in English, so the product is too. Restoring a second locale
 * means re-translating from `en`, not un-deleting this.
 */
