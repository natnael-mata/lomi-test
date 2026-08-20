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
    formatHint: 'Use the 16 columns in docs/question_import_template.csv.',

    read: 'Rows read',
    created: 'Added',
    updated: 'Updated',
    rejected: 'Not taken',
    nothingRead: 'That file had no rows in it. Check it is the right file and try again.',
    couldNotUpload: 'The upload did not go through. Nothing was changed — try again.',
    allTaken: 'Every row was taken. They are drafts until a reviewer publishes them.',
    someRejected: (count: number) =>
      `${count} row${count === 1 ? '' : 's'} could not be taken. Each one says why below.`,
    line: (n: number) => `line ${n}`,
  },

  choose: {
    notReady: 'Being written',
    notReadyWhy: 'No questions in this programme yet. Pick another for now.',
    questionsAvailable: (count: number) => `${count} question${count === 1 ? '' : 's'} ready`,
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

    confirm: 'Start practising',
    saving: 'Saving…',
    couldNotSave: 'That did not save. Choose again — nothing else is affected.',
    chosen: (name: string) => `You are practising ${name}.`,
    change: 'Change programme',
  },

  nav: {
    practice: 'Practise',
    exam: 'Mock',
    progress: 'Progress',
    standing: 'Standing',
    checkout: 'Access',

    main: 'Main',
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
    devicesIntro: 'Two devices at a time. Signing in on a third ends the oldest.',
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

  devLogin: {
    title: 'Sign in for testing',
    intro: 'Choose who to sign in as. This page is for local testing only.',
    password: 'Password',
    passwordHint: 'Already filled in. Leave it as it is.',
    signingIn: 'signing in…',
    wrongPassword: 'That password is not right, or testing sign-in is switched off on this server.',
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
    admin: 'Admin',
    adminNote: "Sees the admin pages and can settle User B's payment.",
    provider: 'Provider',
    providerNote: 'Above admin — the activity log and the live health board.',
  },

  home: {
    tagline: 'Practise for your exit exam, one question at a time.',
    working: 'Loading…',

    signedOut: 'Open Lomi-Test from the Telegram bot to sign in.',
    signedOutWhy: 'Signing in through Telegram means no password to remember and none to lose.',

    goPractice: 'Practise',
    goPracticeWhy: 'Answer questions and see why each answer is right.',
    goExam: 'Mock exam',
    goExamWhy: '100 questions in 3 hours, sat once through.',
    goProgress: 'Progress',
    goProgressWhy: 'Where you are strong, and what to work on next.',
    goStanding: 'Where you stand',
    goStandingWhy: 'Your points, your streak and the board.',
    goCheckout: 'Get full access',
    goCheckoutWhy: 'Six or twelve months, from the day you pay.',

    accessUntil: (date: string) => `Full access until ${date}.`,
    freeTier: 'You are on the free questions.',
  },

  practice: {
    title: 'Practise',
    startPractising: 'Start practising',
    doneForToday: 'Done for today',
    freeLimit: 'That is your ten free questions',
    seePlans: 'See the plans',
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
    goToExam: 'Go to your exam',
    outOfNewTitle: 'That is your ten free questions',
    outOfNewBody:
      'You can keep going over the ones you have already answered as often as you like — ' +
      'that stays free. New questions are part of a subscription.',
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
      'Every question in the bank comes with a full explanation. Unlock the rest for six or ' +
      'twelve months — one plan covers every programme.',
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
    title: 'Sign in with Telegram',
    intro:
      'No passwords, no forms. Open Telegram, press Start, and this page signs you in by itself.',
    open: 'Open Telegram',
    beforeYouApprove: 'Before you approve',
    checkCode: (bot: string) =>
      `${bot} will ask you to confirm this sign-in. Check it shows this code before you press ` +
      'approve — if the numbers differ, somebody else asked, and you should decline.',
    waiting: 'Waiting for Telegram — this page checks by itself',
    expiresIn: (clock: string) => `Code expires in ${clock}`,
    newCode: 'Get a new code',
    starting: 'Getting your code…',

    // The signed-out home. Three lines are the whole onboarding story.
    valueTitle: 'Ready for the Exit Exam',
    valueBody:
      'Practise real questions with full explanations, sit timed mocks, and see exactly which ' +
      'topics to study next.',
    step1: 'Open Telegram and press Start — that is the whole sign-up.',
    step2: 'You come straight back here, signed in. No password, ever.',
    step3: 'Your first 10 questions are free — explanations included.',
    continue: 'Continue with Telegram',
    coverage: 'One plan covers Computer Science, Public Health, and Accounting & Finance.',

    signedIn: 'You are signed in.',
    goPractise: 'Start practising',
    // Names the fix. The bot token being unset is an operator's problem, and
    // the student reading this can do nothing about it — so it says who can.
    notConfigured:
      'Telegram sign-in is not switched on for this server yet. Nothing is wrong with your ' +
      'account — tell whoever runs this copy of Lomi-Test.',
    couldNotStart:
      'The sign-in code could not be fetched. Nothing is lost — try again in a moment.',
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
    resumeTitle: 'You have a paper open',
    resumeBody: (answered: number, total: number) =>
      `${answered} of ${total} answered. Your answers are saved and the clock has kept running.`,
    resume: (position: number) => `Go back to question ${position}`,
    preparing: 'Preparing your paper…',
    chooseProgramme: 'Choose a programme first.',
    seePlans: 'See the plans',
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
    evidenceTitle: 'What each score rests on',
    fromAnswers: (pct: number, answered: number) =>
      `${pct}% from ${answered} answer${answered === 1 ? '' : 's'}`,
    thinEvidence: 'too few to be sure',
    unansweredInMocks: (count: number) =>
      `${count} mock question${count === 1 ? '' : 's'} ${count === 1 ? 'was' : 'were'} ` +
      `left unanswered and ${count === 1 ? 'is' : 'are'} not counted above.`,
  },

  checkout: {
    title: 'Get full access',
    working: 'Loading the plans…',
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
    countedFromToday: 'Counted from today. One plan covers every programme.',

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
    streak: 'Days practised',
    streakNever: 'No days yet. The first one counts from today.',
    streakDays: (days: number) => `${days} day${days === 1 ? '' : 's'}`,
    toNextTier: (points: number, tier: string) => `${points} points to ${tier}`,
    topTier: 'You are at the top tier.',

    howEarned: 'How you earned them',
    recentOnly: 'Your most recent awards. Older ones are counted in the total above.',
    ledgerEmpty: 'Nothing yet. Points appear here the moment you answer a question.',

    board: 'The board',
    boardEmpty: 'Nobody has scored yet. Answer a question and you are first.',
    yourRank: (rank: number) =>
      `You are ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}`,
    notListed: 'You are not shown on the board. Your rank is still yours to see.',
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
    nav: {
      title: 'Lomi-Test Admin',
      label: 'Admin sections',
      dashboard: 'Dashboard',
      payments: 'Payments',
      import: 'Import',
      review: 'Review',
      weights: 'Weights',
      users: 'Users',
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
    nav: { activity: 'Activity', health: 'Health' },

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
 * Amharic — **first draft, pending review**.
 *
 * Typed as `Copy`, so this file will not compile until every key exists. That is
 * deliberate: a missing key falling back to English is how an app ends up half
 * translated in a way nobody notices until a student mentions it.
 */
export const am: Copy = {
  common: {
    tryAgain: 'እንደገና ይሞክሩ',
    cancel: 'ይቅር',
    save: 'አስቀምጥ',
    back: 'ተመለስ',
    next: 'ቀጣይ',
    somethingSaved: 'የመለሱት ምንም አልጠፋም — ስራዎ በሂደት ላይ ይቀመጣል።',
  },

  importer: {
    title: 'ጥያቄዎችን ይጫኑ',
    intro: 'ጥያቄዎች እንደ ረቂቅ ይገባሉ። ገምጋሚ እስኪያትም ድረስ የጫኑት ምንም ወደ ተማሪ አይደርስም።',
    pickFile: 'የCSV ፋይል ይምረጡ',
    orPaste: 'ወይም የፋይሉን ይዘት ይለጥፉ',
    upload: 'ጫን',
    uploading: 'ፋይሉ እየተነበበ ነው…',
    formatHint: 'docs/question_import_template.csv ውስጥ ያሉትን 16 አምዶች ይጠቀሙ።',

    read: 'የተነበቡ ረድፎች',
    created: 'የተጨመሩ',
    updated: 'የተሻሻሉ',
    rejected: 'ያልተወሰዱ',
    nothingRead: 'ያ ፋይል ምንም ረድፍ አልነበረውም። ትክክለኛው ፋይል መሆኑን አረጋግጠው እንደገና ይሞክሩ።',
    couldNotUpload: 'መጫኑ አልተሳካም። ምንም አልተቀየረም — እንደገና ይሞክሩ።',
    allTaken: 'ሁሉም ረድፎች ተወስደዋል። ገምጋሚ እስኪያትማቸው ድረስ ረቂቅ ናቸው።',
    someRejected: (count: number) => `${count} ረድፍ ሊወሰድ አልቻለም። እያንዳንዱ ምክንያቱን ከታች ይናገራል።`,
    line: (n: number) => `መስመር ${n}`,
  },

  choose: {
    notReady: 'በመዘጋጀት ላይ',
    notReadyWhy: 'በዚህ ዘርፍ ገና ጥያቄዎች የሉም። ለጊዜው ሌላ ይምረጡ።',
    questionsAvailable: (count: number) => `${count} ጥያቄ ተዘጋጅቷል`,
    title: 'የትኛውን ዘርፍ ነው የሚፈተኑት?',
    intro: 'ይህ የሚለማመዷቸውን ጥያቄዎች በሙሉ ይወስናል። በኋላ መቀየር ይችላሉ።',
    working: 'ዘርፎቹ እየተጫኑ ነው…',
    couldNotLoad: 'ዘርፎቹ ሊጫኑ አልቻሉም። ምንም አልጠፋም — እንደገና ይሞክሩ።',
    none: 'እስካሁን የቀረበ ዘርፍ የለም። ቆይተው ይመልከቱ።',

    retakerQuestion: 'የመውጫ ፈተናውን ከዚህ በፊት ተፈትነዋል?',
    retakerYes: 'አዎ፣ እንደገና እየተፈተንኩ ነው',
    retakerNo: 'አይ፣ ይህ የመጀመሪያዬ ነው',
    retakerWhy: 'ዛሬ በሚያገኙት ጥያቄ ላይ ምንም አይለውጥም። ወደፊት እንደገና ለሚፈተኑ በተሻለ ለመርዳት ነው የምንጠይቀው።',

    confirm: 'ልምምድ ጀምር',
    saving: 'በማስቀመጥ ላይ…',
    couldNotSave: 'አልተቀመጠም። እንደገና ይምረጡ — ሌላ ምንም አልተነካም።',
    chosen: (name: string) => `${name} እየተለማመዱ ነው።`,
    change: 'ዘርፍ ቀይር',
  },

  nav: {
    practice: 'ተለማመድ',
    exam: 'ሙከራ',
    progress: 'እድገት',
    standing: 'ደረጃ',
    checkout: 'መዳረሻ',

    main: 'ዋና',
    accessUntil: (date: string) => `መዳረሻ እስከ ${date}`,
  },

  theme: {
    lightSwitchToDark: 'ብሩህ · ወደ ጨለማ ቀይር',
    darkSwitchToLight: 'ጨለማ · ወደ ብሩህ ቀይር',
  },

  answer: {
    correct: 'ትክክል',
    yours: 'የእርስዎ',
    selected: 'ተመርጧል',
  },

  account: {
    title: 'ይህ መለያ',
    devicesTitle: 'የገቡባቸው መሣሪያዎች',
    devicesIntro: 'በአንድ ጊዜ ሁለት መሣሪያ። በሦስተኛው ሲገቡ በጣም የቆየው ይዘጋል።',
    thisDevice: 'ይህ መሣሪያ',
    unknownDevice: 'ያልታወቀ መሣሪያ',
    signedInAt: (when: string) => `የገቡበት ${when}`,
    lastSeen: (when: string) => `መጨረሻ የተጠቀሙበት ${when}`,
    revoke: 'ይህንን አውጣ',
    revoking: 'በማውጣት ላይ…',
    noDevices: 'ሌላ የገባ የለም።',
    devicesLoading: 'በመጫን ላይ…',
    devicesFailed: 'መሣሪያዎችዎን መጫን አልተቻለም።',
    signOut: 'ውጣ',
    signingOut: 'በመውጣት ላይ…',
    signOutFailed: 'መውጣት አልተቻለም። እንደገና ይሞክሩ።',
  },

  devLogin: {
    title: 'ለሙከራ ይግቡ',
    intro: 'በማን ስም እንደሚገቡ ይምረጡ። ይህ ገጽ ለአካባቢያዊ ሙከራ ብቻ ነው።',
    password: 'የይለፍ ቃል',
    passwordHint: 'አስቀድሞ ተሞልቷል። እንዳለ ይተውት።',
    signingIn: 'በመግባት ላይ…',
    wrongPassword: 'የይለፍ ቃሉ ትክክል አይደለም፣ ወይም የሙከራ መግቢያ በዚህ ሰርቨር ላይ ጠፍቷል።',
    failed: (status: number) => `መግባት አልተቻለም (${status})። ኤፒአይው እየሄደ መሆኑን ያረጋግጡ።`,
    noServer: 'ሰርቨሩ ሊደረስ አልቻለም። ኤፒአይው እየሄደ ነው?',
    userA: 'ተጠቃሚ ሀ',
    userANote: 'አዲስ — ገና ፕሮግራም አልመረጠም። ከዚህ ይጀምሩ።',
    userB: 'ተጠቃሚ ለ',
    userBNote: 'ከ10 ነጻ ጥያቄዎች 8ቱ ተጠቅሟል፣ እና የሚረጋገጥ የባንክ ዝውውር አለው።',
    userC: 'ተጠቃሚ ሐ',
    userCNote: 'ለ12 ወራት ከፍሏል — ደረሰኝ፣ የክፍያ ታሪክ እና የሙከራ ፈተና።',
    userD: 'ተጠቃሚ መ',
    userDNote: 'አስሩንም ነጻ ጥያቄዎች ጨርሷል፣ ከፍሎ አያውቅም — ወዲያውኑ የክፍያ ግድግዳውን ያገኛል።',
    userE: 'ተጠቃሚ ሠ',
    userENote: 'ከፍሎ ነበር፣ ትናንት አብቅቷል — የማደስ አቅርቦት እንጂ የመጀመሪያ ጊዜ አይደለም።',
    userF: 'ተጠቃሚ ረ',
    userFNote: 'ያልተረከበ የተከፈተ የሙከራ ፈተና — መቀጠሉና የልምምድ መቆለፊያው።',
    userG: 'ተጠቃሚ ሰ',
    userGNote: 'የጨረሰው የሙከራ ፈተና — ውጤቱ፣ ግምገማውና አዝማሚያው።',
    userH: 'ተጠቃሚ ሸ',
    userHNote: 'አምስት ቀን ተሳትፏል፣ ነጥብም አለው — ደረጃውና የደረጃ ሰሌዳው።',
    userI: 'ተጠቃሚ ቀ',
    userINote: '15 መልሷል፣ ሩብ ያህሉን አግኝቷል — ዜናው መጥፎ ሲሆን ዝግጁነት።',
    userJ: 'ተጠቃሚ በ',
    userJNote: 'ሁለት የነቁ መሣሪያዎች፣ ጣሪያው ላይ — የመሣሪያ ዝርዝሩና መወገዱ።',
    admin: 'አስተዳዳሪ',
    adminNote: 'የአስተዳዳሪ ገጾችን ያያል እና ክፍያዎችን ማረጋገጥ ይችላል።',
    provider: 'አቅራቢ',
    providerNote: 'ከአስተዳዳሪ በላይ — የእንቅስቃሴ መዝገብ እና የቀጥታ ጤንነት ሰሌዳ።',
  },

  home: {
    tagline: 'ለመውጫ ፈተናዎ ይዘጋጁ፣ በአንድ ጥያቄ በአንድ ጊዜ።',
    working: 'በመጫን ላይ…',

    signedOut: 'ለመግባት ሎሚ-ቴስትን ከቴሌግራም ቦቱ ይክፈቱ።',
    signedOutWhy: 'በቴሌግራም መግባት ማለት የሚያስታውሱት የይለፍ ቃል የለም፣ የሚጠፋም የለም።',

    goPractice: 'ተለማመድ',
    goPracticeWhy: 'ጥያቄዎችን ይመልሱ እና እያንዳንዱ መልስ ለምን ትክክል እንደሆነ ይመልከቱ።',
    goExam: 'ሙከራ ፈተና',
    goExamWhy: '100 ጥያቄዎች በ3 ሰዓት፣ በአንድ ጊዜ።',
    goProgress: 'እድገት',
    goProgressWhy: 'የት እንደጠነከሩ፣ እና ቀጥሎ ምን መስራት እንዳለብዎ።',
    goStanding: 'ያሉበት ደረጃ',
    goStandingWhy: 'ነጥቦችዎ፣ ተከታታይ ቀናትዎ እና ሰሌዳው።',
    goCheckout: 'ሙሉ መዳረሻ ያግኙ',
    goCheckoutWhy: 'ስድስት ወይም አስራ ሁለት ወራት፣ ከከፈሉበት ቀን ጀምሮ።',

    accessUntil: (date: string) => `ሙሉ መዳረሻ እስከ ${date} ድረስ።`,
    freeTier: 'በነጻ ጥያቄዎች ላይ ነዎት።',
  },

  practice: {
    title: 'ተለማመድ',
    startPractising: 'ልምምድ ጀምር',
    doneForToday: 'ለዛሬ ተጠናቋል',
    freeLimit: 'ያ አስሩ ነጻ ጥያቄዎችዎ ናቸው',
    seePlans: 'እቅዶቹን ይመልከቱ',
    nextQuestion: 'ቀጣይ ጥያቄ',
    practiseTopic: (topic: string) => `${topic}ን ተለማመድ`,
    whyRanked:
      'የተመደበው እያንዳንዱ ርዕስ ባስከተለው ውጤት መጠን ነው — ባለፉት ፈተናዎች ያለው ድርሻ ከስንቱ እንዳመለጠዎት ጋር ተያይዞ፣ በስህተት ብዛት አይደለም።',

    loading: 'ጥያቄ በመጫን ላይ…',
    checkAnswer: 'መልሱን ይመልከቱ',
    checking: 'በመመልከት ላይ…',
    chooseFirst: 'መጀመሪያ መልስ ይምረጡ',
    nothingLeftToday: 'በዚህ ፕሮግራም ውስጥ ዛሬ የሚለማመዱት ነገር የለም።',
    didNotLoad: 'አልተጫነም። የመለሱት ምንም አልጠፋም — እንደገና ይሞክሩ።',

    freeLeft: (count: number) => `${count} ነጻ ቀርቷል`,
    seenBefore: 'ይህንን ከዚህ በፊት መልሰውታል',
    goToExam: 'ወደ ፈተናዎ ይሂዱ',
    outOfNewTitle: 'ያ አስሩ ነጻ ጥያቄዎችዎ ናቸው',
    outOfNewBody:
      'ቀደም ብለው የመለሷቸውን ጥያቄዎች እንደፈለጉት ደጋግመው መስራት ይችላሉ — ያ ነጻ ሆኖ ይቀጥላል። ' +
      'አዲስ ጥያቄዎች ግን የደንበኝነት ምዝገባ አካል ናቸው።',
  },

  paywall: {
    title: 'አስሩንም ነጻ ጥያቄዎችዎን ተጠቅመዋል',
    intro:
      'በባንኩ ውስጥ ያለ እያንዳንዱ ጥያቄ ሙሉ ማብራሪያ አለው። የቀሩትን ለስድስት ወይም ለአስራ ሁለት ወራት ይክፈቱ — አንድ እቅድ ሁሉንም ፕሮግራሞች ይሸፍናል።',
    months: (count: number) => `${count} ወራት`,
    perMonth: (etb: number) => `ብር ${etb} / ወር`,
    price: (etb: number) => `ብር ${etb}`,
    bestValue: 'የተሻለ ዋጋ',
    footnote: 'ከከፈሉበት ቀን ጀምሮ ይቆጠራል። telebirr፣ CBE Birr፣ ካርድ ወይም የባንክ ዝውውር።',
    cta: 'እቅዶቹን ይመልከቱ እና ይክፈሉ',
  },

  signIn: {
    title: 'በTelegram ይግቡ',
    intro: 'የይለፍ ቃል የለም፣ ቅጽ የለም። Telegram ይክፈቱ፣ Start ይጫኑ፣ ይህ ገጽ በራሱ ያስገባዎታል።',
    open: 'Telegram ክፈት',
    beforeYouApprove: 'ከማጽደቅዎ በፊት',
    checkCode: (bot: string) =>
      `${bot} ይህን መግቢያ እንዲያረጋግጡ ይጠይቅዎታል። ከማጽደቅዎ በፊት ይህን ኮድ እንደሚያሳይ ያረጋግጡ — ቁጥሮቹ ከተለያዩ ሌላ ሰው ጠይቋል፣ ` +
      'እርስዎም መከልከል አለብዎት።',
    waiting: 'Telegramን በመጠበቅ ላይ — ይህ ገጽ በራሱ ይመለከታል',
    expiresIn: (clock: string) => `ኮዱ በ${clock} ውስጥ ያበቃል`,
    newCode: 'አዲስ ኮድ ያግኙ',
    starting: 'ኮድዎን በማምጣት ላይ…',

    valueTitle: 'ለመውጫ ፈተና ዝግጁ',
    valueBody:
      'እውነተኛ ጥያቄዎችን ከሙሉ ማብራሪያ ጋር ይለማመዱ፣ በሰዓት የተገደቡ ሙከራዎችን ይቀመጡ፣ እና ቀጥሎ የትኞቹን ርዕሶች ማጥናት እንዳለብዎት በትክክል ይመልከቱ።',
    step1: 'Telegram ይክፈቱ እና Start ይጫኑ — ምዝገባው ያ ብቻ ነው።',
    step2: 'ወዲያውኑ ወደዚህ ተመልሰው ገብተዋል። የይለፍ ቃል፣ በፍጹም።',
    step3: 'የመጀመሪያዎቹ 10 ጥያቄዎችዎ ነጻ ናቸው — ማብራሪያዎቹን ጨምሮ።',
    continue: 'በTelegram ይቀጥሉ',
    coverage: 'አንድ እቅድ ኮምፒውተር ሳይንስን፣ የሕዝብ ጤናን እና አካውንቲንግ እና ፋይናንስን ይሸፍናል።',

    signedIn: 'ገብተዋል።',
    goPractise: 'ልምምድ ጀምር',
    notConfigured:
      'የTelegram መግቢያ በዚህ አገልጋይ ላይ ገና አልተከፈተም። በመለያዎ ላይ ምንም ችግር የለም — ይህን የLomi-Test ቅጂ ለሚያስተዳድረው ሰው ይንገሩ።',
    couldNotStart: 'የመግቢያ ኮዱን ማምጣት አልተቻለም። ምንም አልጠፋም — ከጥቂት ጊዜ በኋላ እንደገና ይሞክሩ።',
  },

  exam: {
    title: 'ሙከራ ፈተና',
    intro: (questions: number, minutes: number) =>
      `${questions} ጥያቄዎች በ${minutes} ደቂቃ፣ በአንድ ጊዜ። እስኪያስረክቡ ድረስ ምንም አይታረምም።`,
    start: 'ሙከራውን ጀምር',
    resumeTitle: 'ያልጨረሱት ወረቀት አለዎት',
    resumeBody: (answered: number, total: number) =>
      `ከ${total} ውስጥ ${answered} ተመልሷል። መልሶችዎ ተቀምጠዋል፣ ሰዓቱም ሲሄድ ቆይቷል።`,
    resume: (position: number) => `ወደ ጥያቄ ${position} ተመለስ`,
    preparing: 'ወረቀትዎ እየተዘጋጀ ነው…',
    chooseProgramme: 'መጀመሪያ የትምህርት ዘርፍ ይምረጡ።',
    seePlans: 'እቅዶቹን ይመልከቱ',
    finished: 'ፈተናው ተጠናቋል',
    answersRecorded: 'መልሶችዎ ተመዝግበዋል። ግምገማው በመምጣት ላይ ነው።',
    questionOf: (position: number, total: number) => `ጥያቄ ${position} ከ${total}`,
    flag: 'ለግምገማ ምልክት አድርግ',
    unflag: 'ምልክቱን አንሳ',
    firstQuestion: 'ይህ የመጀመሪያው ጥያቄ ነው',
    lastQuestion: 'ይህ የመጨረሻው ጥያቄ ነው',
    submit: (answered: number, total: number) => `አስረክብ — ${answered} ከ${total} ተመልሷል`,
    confirmTitle: 'ያልተመለሱ ጥያቄዎች እያሉ ያስረክባሉ?',
    confirmBody: (left: number) =>
      `${left} ጥያቄ መልስ የለውም። ` + 'ያልተመለሱ ጥያቄዎች እንደ ስህተት ይቆጠራሉ፣ የተረከበ ወረቀትም እንደገና አይከፈትም።',
    confirmBack: 'ወደ እነሱ ተመለስ',
    confirmSubmit: 'ለማንኛውም አስረክብ',
    pendingSync: (count: number) =>
      `${count} መልስ በዚህ ስልክ ተቀምጧል፣ ለመላክ በመጠባበቅ ላይ። ` + 'ይቀጥሉ — ግንኙነቱ ሲመለስ ይላካሉ።',
    questionNavigator: 'የጥያቄ መዳሰሻ',
    everyQuestion: 'እያንዳንዱ ጥያቄ',
    questionNumber: (position: number) => `ጥያቄ ${position}`,
    showMore: (count: number) => `ተጨማሪ ${count} አሳይ`,
    ranOutOfTime: 'ከማስረከብዎ በፊት ጊዜው አልቋል። የመለሱት ሁሉ ተይዟል።',
  },

  summary: {
    thisMock: 'ይህ ሙከራ',
    ofThePaper: (pct: number) => `ከወረቀቱ ${pct}%`,
    ofThePaperWithUnanswered: (pct: number, unanswered: number) =>
      `ከወረቀቱ ${pct}% · ${unanswered} ሳይመለሱ ቀርተዋል`,
    nothingToSummarise: 'የሚጠቃለል ነገር የለም',
    noQuestions: 'በዚህ ወረቀት ላይ ጥያቄዎች አልነበሩም።',
    reviseNext: 'ቀጥሎ ይከልሱ',
    practiseNext: 'ቀጥሎ ይለማመዱ',
    today: 'ዛሬ',
    nothingAnswered: 'እስካሁን ምንም አልተመለሰም',
    answerToStart: 'አንድ ጥያቄ ይመልሱ፣ ማጠቃለያው ከዚህ ይጀምራል።',
    shareOfPastPapers: (pct: number) => `ባለፉት ፈተናዎች ${pct}% ድርሻ`,
    shareNotWorkedOut: 'ባለፉት ፈተናዎች ያለው ድርሻ ገና አልተሰላም',
    acrossTopics: (pct: number, topics: number) => `${pct}% በ${topics} ርዕስ`,
  },

  progress: {
    title: 'እድገት',
    working: 'የት እንዳሉ እየተሰላ ነው…',
    couldNotLoad: 'እድገትዎ አልተጫነም። የመለሱት ምንም አልጠፋም — እንደገና ይሞክሩ።',
    nothingYet: 'እስካሁን ምንም አልተመለሰም፣ ስለዚህ የሚታይ የዝግጁነት አኃዝ የለም። ጥቂት ጥያቄዎችን ይመልሱ፣ ከዚህ ይጀምራል።',
    chooseProgramme: 'እድገትዎን ለማየት የትምህርት ዘርፍ ይምረጡ።',
    mockScores: 'የሙከራ ውጤቶች',
    mocksSat: 'የተቀመጡ ሙከራዎች',
    noneYet: 'ገና የለም',
    mostRecent: (pct: number) => `የቅርብ ጊዜ: ${pct}%`,
    trendEmpty: 'አንድ ሙከራ ከተቀመጡ በኋላ የሙከራ ውጤቶችዎ እዚህ ይታያሉ።',
    notReached: (count: number) => `${count} አልተደረሰም`,
    readiness: 'ዝግጁነት',
    focus: 'ትኩረት',
    evidenceTitle: 'እያንዳንዱ ውጤት የተመሠረተበት',
    fromAnswers: (pct: number, answered: number) => `${pct}% ከ${answered} መልስ`,
    thinEvidence: 'ለመወሰን በጣም ጥቂት ነው',
    unansweredInMocks: (count: number) => `${count} የሙከራ ጥያቄ ሳይመለስ ቀርቷል፣ ከላይም አልተቆጠረም።`,
  },

  checkout: {
    title: 'ሙሉ መዳረሻ ያግኙ',
    working: 'እቅዶቹ እየተጫኑ ነው…',
    perMonth: (etb: number) => `በወር ብር ${etb}`,
    forMonths: (etb: number, months: number) => `ብር ${etb} ለ${months} ወራት`,
    bestValue: 'የተሻለ ዋጋ',
    savingVs: (pct: number) => `በወር ${pct}% ያንሳል`,
    howToPay: 'እንዴት መክፈል ይፈልጋሉ?',

    telebirr: 'ቴሌብር',
    telebirrHow: 'ወደ ስልክዎ ጥያቄ እንልካለን — እዚያው ላይ ያጸድቁታል።',
    cbebirr: 'ሲቢኢ ብር',
    cbebirrHow: 'ወደ ስልክዎ ጥያቄ እንልካለን — እዚያው ላይ ያጸድቁታል።',
    chapa: 'ካርድ ወይም ሌላ ዋሌት',
    chapaHow: 'የቻፓን ደህንነቱ የተጠበቀ የክፍያ ገጽ ይከፍታል።',
    bank: 'የባንክ ዝውውር',
    bankHow: 'ከማንኛውም ባንክ ይክፈሉ፣ ከዚያ ማመሳከሪያውን ይለጥፉ — አንድ ሰው ያረጋግጠዋል።',

    mobileLabel: 'የሚከፍሉበት ስልክ ቁጥር',
    mobileHint: 'ለምሳሌ 0911223344።',
    mobileFromTelegram: 'በTelegram ካጋሩት ቁጥር። በሌላ ቁጥር የሚከፍሉ ከሆነ ይቀይሩት።',
    mobileInvalid: 'ይህ የኢትዮጵያ የሞባይል ቁጥር አይመስልም። አረጋግጠው እንደገና ይሞክሩ።',
    txRefLabel: 'የዝውውር ማመሳከሪያ',
    txRefHint:
      'ማመሳከሪያው በባንክዎ የማረጋገጫ ኤስኤምኤስ ላይ ነው። እያንዳንዱን ጥያቄ አንድ ሰው ይመለከተዋል — መዳረሻ የሚሰጠው ከተረጋገጠ በኋላ ነው፣ ' +
      'አብዛኛውን ጊዜ በጥቂት ሰዓታት ውስጥ።',
    txRefRequired: 'ከዝውውር ደረሰኝዎ ላይ ያለውን የግብይት ቁጥር ያስገቡ።',
    txRefTaken: 'ይህ የግብይት ቁጥር ቀድሞ ደርሶናል። ድጋፍ ሰጪው ሊፈትሽልዎ ይችላል።',

    heading: 'መዳረሻ',
    chosen: 'ተመርጧል',
    countedFromToday: 'ከዛሬ ጀምሮ ይቆጠራል። አንድ እቅድ ሁሉንም ፕሮግራሞች ይሸፍናል።',

    waitingBanner: 'ስልክዎን ይመልከቱ',
    requestSentTo: (method: string, mobile: string) =>
      `የ${method} ጥያቄ ወደ ${mobile} ልከናል። እዚያው ላይ ያጽድቁት — ይህ ገጽ በራሱ ይዘምናል።`,
    waitingFor: (clock: string) => `${clock} ተጠብቋል — ጥያቄዎች አብዛኛውን ጊዜ በአንድ ደቂቃ ውስጥ ይደርሳሉ።`,
    slowBanner: 'ከወትሮው በላይ እየዘገየ ነው',
    slowBody:
      'በዝግተኛ ኔትወርክ ላይ ጥያቄው እስከ ሁለት ደቂቃ ሊወስድ ይችላል። እስካሁን ምንም አልተከፈለም — መጠበቅ ወይም አዲስ ጥያቄ መላክ ይችላሉ።',
    sendAgain: 'ጥያቄውን እንደገና ላክ',
    payDifferently: 'በሌላ መንገድ ይክፈሉ',

    transferTo: (amount: string) => `${amount} ከማንኛውም ባንክ ወደዚህ ያዛውሩ፦`,
    accountLabel: 'ሂሳብ',
    accountNotPublished:
      'የሚከፈልበት ሂሳብ በዚህ አገልጋይ ላይ አልታተመም። ከማዛወርዎ በፊት ከድጋፍ ሰጪው ይጠይቁ — ተመሳሳይ ዝውውር የሌለው ጥያቄ ሊረጋገጥ አይችልም።',
    submitForVerification: 'ለማረጋገጫ አስገባ',
    submittedBanner: 'ገብቷል — በማረጋገጥ ላይ',
    submittedBody: (ref: string) =>
      `ማመሳከሪያ ${ref} ከቡድናችን ጋር ነው። እንደተረጋገጠ ወዲያውኑ በTelegram እንልክልዎታለን — እስከዚያው ነጻ ጥያቄዎችዎን መለማመድ ይችላሉ።`,

    verifiedBanner: 'ክፍያው ተረጋግጧል',

    pay: 'ክፈል',
    sending: 'በመላክ ላይ…',
    checkYourPhone: (mobile: string) =>
      `የክፍያ ጥያቄ ወደ ${mobile} ተልኳል። በስልክዎ ላይ ያጽድቁት፣ ይህ ገጽ በራሱ ይዘምናል።`,
    stillWaiting: 'አሁንም ክፍያውን በመጠባበቅ ላይ ነን። ካጸደቁት ጥቂት ጊዜ ይስጡት — ይህን ገጽ ቢዘጉትም ምንም አይጠፋም።',
    openingChapa: 'ቻፓ እየተከፈተ ነው…',
    confirmed: 'ሙሉ መዳረሻ አለዎት።',
    accessUntil: (date: string) => `መዳረሻዎ እስከ ${date} ይቆያል።`,
    yourReference: (ref: string) => `የእርስዎ ማመሳከሪያ ${ref} ነው። ይያዙት — ድጋፍ ሰጪው ሊፈትሸው ይችላል።`,
    keepReference: 'ይያዙት — ድጋፍ ሰጪው ሊፈትሸው ይችላል።',
    manualPending:
      'እናመሰግናለን። ዝውውሩን ከባንክ ሪፖርት ጋር የሚያመሳክር ሰው አለ፣ አብዛኛውን ጊዜ በዚያው ቀን፣ ' +
      'እንደተገኘም መዳረሻዎ ወዲያውኑ ይጀምራል።',
    couldNotStart: 'ክፍያው ሊጀመር አልቻለም። ምንም አልተከፈለም — እንደገና ይሞክሩ።',
    unavailable: 'ይህ የመክፈያ መንገድ አሁን አይሰራም። ከታች ያለው የባንክ ዝውውር አሁንም ይሰራል።',
  },

  receipt: {
    working: 'ክፍያዎችዎ እየተጫኑ ነው…',
    couldNotLoad: 'ክፍያዎችዎ ሊጫኑ አልቻሉም። ምንም አልጠፋም — እንደገና ይሞክሩ።',

    plan: 'እቅድ',
    planValue: (months: number) => `${months} ወራት · ሁሉም ፕሮግራሞች`,
    amount: 'መጠን',
    method: 'መንገድ',
    reference: 'ማመሳከሪያ',
    paid: 'የተከፈለበት',
    accessUntil: 'መዳረሻ እስከ',

    history: 'የክፍያ ታሪክ',
    historyRow: (amount: string, months: number) => `${amount} · ${months} ወራት`,
    historyMeta: (method: string, date: string) => `${method} · ${date}`,
    noHistory: 'እስካሁን ምንም የለም። የከፈሉት ሁሉ ከማመሳከሪያው ጋር እዚህ ይታያል።',

    verified: 'ተረጋግጧል',
    pending: 'በመጠባበቅ ላይ',
    notAccepted: 'አልተቀበልንም',

    backToPractising: 'ወደ ልምምድ ተመለስ',
  },

  standing: {
    title: 'ያሉበት ደረጃ',
    working: 'በመቁጠር ላይ…',
    couldNotLoad: 'ደረጃዎ ሊጫን አልቻለም። ምንም አልጠፋም — እንደገና ይሞክሩ።',

    points: 'ነጥቦች',
    pointsFrom: 'ካገኙት ከእያንዳንዱ ሽልማት',
    streak: 'የተለማመዱባቸው ቀናት',
    streakNever: 'ገና ምንም ቀን የለም። የመጀመሪያው ከዛሬ ይጀምራል።',
    streakDays: (days: number) => `${days} ቀን`,
    toNextTier: (points: number, tier: string) => `ወደ ${tier} ${points} ነጥብ ይቀራል`,
    topTier: 'በከፍተኛው ደረጃ ላይ ነዎት።',

    howEarned: 'እንዴት እንዳገኙዋቸው',
    recentOnly: 'የቅርብ ጊዜ ሽልማቶችዎ። የቀድሞዎቹ ከላይ ባለው ጠቅላላ ውስጥ ተቆጥረዋል።',
    ledgerEmpty: 'ገና ምንም የለም። ጥያቄ እንደመለሱ ነጥቦች እዚህ ይታያሉ።',

    board: 'ሰሌዳው',
    boardEmpty: 'እስካሁን ማንም ነጥብ አላገኘም። ጥያቄ ይመልሱና የመጀመሪያው ይሁኑ።',
    yourRank: (rank: number) => `${rank}ኛ ደረጃ ላይ ነዎት`,
    notListed: 'በሰሌዳው ላይ አይታዩም። ደረጃዎ ግን የእርስዎ ነው።',
    hideMe: 'ከሰሌዳው ደብቀኝ',
    showMe: 'በሰሌዳው ላይ አሳየኝ',
  },

  community: {
    title: 'ስለዚህ ርዕስ ጠይቅ',
    working: 'በመጫን ላይ…',
    couldNotLoad: 'ውይይቱ ሊጫን አልቻለም። እንደገና ይሞክሩ።',
    empty: 'በዚህ ርዕስ ላይ ገና ጥያቄ የለም። የመጀመሪያውን ይጠይቁ።',

    askTitle: 'ጥያቄዎ፣ በጥቂት ቃላት',
    askBody: 'ምን ግራ አጋባዎት?',
    ask: 'ጠይቅ',
    asking: 'በመላክ ላይ…',
    titleRequired: 'ሰዎች እንዲያገኙት ለጥያቄዎ ርዕስ ይስጡት።',
    bodyRequired: 'ከመላክዎ በፊት ጥያቄዎን ይጻፉ።',

    replies: (count: number) => `${count} መልስ`,
    reply: 'መልስ',
    replyPlaceholder: 'መልስ ይስጡ ወይም ያክሉ',
    verified: 'ገምጋሚ',
    verifiedMeans: 'ጥያቄዎቹን በሚገመግሙት ሰዎች የተረጋገጠ።',
    yours: 'እርስዎ',
    hidden: 'በአወያይ ተደብቋል። ይህን ማየት የሚችሉት እርስዎ ብቻ ነዎት።',

    report: 'ሪፖርት አድርግ',
    reported: 'ሪፖርት ተደርጓል። አንድ ሰው ይመለከተዋል።',
    reportWhy: 'ለምን ሪፖርት እያደረጉ ነው?',
    reportWrong: 'መልሱ ስህተት ነው',
    reportAbusive: 'ስድብ',
    reportSpam: 'አላስፈላጊ መልእክት',
    reportOffTopic: 'ከርዕስ ውጪ',

    tooFast: 'በፍጥነት እየለጠፉ ነው። ትንሽ ቆይተው እንደገና ይሞክሩ።',
    chooseProgramme: 'ውይይቱን ከመቀላቀልዎ በፊት የትምህርት ዘርፍ ይምረጡ።',
  },

  dashboard: {
    title: 'አጠቃላይ እይታ',
    working: 'በመቁጠር ላይ…',
    couldNotLoad: 'አኃዞቹ ሊጫኑ አልቻሉም። በመረጃው ላይ ችግር የለም — እንደገና ይሞክሩ።',

    signups: 'ተመዝጋቢዎች',
    paying: 'እየከፈሉ ያሉ',
    lapsed: 'ጊዜያቸው ያለፈ',
    trialling: 'እየሞከሩ ያሉ',
    dormant: 'ያልጀመሩ',
    awaitingSettlement: 'ማረጋገጫ በመጠባበቅ ላይ',
    awaitingHow: (count: number) =>
      count === 1
        ? '1 የተጠየቀ ዝውውር የባንክ ሪፖርቱን የሚያረጋግጥ ሰው በመጠባበቅ ላይ ነው።'
        : `${count} የተጠየቁ ዝውውሮች የባንክ ሪፖርቱን የሚያረጋግጥ ሰው በመጠባበቅ ላይ ናቸው።`,
    nothingWaiting: 'ማረጋገጫ የሚጠብቅ ምንም የለም።',

    revenue: 'የተሰበሰበ',
    revenueTotal: 'ጠቅላላ',
    paymentsCounted: (count: number) => `${count} የተረጋገጠ ክፍያ`,
    methodTelebirr: 'ቴሌብር',
    methodCbebirr: 'ሲቢኢ ብር',
    methodChapa: 'የቻፓ ገጽ',
    methodBank: 'የባንክ ዝውውር',

    findStudent: 'ተማሪ ፈልግ',
    searchLabel: 'ስልክ፣ ስም ወይም የግብይት ቁጥር',
    searchHint: 'የግብይት ቁጥር ትክክለኛ መሆን አለበት። ሦስት ፊደል ወይም ከዚያ በላይ።',
    searching: 'በመፈለግ ላይ…',
    noHits: 'ማንም አልተገኘም።',
    matchedOnTxRef: 'በግብይት ቁጥር ተገኘ',
    matchedOnPhone: 'በስልክ ቁጥር ተገኘ',
    matchedOnName: 'በስም ተገኘ',
    deactivated: 'የተዘጋ',
  },

  admin: {
    nav: {
      title: 'Lomi-Test አስተዳደር',
      label: 'የአስተዳደር ክፍሎች',
      dashboard: 'ማጠቃለያ',
      payments: 'ክፍያዎች',
      import: 'ማስገባት',
      review: 'ግምገማ',
      weights: 'ክብደቶች',
      users: 'ተማሪዎች',
    },

    payments: {
      title: 'የተጠየቁ የባንክ ዝውውሮች',
      working: 'ጥያቄዎች እየተጫኑ ነው…',
      couldNotLoad: 'ጥያቄዎቹ ሊጫኑ አልቻሉም። ምንም አልተወሰነም — እንደገና ይሞክሩ።',
      waiting: (count: number) => `${count} በመጠባበቅ ላይ`,
      nothingWaiting: 'የሚመረመር ምንም ነገር የለም።',

      colClaimed: 'የተጠየቀበት',
      colStudent: 'ተማሪ',
      colPhone: 'ስልክ',
      colReference: 'ማመሳከሪያ',
      colAmount: 'መጠን',
      colStatus: 'ሁኔታ',

      open: 'ይህን ጥያቄ ክፈት',
      close: 'ይህን ጥያቄ ዝጋ',

      checkAgainst: 'ከባንክ ሪፖርቱ ጋር ያመሳክሩ',
      expected: (reference: string, amount: string, account: string) =>
        `ማመሳከሪያ ${reference} · ${amount} ወደ ${account} ይጠበቃል።`,
      expectedNoAccount: (reference: string, amount: string) =>
        `ማመሳከሪያ ${reference} · ${amount} ይጠበቃል።`,
      claimedBy: (student: string, joined: string) => `በ${student} የተጠየቀ፣ የተመዘገበው ${joined}።`,
      priorPayments: (verified: number, total: number) =>
        `${total} ቀደም ያሉ ክፍያዎች፣ ${verified} የተረጋገጡ።`,
      noPriorPayments: 'በዚህ መለያ ላይ ቀደም ያለ ክፍያ የለም።',

      reasonLabel: 'ምክንያት — ለመከልከል ያስፈልጋል፣ በሁለቱም ሁኔታ በመዝገብ ላይ ይቀመጣል',
      reasonPlaceholder: 'የገባው መጠን ይመሳሰላል፣ ማመሳከሪያው በሪፖርቱ ላይ ተገኝቷል።',
      approve: 'አጽድቅ — መዳረሻ ስጥ',
      approving: 'መዳረሻ በመስጠት ላይ…',
      reject: 'በምክንያት ከልክል',
      rejecting: 'መከልከሉ በመመዝገብ ላይ…',
      approveNote: 'ማጽደቅ ወዲያውኑ መዳረሻ ይሰጣል እና ለተማሪው በTelegram ይነግረዋል።',
      rejectNeedsReason: 'ከመከልከልዎ በፊት ምክንያቱን ይጻፉ — ይህ ምክንያት ለተማሪው ይነገራል።',
      settled: 'ተወስኗል። ከታች ያለው ዝርዝር እንደሚጠባበቅ አያሳየውም።',
      couldNotSettle: 'አልተሳካም። ምንም አልተሰጠም አልተከለከለም — እንደገና ይሞክሩ።',
    },

    users: {
      title: 'ተማሪዎች',
      intro:
        'መለያን በስልክ፣ በስም ወይም በግብይት ቁጥር ያግኙ፣ ከዚያ መሣሪያዎቹን ዳግም ያስጀምሩ ወይም መለያውን ይዝጉ። ሁለቱም በስምዎ ይመዘገባሉ።',
      resetDevices: 'መሣሪያዎችን ዳግም አስጀምር',
      resetDevicesWhy:
        'ይህን ተማሪ ከሁሉም ቦታ ያስወጣል እና በሁለት መሣሪያዎች ላይ እንደገና እንዲገባ ይፈቅዳል። ስልክ የቀየረ ሰው ሲኖር ይጠቀሙበት።',
      resetting: 'በማስወጣት ላይ…',
      deactivate: 'መለያውን ዝጋ',
      deactivateWhy: 'ይህ መለያ እንዳይገባ ያግዳል። መልሶቻቸውና ክፍያዎቻቸው ይቀመጣሉ — ምንም አይሰረዝም።',
      deactivating: 'በመዝጋት ላይ…',
      reasonLabel: 'ለመዝገብ፣ ለምን',
      reasonPlaceholder: 'ተማሪው ስልኩን ስላጣ የመሣሪያ ዳግም ማስጀመር ጠየቀ።',
      needsReason: 'መጀመሪያ ምክንያቱን ይጻፉ — ይህ ከስምዎ ጋር በመዝገብ ላይ ይጻፋል።',
      devicesReset: 'መሣሪያዎቹ ዳግም ተጀምረዋል። በአዲስ ስልክ እንደገና መግባት ይችላሉ።',
      accountClosed: 'መለያው ተዘግቷል። አገልጋዩን በሚያስተዳድረው ሰው እንደገና ሊከፈት ይችላል።',
      alreadyClosed: 'አስቀድሞ ተዘግቷል',
      couldNotDo: 'አልተሳካም። ምንም አልተለወጠም — እንደገና ይሞክሩ።',
    },

    review: {
      title: 'ግምገማ',
      intro: 'የተጫነው ሁሉ እዚህ እንደ ረቂቅ ይደርሳል። አንድ ሰው አንብቦ እስኪያትመው ድረስ ምንም ወደ ተማሪ አይደርስም።',
      working: 'ወረፋው በመነበብ ላይ…',
      couldNotLoad: 'ወረፋው ሊነበብ አልቻለም። ምንም አልተለወጠም — እንደገና ይሞክሩ።',

      draft: 'ረቂቆች',
      inReview: 'ገምጋሚ በመጠበቅ ላይ',
      published: 'የታተሙ',
      retired: 'የተነሱ',
      countsFrom: 'በባንኩ ውስጥ ባሉ ሁሉም ፕሮግራሞች ተቆጥሯል',

      ready: 'ለማተም ዝግጁ',
      notReady: (count: number) => `${count} መስተካከል ያለባቸው ነገሮች`,
      andMore: (count: number) => `${count} ተጨማሪ ረቂቆች አልታዩም`,
      noDrafts: 'ረቂቅ የለም። የተጫነው ሁሉ ተይዟል።',

      sendToReview: 'ወደ ግምገማ ላክ',
      sending: 'በመላክ ላይ…',
      sentToReview: 'ተልኳል። አሁን ገምጋሚ በመጠበቅ ላይ ነው።',

      nothingWaiting: 'ገምጋሚ የሚጠብቅ ምንም የለም።',
      reviewing: 'እርስዎን በመጠበቅ ላይ',
      author: 'የጻፈው',
      bounced: 'ቀደም ብሎ ተመልሷል',
      publish: 'አትመው',
      publishing: 'በማተም ላይ…',
      published2: 'ታትሟል። ተማሪዎች አሁን ማየት ይችላሉ።',
      bounce: 'መልሰው ላኩት',
      bouncing: 'በመመለስ ላይ…',
      bounceLabel: 'ምን መስተካከል አለበት — ጸሐፊው ይህን ያነባል',
      bouncePlaceholder: 'አማራጭ ሐም ትክክል ነው፣ እና የሐሳብ መስመሩ ጥያቄውን ይደግማል።',
      bounceTooShort: 'ምን መስተካከል እንዳለበት ይጻፉ — በጣም አጭር ማስታወሻ ጸሐፊውን ግራ ያጋባል።',
      bounced2: 'ወደ ጸሐፊው ተመልሷል።',
      cannotPublish: 'ይህ ገና ሊታተም አይችልም፦',
      topicUnweighted: 'ርዕሱ ክብደት የለውም',

      whichCorrect: 'የትኛው መልስ ትክክል ነው፣ እና ሌሎቹ ለምን አይደሉም',
      whyWrongPlaceholder: 'ይህን ለምን እንደሚመርጡት፣ እና ምን እንደሚስተው።',
      whyWrongFor: (label: string) => `አማራጭ ${label} ለምን ስህተት እንደሆነ`,
      conceptLine: 'ማስታወስ ያለበት አንድ ነገር',
      conceptPlaceholder: 'በጠቅላላ መጠን ውስጥ ያለው ተጨማሪ እሴት ታክስ በ×15/115 ይወጣል።',
      conceptHint: 'አንድ ዓረፍተ ነገር። ሁለት ሁለተኛ ማብራሪያ ነው፣ የመጀመሪያውም መነበብ ያቆማል።',
      explanation: 'ማብራሪያው',
      explanationPlaceholder: 'ትክክለኛውን መልስ ትክክል የሚያደርገው ምንድን ነው፣ በጥቂት ዓረፍተ ነገሮች።',
      stepsLabel: 'አሠራሩ፣ በደረጃ',
      stepPlaceholder: 'የሚቀንስ መሠረት = ወጪ − ቀሪ ዋጋ',
      stepNumber: (n: number) => `ደረጃ ${n}`,
      formulaPlaceholder: 'ለምሳሌ 620,000 − 20,000 = 600,000',
      formulaFor: (n: number) => `የደረጃ ${n} ቀመር`,
      addStep: 'ደረጃ ጨምር',
      removeStep: 'አስወግድ',
      lastStepHint: (label: string) => `የመጨረሻው ደረጃ መልሱን መጥቀስ አለበት — "… → መልስ ${label}"።`,
      timeLimit: 'የጊዜ ገደብ፣ በሰከንድ',
      timeLimitHint: 'ከ15 እስከ 600። ተማሪው ከመለሰ በኋላ የሚያየውን የፍጥነት መስመር ይወስናል።',
      save: 'ለውጦችን አስቀምጥ',
      saving: 'በማስቀመጥ ላይ…',
      savedChanges: 'ተቀምጧል።',
      nothingChanged: 'እስካሁን ምንም አልተለወጠም።',
      couldNotSave: 'አልተቀመጠም። ምንም አልተለወጠም — እንደገና ይሞክሩ።',
      couldNotAct: 'አልተሳካም። ምንም አልተለወጠም — እንደገና ይሞክሩ።',
    },

    topicWeights: 'የርዕስ ክብደቶች',
    recompute: 'ከመጠባበቂያው እንደገና አስላ',
    override: 'ሻር',
    backToBank: 'ወደ መጠባበቂያው ተመለስ',
    setByReviewer: 'በገምጋሚ የተቀመጠ',
    noProgramme: 'ገና የታተመ የትምህርት ዘርፍ የለም።',
    weightingProgramme: 'ክብደት እየተሰጠው ያለው',
    switchProgramme: 'ክብደት የሚሰጠው የትምህርት ዘርፍ',
    weightsScope: (name: string) =>
      `እነዚህ ክብደቶች ለ${name} የሚዘጋጀውን እያንዳንዱን የሙከራ ወረቀት ይቀርጻሉ፣ ከዚያ ውጪ ምንም አይነኩም።`,
    publishedBankSays: (published: number, derived: number) =>
      `${published} ታትሟል · መጠባበቂያው ${derived}% ይላል`,
    weightLabel: (topic: string) => `የ${topic} ክብደት፣ ሙሉ በመቶ`,
    reasonLabel: (topic: string) => `${topic} ለምን እንደተሻረ`,
    reasonPlaceholder: 'ባለፉት ፈተናዎች ከመጠባበቂያው በላይ ይሰጡታል።',
    balanced: 'ተመጣጥኗል',
    withdrawTitle: (stableId: string) => `${stableId}ን ያውጡ?`,
    withdrawIntro:
      'ጥያቄው መቅረብ ያቆማል እና ወደ አዲስ ወረቀቶች መመረጥ ያቆማል። አይሰረዝም — የተማሪዎች ታሪክ አሁንም ወደ እውነተኛ ነገር ይጠቁማል።',
    withdrawIt: 'አውጣው',
    sayWhyFirst: 'መጀመሪያ ምክንያቱን ይግለጹ',
    withdrawReasonLabel: 'ለምን እየወጣ ነው?',
    withdrawReasonPlaceholder: 'ምርጫ ለ ደግሞ ትክክል ነው።',
    notKnown: 'አይታወቅም',
    attemptsRecorded: 'የተመዘገቡ ሙከራዎች',
    attemptsNote: 'እንዳሉ ይቀመጣሉ። ያለፈ መልስ እንደነበረ ይቆያል።',
    sittingsInProgress: 'በሂደት ላይ ያሉ ፈተናዎች',
    sittingsNote: 'አሁን በሰዓት በተወሰነ ፈተና ላይ ያሉ ተማሪዎች፣ ይህ ጥያቄ በወረቀታቸው ላይ ነው።',
    readinessFigures: 'የተማሪዎች የዝግጁነት አኃዞች',
    readinessNote: 'ዝግጁነታቸው በከፊል በዚህ ጥያቄ ላይ ይመሰረታል።',
  },

  provider: {
    nav: { activity: 'እንቅስቃሴ', health: 'ጤንነት' },

    activity: {
      title: 'እንቅስቃሴ',
      intro: 'የተከሰተው ሁሉ፣ አዲሱ መጀመሪያ — የሠራተኞች እርምጃዎች፣ መግቢያዎች፣ ክፍያዎች፣ ልምምድ እና የሙከራ ፈተናዎች፣ በአንድ ዝርዝር።',
      working: 'መዝገቡ በመነበብ ላይ…',
      couldNotLoad: 'እንቅስቃሴው ሊነበብ አልቻለም። ምንም አልጠፋም — እንደገና ይሞክሩ።',
      empty: 'በዚህ አገልጋይ ላይ እስካሁን ምንም አልተከሰተም።',
      more: 'የቀደሙትን አሳይ',
      loadingMore: 'በማንበብ ላይ…',
      end: 'መዝገቡ ይህ ብቻ ነው።',

      all: 'ሁሉም',
      kindStaff: 'የሠራተኛ እርምጃዎች',
      kindSignin: 'መግቢያዎች',
      kindSignout: 'መውጫዎች',
      kindPayment: 'ክፍያዎች',
      kindPractice: 'ልምምድ',
      kindExam: 'የሙከራ ፈተናዎች',

      staffTag: 'ሠራተኛ',
      counted: (shown: number) => `${shown} ክስተቶች ታይተዋል`,
      scanned: (staff: number, signins: number, payments: number, attempts: number) =>
        `ከ${staff} የሠራተኛ እርምጃዎች፣ ${signins} ክፍለ ጊዜዎች፣ ${payments} ክፍያዎች እና ${attempts} ሙከራዎች የተነበበ`,
    },

    health: {
      title: 'ጤንነት',
      intro: 'ይህ ገጽ በሚጠይቅበት ጊዜ ሁሉ አሁን ይለካል። እዚህ ምንም አልተከማቸም።',
      working: 'በመመልከት ላይ…',
      couldNotLoad: 'የጤንነት ምርመራው አልመለሰም። ያ ራሱ የሚታወቅ ነገር ነው — እንደገና ይሞክሩ።',

      live: 'ቀጥታ',
      lastChecked: (clock: string) => `የተመለከተው ${clock}`,
      nextIn: (seconds: number) => `ቀጣይ በ${seconds}ሰ`,
      pause: 'አቁም',
      resume: 'ቀጥል',
      recent: (count: number) => `የመጨረሻዎቹ ${count} ምርመራዎች`,

      database: 'ዳታቤዝ',
      api: 'ኤፒአይ',
      web: 'የፊት ገጽ',
      security: 'ደህንነት',
      vps: 'አገልጋይ',
      sms: 'ኤስኤምኤስ',

      ok: 'እየሠራ ነው',
      degraded: 'መታየት አለበት',
      down: 'አይመልስም',
      notConfigured: 'አልተዘጋጀም',

      allWell: 'ሁሉም እየመለሰ ነው።',
      somethingUp: 'የሚታይ ነገር አለ።',
      somethingDown: 'የማይመልስ ነገር አለ።',
    },
  },

  error: {
    didNotLoad: 'አልተጫነም',
    routeBody: (digest: string) =>
      `የመለሱት ምንም አልጠፋም — ስራዎ በሂደት ላይ ይቀመጣል። እንደገና ይሞክሩ፣ ` +
      `ከቀጠለም ለድጋፍ ይንገሩ${digest ? ` እና ${digest} ይጥቀሱ` : ''}።`,
    generic: 'ያልጠበቅነው ነገር ተከሰተ። እንደገና ይሞክሩ።',
  },
};
