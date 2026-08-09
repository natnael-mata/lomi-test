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

  practice: {
    startPractising: 'Start practising',
    doneForToday: 'Done for today',
    freeLimit: 'That is your ten free questions',
    seePlans: 'See the plans',
    nextQuestion: 'Next question',
    practiseTopic: (topic: string) => `Practise ${topic}`,
    whyRanked:
      "Ranked by how many marks each topic cost — a topic's share of past papers against how much of it you missed, not the number of misses.",
  },

  exam: {
    title: 'Mock exam',
    intro: '100 questions in 3 hours, sat once through. Nothing is marked until you submit.',
    start: 'Start the mock',
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
    unansweredInMocks: (count: number) =>
      `${count} mock question${count === 1 ? '' : 's'} ran out of time and ` +
      `${count === 1 ? 'is' : 'are'} not counted above.`,
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
    telebirrHow: 'A request comes to your phone. Approve it with your PIN.',
    cbebirr: 'CBE Birr',
    cbebirrHow: 'A request comes to your phone. Approve it with your PIN.',
    chapa: 'Card or another wallet',
    chapaHow: 'Opens Chapa, where you can pay the way you prefer.',
    bank: 'Bank transfer',
    bankHow: 'Transfer from any bank, then paste the transaction number here.',

    mobileLabel: 'The phone number you pay with',
    mobileHint: 'For example 0911223344.',
    mobileInvalid: 'That does not look like an Ethiopian mobile number. Check it and try again.',
    txRefLabel: 'Transaction number',
    txRefHint: 'The reference on your transfer receipt or SMS.',
    txRefRequired: 'Enter the transaction number from your transfer receipt.',
    txRefTaken:
      'That transaction number has already been sent to us. Support can look it up for you.',

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
    manualPending:
      'Thank you. Someone checks the transfer against the bank statement, usually the same day, ' +
      'and your access starts as soon as it is found.',
    couldNotStart: 'The payment could not be started. Nothing has been charged — try again.',
    unavailable:
      'That way of paying is not available right now. The bank transfer below still works.',
  },

  admin: {
    topicWeights: 'Topic weights',
    recompute: 'Recompute from the bank',
    override: 'Override',
    backToBank: 'Back to the bank',
    setByReviewer: 'Set by a reviewer',
    noProgramme: 'No published programme to weight yet.',
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

  practice: {
    startPractising: 'ልምምድ ጀምር',
    doneForToday: 'ለዛሬ ተጠናቋል',
    freeLimit: 'ያ አስሩ ነጻ ጥያቄዎችዎ ናቸው',
    seePlans: 'እቅዶቹን ይመልከቱ',
    nextQuestion: 'ቀጣይ ጥያቄ',
    practiseTopic: (topic: string) => `${topic}ን ተለማመድ`,
    whyRanked:
      'የተመደበው እያንዳንዱ ርዕስ ባስከተለው ውጤት መጠን ነው — ባለፉት ፈተናዎች ያለው ድርሻ ከስንቱ እንዳመለጠዎት ጋር ተያይዞ፣ በስህተት ብዛት አይደለም።',
  },

  exam: {
    title: 'ሙከራ ፈተና',
    intro: '100 ጥያቄዎች በ3 ሰዓት፣ በአንድ ጊዜ። እስኪያስረክቡ ድረስ ምንም አይታረምም።',
    start: 'ሙከራውን ጀምር',
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
    unansweredInMocks: (count: number) => `${count} የሙከራ ጥያቄ ጊዜው አልቆበታል እና ከላይ አልተቆጠረም።`,
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
    telebirrHow: 'ወደ ስልክዎ ጥያቄ ይመጣል። በፒን ኮድዎ ያጽድቁት።',
    cbebirr: 'ሲቢኢ ብር',
    cbebirrHow: 'ወደ ስልክዎ ጥያቄ ይመጣል። በፒን ኮድዎ ያጽድቁት።',
    chapa: 'ካርድ ወይም ሌላ ዋሌት',
    chapaHow: 'ቻፓን ይከፍታል፣ በሚመርጡት መንገድ መክፈል ይችላሉ።',
    bank: 'የባንክ ዝውውር',
    bankHow: 'ከማንኛውም ባንክ ያዛውሩ፣ ከዚያ የግብይት ቁጥሩን እዚህ ይለጥፉ።',

    mobileLabel: 'የሚከፍሉበት ስልክ ቁጥር',
    mobileHint: 'ለምሳሌ 0911223344።',
    mobileInvalid: 'ይህ የኢትዮጵያ የሞባይል ቁጥር አይመስልም። አረጋግጠው እንደገና ይሞክሩ።',
    txRefLabel: 'የግብይት ቁጥር',
    txRefHint: 'በዝውውር ደረሰኝዎ ወይም በኤስኤምኤስ ላይ ያለው ቁጥር።',
    txRefRequired: 'ከዝውውር ደረሰኝዎ ላይ ያለውን የግብይት ቁጥር ያስገቡ።',
    txRefTaken: 'ይህ የግብይት ቁጥር ቀድሞ ደርሶናል። ድጋፍ ሰጪው ሊፈትሽልዎ ይችላል።',

    pay: 'ክፈል',
    sending: 'በመላክ ላይ…',
    checkYourPhone: (mobile: string) =>
      `የክፍያ ጥያቄ ወደ ${mobile} ተልኳል። በስልክዎ ላይ ያጽድቁት፣ ይህ ገጽ በራሱ ይዘምናል።`,
    stillWaiting: 'አሁንም ክፍያውን በመጠባበቅ ላይ ነን። ካጸደቁት ጥቂት ጊዜ ይስጡት — ይህን ገጽ ቢዘጉትም ምንም አይጠፋም።',
    openingChapa: 'ቻፓ እየተከፈተ ነው…',
    confirmed: 'ሙሉ መዳረሻ አለዎት።',
    accessUntil: (date: string) => `መዳረሻዎ እስከ ${date} ይቆያል።`,
    yourReference: (ref: string) => `የእርስዎ ማመሳከሪያ ${ref} ነው። ይያዙት — ድጋፍ ሰጪው ሊፈትሸው ይችላል።`,
    manualPending:
      'እናመሰግናለን። ዝውውሩን ከባንክ ሪፖርት ጋር የሚያመሳክር ሰው አለ፣ አብዛኛውን ጊዜ በዚያው ቀን፣ ' +
      'እንደተገኘም መዳረሻዎ ወዲያውኑ ይጀምራል።',
    couldNotStart: 'ክፍያው ሊጀመር አልቻለም። ምንም አልተከፈለም — እንደገና ይሞክሩ።',
    unavailable: 'ይህ የመክፈያ መንገድ አሁን አይሰራም። ከታች ያለው የባንክ ዝውውር አሁንም ይሰራል።',
  },

  admin: {
    topicWeights: 'የርዕስ ክብደቶች',
    recompute: 'ከመጠባበቂያው እንደገና አስላ',
    override: 'ሻር',
    backToBank: 'ወደ መጠባበቂያው ተመለስ',
    setByReviewer: 'በገምጋሚ የተቀመጠ',
    noProgramme: 'ገና የታተመ የትምህርት ዘርፍ የለም።',
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

  error: {
    didNotLoad: 'አልተጫነም',
    routeBody: (digest: string) =>
      `የመለሱት ምንም አልጠፋም — ስራዎ በሂደት ላይ ይቀመጣል። እንደገና ይሞክሩ፣ ` +
      `ከቀጠለም ለድጋፍ ይንገሩ${digest ? ` እና ${digest} ይጥቀሱ` : ''}።`,
    generic: 'ያልጠበቅነው ነገር ተከሰተ። እንደገና ይሞክሩ።',
  },
};
