/**
 * The demo question bank, for local testing only.
 *
 * **This content is invented and it is not exam content.** It lives under the
 * `local-dev` field and nowhere else, so it can never be mistaken for the three
 * launch programmes — those are T-212's job and are filled from reviewed
 * spreadsheets, not from a TypeScript file.
 *
 * It exists because the product could not be *tried* without it. Three questions
 * in one topic cannot demonstrate the free-question wall (ten distinct
 * questions), cannot fill a per-topic progress breakdown, and cannot build a
 * mock paper. Somebody clicking through the product to judge the design has to
 * be able to reach every screen, and reaching them needs a bank.
 *
 * Twenty questions across four weighted topics: enough to walk past the wall,
 * enough for a four-row readiness table, enough to sample a short paper from.
 * Every one of them goes through `gateBlockers` unchanged — the same pure
 * function the publish endpoint runs — so the demo bank cannot contain anything
 * the real bank would refuse.
 */

export interface Fixture {
  stableId: string;
  /** Which of `TOPICS` this belongs to. */
  topic: string;
  qType: 'CONCEPT' | 'CALCULATION';
  stem: string;
  codeBlock?: string;
  /** One sentence. The gate refuses two. */
  conceptLine: string;
  /** CONCEPT only — the gate requires it, and it is the reward for a wrong answer. */
  explanation?: string;
  timeLimitSec: number;
  options: { label: 'A' | 'B' | 'C' | 'D'; text: string; isCorrect?: boolean; whyWrong?: string }[];
  /** CALCULATION only. The last step must name the answer letter. */
  steps?: { stepNo: number; text: string; formula?: string }[];
}

/**
 * Four topics, weighted to 100.
 *
 * The weights are not decoration: the exam builder samples against them, the
 * readiness screen ranks focus topics by them, and a topic with no weight is
 * refused by the publish gate. Uneven on purpose, so a screen that treats all
 * topics as equal is visibly wrong.
 */
export const TOPICS: { slug: string; name: string; course: string; weightPct: number }[] = [
  {
    slug: 'processes',
    name: 'Processes and Scheduling',
    course: 'Operating Systems',
    weightPct: 30,
  },
  { slug: 'depreciation', name: 'Depreciation', course: 'Financial Accounting', weightPct: 25 },
  { slug: 'study-design', name: 'Study Design', course: 'Epidemiology', weightPct: 25 },
  { slug: 'taxation', name: 'Value Added Tax', course: 'Taxation', weightPct: 20 },
];

export const FIXTURES: Fixture[] = [
  // ---- Operating Systems · Processes and Scheduling -----------------------
  {
    stableId: 'DEV-OS-1',
    topic: 'processes',
    qType: 'CONCEPT',
    stem: 'A running process makes a blocking read() call on a file that is not yet in memory. Which state does the process enter next?',
    conceptLine: 'A process waiting on I/O is blocked, not ready.',
    explanation:
      'Ready means waiting only for the CPU. This process is waiting for the disk, which the scheduler cannot supply, so it leaves the run queue entirely until the I/O completes and the kernel wakes it.',
    timeLimitSec: 90,
    options: [
      {
        label: 'A',
        text: 'Ready — it waits for the scheduler to pick it again',
        whyWrong: 'Ready means it could run right now; this one cannot until the disk answers.',
      },
      { label: 'B', text: 'Blocked — it waits for the I/O to complete', isCorrect: true },
      {
        label: 'C',
        text: 'Terminated — the kernel ends it and restarts it after the read',
        whyWrong: 'Termination discards the process; a blocking read suspends it instead.',
      },
      {
        label: 'D',
        text: 'New — it is re-created once the file is loaded',
        whyWrong:
          'New is the state before admission; an already-running process never returns to it.',
      },
    ],
  },
  {
    stableId: 'DEV-OS-2',
    topic: 'processes',
    qType: 'CONCEPT',
    stem: 'Two processes each hold one resource and each wait for the resource the other holds. Which condition does this describe?',
    conceptLine: 'Circular wait is the condition that turns mutual holding into deadlock.',
    explanation:
      'Holding one resource while waiting for another is hold-and-wait; the cycle between the two waits is circular wait, which is the condition that makes the deadlock permanent.',
    timeLimitSec: 90,
    options: [
      {
        label: 'A',
        text: 'Starvation',
        whyWrong:
          'Starvation is a process that could run but never gets scheduled; these two cannot run at all.',
      },
      { label: 'B', text: 'Circular wait', isCorrect: true },
      {
        label: 'C',
        text: 'Race condition',
        whyWrong:
          'A race is about ordering changing the result; nothing here proceeds in any order.',
      },
      {
        label: 'D',
        text: 'Thrashing',
        whyWrong: 'Thrashing is paging spending all the time swapping, which is a memory problem.',
      },
    ],
  },
  {
    stableId: 'DEV-OS-3',
    topic: 'processes',
    qType: 'CALCULATION',
    stem: 'Three processes arrive at time 0 with CPU bursts of 6 ms, 2 ms and 4 ms. Under shortest-job-first, what is the average waiting time?',
    conceptLine:
      'Shortest-job-first orders by burst length, so waiting time accumulates shortest first.',
    timeLimitSec: 180,
    options: [
      {
        label: 'A',
        text: '4.0 ms',
        whyWrong: 'That is the average if the processes run in arrival order rather than by burst.',
      },
      { label: 'B', text: '2.67 ms', isCorrect: true },
      {
        label: 'C',
        text: '6.0 ms',
        whyWrong: 'That is the average turnaround time, which includes each burst itself.',
      },
      {
        label: 'D',
        text: '12.0 ms',
        whyWrong: 'That is the total of the waits, not the average of them.',
      },
    ],
    steps: [
      { stepNo: 1, text: 'Order by burst length.', formula: '2, 4, 6' },
      {
        stepNo: 2,
        text: 'Each process waits for everything scheduled before it.',
        formula: '0, 2, 6',
      },
      { stepNo: 3, text: 'Average the three waits.', formula: '(0 + 2 + 6) ÷ 3' },
      { stepNo: 4, text: 'Which gives 2.67 ms → answer B.' },
    ],
  },
  {
    stableId: 'DEV-OS-4',
    topic: 'processes',
    qType: 'CONCEPT',
    stem: 'What does this shell line do to the process it starts?',
    codeBlock: 'nohup ./report.sh > out.log 2>&1 &',
    conceptLine:
      'Detaching a process from the terminal lets it survive the session that started it.',
    explanation:
      'nohup makes the process ignore the hangup signal, the redirections send both output streams to a file rather than the terminal, and the ampersand puts it in the background — together they let it keep running after the terminal closes.',
    timeLimitSec: 120,
    options: [
      {
        label: 'A',
        text: 'Runs it in the background and keeps it alive after the terminal closes',
        isCorrect: true,
      },
      {
        label: 'B',
        text: 'Runs it with higher priority than other processes',
        whyWrong: 'Priority is changed with nice or renice; nothing here touches it.',
      },
      {
        label: 'C',
        text: 'Restarts it automatically if it exits with an error',
        whyWrong: 'Nothing here supervises the process; it runs once.',
      },
      {
        label: 'D',
        text: 'Runs it as a different user',
        whyWrong: 'Changing user needs su or sudo, neither of which appears here.',
      },
    ],
  },
  {
    stableId: 'DEV-OS-5',
    topic: 'processes',
    qType: 'CONCEPT',
    stem: 'A scheduler gives every process a fixed slice of CPU time in turn. Which algorithm is this?',
    conceptLine: 'A fixed time slice taken in turn is round robin.',
    explanation:
      'Round robin is defined by its quantum: every process gets the same slice and is put back at the end of the queue when it expires, which is what makes it fair and preemptive.',
    timeLimitSec: 60,
    options: [
      {
        label: 'A',
        text: 'First-come first-served',
        whyWrong: 'That runs each process to completion, with no slice and no preemption.',
      },
      {
        label: 'B',
        text: 'Shortest-job-first',
        whyWrong: 'That orders by burst length; it does not divide time into equal slices.',
      },
      { label: 'C', text: 'Round robin', isCorrect: true },
      {
        label: 'D',
        text: 'Priority scheduling',
        whyWrong: 'That picks by priority value, which may give one process the CPU indefinitely.',
      },
    ],
  },

  // ---- Financial Accounting · Depreciation --------------------------------
  {
    stableId: 'DEV-ACC-1',
    topic: 'depreciation',
    qType: 'CALCULATION',
    stem: 'Equipment costs Br 620,000 with a residual value of Br 20,000 and a useful life of 4 years. What is the annual straight-line depreciation?',
    conceptLine:
      'Straight-line depreciation spreads cost minus residual value evenly across the useful life.',
    timeLimitSec: 180,
    options: [
      {
        label: 'A',
        text: 'Br 155,000',
        whyWrong:
          'That divides the full cost by 4 — tempting if you forget to remove the residual value first.',
      },
      { label: 'B', text: 'Br 150,000', isCorrect: true },
      {
        label: 'C',
        text: 'Br 120,000',
        whyWrong: 'That assumes a 5-year life rather than the 4 the question states.',
      },
      {
        label: 'D',
        text: 'Br 600,000',
        whyWrong: 'That stops at the depreciable base — the first step, not the answer.',
      },
    ],
    steps: [
      {
        stepNo: 1,
        text: 'Depreciable base = cost − residual value.',
        formula: '620,000 − 20,000 = 600,000',
      },
      { stepNo: 2, text: 'Divide by the useful life.', formula: '600,000 ÷ 4' },
      { stepNo: 3, text: 'Which gives 150,000 → answer B.' },
    ],
  },
  {
    stableId: 'DEV-ACC-2',
    topic: 'depreciation',
    qType: 'CALCULATION',
    stem: 'A vehicle costing Br 800,000 is depreciated at 25% reducing balance. What is the depreciation charge in the second year?',
    conceptLine: 'Reducing balance applies the rate to what is left, not to the original cost.',
    timeLimitSec: 180,
    options: [
      {
        label: 'A',
        text: 'Br 200,000',
        whyWrong: 'That is the first-year charge; the second year works from the reduced balance.',
      },
      { label: 'B', text: 'Br 150,000', isCorrect: true },
      {
        label: 'C',
        text: 'Br 112,500',
        whyWrong: 'That is the third-year charge — one year too far along.',
      },
      {
        label: 'D',
        text: 'Br 400,000',
        whyWrong: 'That is half the cost, which no reducing-balance step produces.',
      },
    ],
    steps: [
      {
        stepNo: 1,
        text: 'First-year charge on the full cost.',
        formula: '800,000 × 25% = 200,000',
      },
      {
        stepNo: 2,
        text: 'Carrying amount at the start of year two.',
        formula: '800,000 − 200,000 = 600,000',
      },
      { stepNo: 3, text: 'Apply the rate to that balance.', formula: '600,000 × 25%' },
      { stepNo: 4, text: 'Which gives 150,000 → answer B.' },
    ],
  },
  {
    stableId: 'DEV-ACC-3',
    topic: 'depreciation',
    qType: 'CONCEPT',
    stem: 'Which statement about accumulated depreciation is correct?',
    conceptLine: 'Accumulated depreciation is a contra-asset account, not an expense and not cash.',
    explanation:
      'It is deducted from the asset on the balance sheet to give the carrying amount. The year charge is the expense that goes to profit or loss; the accumulated balance is the running total of every such charge.',
    timeLimitSec: 90,
    options: [
      {
        label: 'A',
        text: 'It is reported in profit or loss for the period',
        whyWrong:
          'The periodic charge goes there; the accumulated balance stays on the balance sheet.',
      },
      {
        label: 'B',
        text: 'It is a fund of cash set aside to replace the asset',
        whyWrong: 'No cash moves — depreciation is an allocation of cost already spent.',
      },
      {
        label: 'C',
        text: 'It is deducted from the asset to give its carrying amount',
        isCorrect: true,
      },
      {
        label: 'D',
        text: 'It is reset to zero at the end of each financial year',
        whyWrong:
          'Expense accounts close annually; this one accumulates for the life of the asset.',
      },
    ],
  },
  {
    stableId: 'DEV-ACC-4',
    topic: 'depreciation',
    qType: 'CALCULATION',
    stem: 'Machinery bought for Br 450,000 has accumulated depreciation of Br 300,000 and is sold for Br 120,000. What is the result on disposal?',
    conceptLine: 'A disposal compares proceeds against the carrying amount, not against cost.',
    timeLimitSec: 180,
    options: [
      {
        label: 'A',
        text: 'A loss of Br 30,000',
        isCorrect: true,
      },
      {
        label: 'B',
        text: 'A profit of Br 120,000',
        whyWrong:
          'That treats the whole proceeds as gain and ignores the carrying amount given up.',
      },
      {
        label: 'C',
        text: 'A loss of Br 330,000',
        whyWrong: 'That compares the proceeds with cost rather than with the carrying amount.',
      },
      {
        label: 'D',
        text: 'Neither a profit nor a loss',
        whyWrong: 'The two figures differ, so a difference has to go to profit or loss.',
      },
    ],
    steps: [
      {
        stepNo: 1,
        text: 'Carrying amount = cost − accumulated depreciation.',
        formula: '450,000 − 300,000 = 150,000',
      },
      { stepNo: 2, text: 'Compare the proceeds with it.', formula: '120,000 − 150,000' },
      { stepNo: 3, text: 'Which is a loss of 30,000 → answer A.' },
    ],
  },
  {
    stableId: 'DEV-ACC-5',
    topic: 'depreciation',
    qType: 'CONCEPT',
    stem: 'A company changes the estimated useful life of an asset from 10 years to 6. How is this treated?',
    conceptLine: 'A change in estimate is applied forward, never by restating past years.',
    explanation:
      'The remaining carrying amount is spread over the revised remaining life from the current period onwards. Prior periods are left alone because the earlier figures were the best estimate available when they were reported.',
    timeLimitSec: 90,
    options: [
      {
        label: 'A',
        text: 'Prior years are restated as though the new life had always applied',
        whyWrong: 'Restatement is for errors and for changes in policy, not for revised estimates.',
      },
      {
        label: 'B',
        text: 'The remaining carrying amount is spread over the revised remaining life',
        isCorrect: true,
      },
      {
        label: 'C',
        text: 'The difference is charged in full in the year of the change',
        whyWrong: 'That would be an impairment; a shorter life changes the future charge instead.',
      },
      {
        label: 'D',
        text: 'The asset is written off and re-recognised at fair value',
        whyWrong: 'Nothing about the asset has been disposed of or revalued.',
      },
    ],
  },

  // ---- Epidemiology · Study Design ----------------------------------------
  {
    stableId: 'DEV-PH-1',
    topic: 'study-design',
    qType: 'CONCEPT',
    stem: 'An investigator enrols people with lung cancer and matched people without it, then compares their past smoking. What study design is this?',
    conceptLine:
      'A case-control study starts from the outcome and looks backwards for the exposure.',
    explanation:
      'The groups are defined by whether they already have the disease, and the exposure is measured retrospectively. Starting from disease status and looking back at smoking history is the defining feature of a case-control design.',
    timeLimitSec: 90,
    options: [
      {
        label: 'A',
        text: 'Cohort study',
        whyWrong:
          'A cohort also compares two groups, but it starts from the exposure and follows people forward.',
      },
      {
        label: 'B',
        text: 'Cross-sectional study',
        whyWrong:
          'Cross-sectional measures exposure and disease at one moment; here the smoking is firmly in the past.',
      },
      { label: 'C', text: 'Case-control study', isCorrect: true },
      {
        label: 'D',
        text: 'Randomised controlled trial',
        whyWrong:
          'In a trial the investigator assigns the exposure; nobody assigned anyone to smoke.',
      },
    ],
  },
  {
    stableId: 'DEV-PH-2',
    topic: 'study-design',
    qType: 'CONCEPT',
    stem: 'Which measure of association can a case-control study produce directly?',
    conceptLine: 'A case-control study yields an odds ratio because it cannot observe incidence.',
    explanation:
      'Cases and controls are sampled by outcome rather than followed over time, so the study never sees how many people in the population developed the disease. Without that denominator there is no risk to compare, and the odds ratio is what remains.',
    timeLimitSec: 90,
    options: [
      {
        label: 'A',
        text: 'Relative risk',
        whyWrong:
          'Relative risk needs incidence in each exposure group, which this design never observes.',
      },
      { label: 'B', text: 'Odds ratio', isCorrect: true },
      {
        label: 'C',
        text: 'Attributable risk',
        whyWrong:
          'That is a difference between two incidences, and neither incidence is available here.',
      },
      {
        label: 'D',
        text: 'Incidence rate',
        whyWrong:
          'Incidence needs person-time in a followed population; cases were sampled by outcome instead.',
      },
    ],
  },
  {
    stableId: 'DEV-PH-3',
    topic: 'study-design',
    qType: 'CALCULATION',
    stem: 'In a cohort study, 40 of 200 exposed people develop the disease and 20 of 400 unexposed do. What is the relative risk?',
    conceptLine:
      'Relative risk is the incidence in the exposed divided by the incidence in the unexposed.',
    timeLimitSec: 180,
    options: [
      {
        label: 'A',
        text: '2.0',
        whyWrong: 'That is the ratio of the case counts, which ignores the different group sizes.',
      },
      { label: 'B', text: '4.0', isCorrect: true },
      {
        label: 'C',
        text: '0.25',
        whyWrong: 'That is the ratio the other way round — unexposed over exposed.',
      },
      {
        label: 'D',
        text: '0.15',
        whyWrong: 'That is the difference between the two risks, not their ratio.',
      },
    ],
    steps: [
      { stepNo: 1, text: 'Risk in the exposed group.', formula: '40 ÷ 200 = 0.20' },
      { stepNo: 2, text: 'Risk in the unexposed group.', formula: '20 ÷ 400 = 0.05' },
      { stepNo: 3, text: 'Divide one by the other.', formula: '0.20 ÷ 0.05' },
      { stepNo: 4, text: 'Which gives 4.0 → answer B.' },
    ],
  },
  {
    stableId: 'DEV-PH-4',
    topic: 'study-design',
    qType: 'CONCEPT',
    stem: 'A screening test correctly identifies 95 of every 100 people who have a disease. Which property is being described?',
    conceptLine:
      'Sensitivity is the proportion of people with the disease that a test correctly identifies.',
    explanation:
      'Sensitivity is measured only among people who actually have the condition. How the test performs among healthy people is specificity, and the two are answered by different columns of the same table.',
    timeLimitSec: 60,
    options: [
      { label: 'A', text: 'Sensitivity', isCorrect: true },
      {
        label: 'B',
        text: 'Specificity',
        whyWrong:
          'Specificity counts the healthy people correctly cleared, not the sick correctly found.',
      },
      {
        label: 'C',
        text: 'Positive predictive value',
        whyWrong:
          'That answers the reverse question: given a positive result, how likely is the disease.',
      },
      {
        label: 'D',
        text: 'Prevalence',
        whyWrong: 'Prevalence describes the population, not the performance of the test.',
      },
    ],
  },
  {
    stableId: 'DEV-PH-5',
    topic: 'study-design',
    qType: 'CONCEPT',
    stem: 'Why are participants and assessors blinded in a randomised controlled trial?',
    conceptLine: 'Blinding protects the results from expectation changing behaviour or judgement.',
    explanation:
      'Randomisation balances the groups at the start; blinding keeps them comparable afterwards, by stopping knowledge of the allocation from changing how people report symptoms or how assessors record outcomes.',
    timeLimitSec: 90,
    options: [
      {
        label: 'A',
        text: 'To make the two groups similar at the start of the trial',
        whyWrong: 'That is what randomisation does, and it happens before blinding matters.',
      },
      {
        label: 'B',
        text: 'To stop expectation influencing reported and recorded outcomes',
        isCorrect: true,
      },
      {
        label: 'C',
        text: 'To increase the number of participants who complete the trial',
        whyWrong:
          'Retention is a separate problem, addressed by follow-up rather than by blinding.',
      },
      {
        label: 'D',
        text: 'To remove the need for a control group',
        whyWrong: 'Blinding needs a control group to be blinded against; it cannot replace one.',
      },
    ],
  },

  // ---- Taxation · Value Added Tax -----------------------------------------
  {
    stableId: 'DEV-TAX-1',
    topic: 'taxation',
    qType: 'CALCULATION',
    stem: 'A retailer sells goods for Br 1,150,000 VAT inclusive (15%). How much VAT is contained in that amount?',
    conceptLine: 'VAT inside a gross amount is extracted with ×15/115.',
    timeLimitSec: 180,
    options: [
      {
        label: 'A',
        text: 'Br 172,500',
        whyWrong: 'That is 15% of the gross figure, which double-counts the tax already inside it.',
      },
      { label: 'B', text: 'Br 150,000', isCorrect: true },
      { label: 'C', text: 'Br 15,000', whyWrong: 'Off by a factor of ten.' },
      {
        label: 'D',
        text: 'Br 1,000,000',
        whyWrong: 'That is the net amount, not the VAT contained in the gross.',
      },
    ],
    steps: [
      { stepNo: 1, text: 'The amount is VAT-inclusive, so the tax is already inside it.' },
      { stepNo: 2, text: 'Extract the tax fraction.', formula: 'gross × 15/115' },
      { stepNo: 3, text: 'Apply it to the figure given.', formula: '1,150,000 × 15/115' },
      { stepNo: 4, text: 'Which gives 150,000 → answer B.' },
    ],
  },
  {
    stableId: 'DEV-TAX-2',
    topic: 'taxation',
    qType: 'CALCULATION',
    stem: 'A business has output VAT of Br 92,000 and input VAT of Br 57,000 for the period. What is payable to the authority?',
    conceptLine: 'VAT payable is output tax less the input tax the business may reclaim.',
    timeLimitSec: 120,
    options: [
      { label: 'A', text: 'Br 35,000', isCorrect: true },
      {
        label: 'B',
        text: 'Br 149,000',
        whyWrong: 'That adds the two figures; input tax is deducted, not added.',
      },
      {
        label: 'C',
        text: 'Br 92,000',
        whyWrong: 'That ignores the input tax the business is entitled to reclaim.',
      },
      {
        label: 'D',
        text: 'Br 57,000',
        whyWrong: 'That is the reclaimable input tax on its own, not the net position.',
      },
    ],
    steps: [
      { stepNo: 1, text: 'VAT payable is output tax minus input tax.', formula: '92,000 − 57,000' },
      { stepNo: 2, text: 'Which gives 35,000 → answer A.' },
    ],
  },
  {
    stableId: 'DEV-TAX-3',
    topic: 'taxation',
    qType: 'CONCEPT',
    stem: 'What is the difference between a zero-rated supply and an exempt supply?',
    conceptLine: 'Zero-rating allows input tax to be reclaimed; exemption does not.',
    explanation:
      'Both mean no VAT is charged to the customer, so they look the same on an invoice. The difference is on the supplier side: a zero-rated business is still making taxable supplies and can reclaim its input tax, while an exempt business cannot and absorbs that tax as a cost.',
    timeLimitSec: 120,
    options: [
      {
        label: 'A',
        text: 'Zero-rated supplies are taxed at a lower rate; exempt supplies are not taxed at all',
        whyWrong:
          'Zero-rated is taxed at 0%, not at a reduced positive rate — neither charges the customer.',
      },
      {
        label: 'B',
        text: 'Input tax is reclaimable on zero-rated supplies but not on exempt ones',
        isCorrect: true,
      },
      {
        label: 'C',
        text: 'Exempt supplies must be registered for VAT; zero-rated supplies need not be',
        whyWrong:
          'Registration follows turnover in taxable supplies, and it is zero-rated ones that count towards it.',
      },
      {
        label: 'D',
        text: 'There is no practical difference between them',
        whyWrong:
          'The reclaim right differs, and for a supplier with large inputs that difference is the whole margin.',
      },
    ],
  },
  {
    stableId: 'DEV-TAX-4',
    topic: 'taxation',
    qType: 'CALCULATION',
    stem: 'A wholesaler quotes Br 40,000 for goods before tax. What does the customer pay including 15% VAT?',
    conceptLine: 'Adding VAT to a net price multiplies it by 1.15.',
    timeLimitSec: 120,
    options: [
      {
        label: 'A',
        text: 'Br 46,000',
        isCorrect: true,
      },
      {
        label: 'B',
        text: 'Br 34,783',
        whyWrong: 'That extracts VAT from 40,000 as though the quote already included it.',
      },
      {
        label: 'C',
        text: 'Br 6,000',
        whyWrong: 'That is the VAT alone, not what the customer hands over.',
      },
      {
        label: 'D',
        text: 'Br 45,000',
        whyWrong: 'That applies 12.5% rather than the 15% the question states.',
      },
    ],
    steps: [
      {
        stepNo: 1,
        text: 'The quote is a net price, so the tax is added on top.',
        formula: '40,000 × 15% = 6,000',
      },
      { stepNo: 2, text: 'Add it to the net price.', formula: '40,000 + 6,000' },
      { stepNo: 3, text: 'Which gives 46,000 → answer A.' },
    ],
  },
  {
    stableId: 'DEV-TAX-5',
    topic: 'taxation',
    qType: 'CONCEPT',
    stem: 'Who ultimately bears the cost of VAT on a normal retail sale?',
    conceptLine: 'VAT is collected by businesses but borne by the final consumer.',
    explanation:
      'Each business in the chain charges tax on its sales and reclaims the tax on its purchases, so the net cost to it is nothing. Only the final consumer, who cannot reclaim, is left carrying the tax.',
    timeLimitSec: 60,
    options: [
      {
        label: 'A',
        text: 'The manufacturer',
        whyWrong: 'The manufacturer reclaims its input tax and passes its output tax on.',
      },
      {
        label: 'B',
        text: 'The retailer',
        whyWrong:
          'The retailer collects the tax and remits it; the reclaim leaves it no worse off.',
      },
      { label: 'C', text: 'The final consumer', isCorrect: true },
      {
        label: 'D',
        text: 'The tax authority',
        whyWrong: 'The authority receives the tax rather than bearing it.',
      },
    ],
  },
];
