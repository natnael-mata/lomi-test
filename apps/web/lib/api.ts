/**
 * The API client.
 *
 * Everything goes through `/api/*` on this origin, which `next.config.ts`
 * rewrites to the Nest server. The browser never learns the API's real address.
 */

/**
 * The session lives in an httpOnly cookie the API sets (T-112a).
 *
 * **This client stores nothing and reads nothing.** There is deliberately no
 * `sessionToken()` here any more: the browser attaches the cookie to same-origin
 * requests by itself, and a token this code could read would be a token an XSS
 * could read — which was the whole problem.
 *
 * What that buys, precisely: a script injected into this page can still call the
 * API, because the browser attaches the cookie for it too. What it can no longer
 * do is take the token somewhere else and use it for ninety days. The damage
 * stays in the page instead of walking out of the building.
 *
 * The cookie is `SameSite=Lax`, which is what keeps the move from being a
 * downgrade — a cookie is sent automatically where an `Authorization` header
 * never was, so without it this would have traded XSS exposure for CSRF.
 */

/** One row of a coverage breakdown — a subject, or a school year. */
export interface CoverageSlice {
  key: string;
  label: string;
  total: number;
  beaten: number;
  pct: number;
}

/** How much of a track has been beaten, and what it would take to reach 80%. */
export interface CoverageView {
  fieldId: string;
  fieldName: string;
  total: number;
  beaten: number;
  pct: number;
  targetPct: number;
  targetCount: number;
  toTarget: number;
  /** Null when no exam date is set. Rendered as unavailable, never as zero. */
  daysToExam: number | null;
  perDay: number | null;
  /** Null for a university exit exam, which draws on no school year. */
  years: { min: number; max: number } | null;
  bySubject: CoverageSlice[];
  byGrade: CoverageSlice[];
}

export interface BoardRow {
  rank: number;
  displayName: string;
  pct: number;
  beaten: number;
  total: number;
  isYou: boolean;
}

export interface BoardView {
  band: 'junior' | 'senior';
  window: 'week' | 'all';
  rows: BoardRow[];
  you: { rank: number; pct: number; beaten: number; total: number; listed: boolean } | null;
  rankedOverEveryone: true;
}

/** Who this session belongs to. */
export interface Identity {
  userId: string;
  displayName: string;
  staffRole: 'REVIEWER' | 'ADMIN' | 'PROVIDER' | null;
}

/** The paper on offer, and any sitting already under way. */
export interface ExamPreview {
  examName: string;
  totalQuestions: number;
  durationSec: number;
  open: {
    sittingId: string;
    position: number;
    answeredCount: number;
    clock: SittingClock;
  } | null;
}

/** A live session, as the device list shows it. Dates arrive as ISO strings. */
export interface DeviceEntry {
  id: string;
  deviceLabel: string | null;
  lastSeenAt: string;
  signedInAt: string;
  isCurrent: boolean;
}

/** A programme as `/me/fields` returns it. */
export interface FieldOption {
  id: string;
  name: string;
  slug: string;
  chosen: boolean;
  /** Published questions behind it. Zero means listed but not yet practisable. */
  questionCount: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The code the API sends for the cases a UI must branch on. */
  get code(): string | null {
    const body = this.body as { error?: unknown } | null;
    return body && typeof body.error === 'string' ? body.error : null;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    // Same-origin via the `/api/*` rewrite, so the cookie rides along on its
    // own. Stated rather than left to the default, because the default changing
    // would look like an unrelated failure to authenticate.
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      (body as { message?: string } | null)?.message ?? `${response.status} ${response.statusText}`;
    throw new ApiError(response.status, body, message);
  }
  return body as T;
}

/**
 * Whether this failure means "you are not signed in".
 *
 * **A screen that renders 401 as an error is a screen that tells a signed-out
 * student their app is broken.** `/practice` did exactly that: it is the
 * manifest's `start_url`, so somebody opening the installed icon after their
 * session expired met "That did not load" — with a Try again button that could
 * never work, because trying again is not what was missing.
 *
 * A helper rather than a redirect inside `call`, deliberately. The home screen
 * asks about the session on purpose and renders a signed-out state; a client
 * that navigated away by itself would take that decision from every caller,
 * including the ones that have already thought about it.
 */
export function signInRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * The server's own explanation, when it refused rather than failed.
 *
 * **Three screens told somebody nothing was wrong while the API was returning a
 * 403 that said exactly what was.** An admin on `/provider/health` read "The
 * health check did not answer. That is itself worth knowing — try again"; the
 * server had said "This is a staff-only endpoint." A student blocked by their
 * own open mock read "That did not load… try again"; the server had said
 * "Finish or submit your exam before practising."
 *
 * That is worse than a bare error. It denies there is a problem and invites a
 * retry that cannot work — DESIGN.md's rule is that an error says what to do
 * next, and a generic message over a specific refusal fails it twice.
 *
 * Only 403 and 422: those are the statuses where the server has made a
 * *decision* and can say why. A 500 has no explanation worth showing a student,
 * and a 404's message is usually a route name.
 *
 * Found in QA, 2026-08-19.
 */
export function refusalMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status !== 403 && error.status !== 422) return null;
  const body = error.body as { message?: unknown } | null;
  const message = body?.message;
  return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

/** The pre-answer payload. Deliberately carries no answer content (T-106). */
export interface ServedQuestion {
  alreadyAnswered: boolean;
  questionId: string;
  stableId: string;
  qType: string;
  stem: string;
  codeBlock: string | null;
  timeLimitSec: number;
  topic: string;
  options: { label: string; text: string }[];
  /** Free questions left, or null where no free limit applies to this delivery. */
  freeRemaining: number | null;
}

/** One choice in the reason check. The id carries no hint of correctness. */
export interface ReasonOption {
  id: string;
  text: string;
}

/** The follow-up that decides whether a question counts as beaten (T-255). */
export interface ReasonCheck {
  attemptId: string;
  options: ReasonOption[];
}

export interface AttemptResult {
  attemptId: string;
  isCorrect: boolean;
  /**
   * Present only on a correct answer to a question not yet beaten, and only
   * where the question's own content can carry one. Null means "not asked",
   * which is not the same as failed — the question simply stays unbeaten.
   */
  reasonCheck: ReasonCheck | null;
  pacing: 'within' | 'over' | 'unknown';
  timeTakenSec: number;
  timeLimitSec: number;
  freeRemaining: number | null;
  timeNote: string | null;
  answerView: {
    qType: string;
    stem: string;
    codeBlock: string | null;
    timeLimitSec: number;
    chosenLabel: string | null;
    correctLabel: string | null;
    conceptLine: string | null;
    explanation: string | null;
    steps: { stepNo: number; text: string; formula: string | null }[];
    options: { label: string; text: string; isCorrect: boolean; whyWrong: string | null }[];
  };
}

/** What a closed sitting looks like: the score, the breakdown, and every answer. */
export interface SittingResult {
  sittingId: string;
  examName: string;
  closedAt: string;
  closeReason: string;
  scoreCorrect: number;
  answeredCount: number;
  totalQuestions: number;
  scorePct: number;
  topics: {
    topicId: string;
    topic: string;
    asked: number;
    correct: number;
    scorePct: number;
    weightPct: number | null;
    weightedGapPct: number | null;
  }[];
  weakestTopic: string | null;
  weakestTopicId: string | null;
  items: { position: number; answerView: AttemptResult['answerView'] }[];
}

export interface PracticeSummary {
  answered: number;
  correct: number;
  scorePct: number;
  topics: {
    topicId: string;
    topic: string;
    answered: number;
    correct: number;
    scorePct: number;
    weightPct: number | null;
  }[];
  weakestTopic: string | null;
  weakestTopicId: string | null;
}

/** A topic's effective weight, and where the number came from (T-134a, T-162a). */
export interface EffectiveWeight {
  topicId: string;
  topicName: string;
  weightPct: number;
  derivedPct: number;
  weightSource: 'derived' | 'override';
  overrideReason: string | null;
  publishedCount: number;
}

/** What withdrawing a question disturbs (T-070, T-165). */
export interface BlastRadius {
  attempts: number | null;
  liveSittings: number | null;
  studentsAffected: number | null;
  measurable: boolean;
}

/** A student's readiness in a field (T-135–T-137). */
export interface Readiness {
  fieldId: string;
  fieldName: string;
  headlinePct: number | null;
  assessedWeightPct: number;
  unassessedWeightPct: number;
  totalAnswered: number;
  unansweredInMocks: number;
  topics: {
    topicId: string;
    topicName: string;
    weightPct: number;
    weightSource: 'derived' | 'override';
    answered: number;
    correct: number;
    scorePct: number | null;
    focus: boolean;
  }[];
  focus: { topicId: string; topicName: string; weightPct: number; scorePct: number | null }[];
  /** The topic the CTA targets (T-139). */
  practiceNext: { topicId: string; topicName: string } | null;
}

/** One mock sitting on the trend (T-138). Labelled "Mock 1", never by date. */
export interface TrendPoint {
  /** When it settled. Null only if a sitting is somehow still open. */
  closedAt: string | null;
  /**
   * The three that sum to the paper. Knowledge and pacing are opposite
   * diagnoses: 28% over 62 attempted is 45% of what was tried with 38 blank,
   * and a bare percentage names neither.
   */
  wrong: number;
  blank: number;
  minutesUsed: number;
  sittingId: string;
  startedAt: string;
  ordinal: number;
  label: string;
  scorePct: number;
  scoreCorrect: number;
  totalQuestions: number;
  answeredCount: number;
  unanswered: number;
  ranOutOfTime: boolean;
  /**
   * The deadline the paper had.
   *
   * Carried because `minutesUsed` is bounded by it: a paper that runs out of
   * time is settled whenever something next sweeps it, which can be a day
   * later, and the raw close time reported that whole gap as work.
   */
  endsAt: string;
}

export interface SittingClock {
  serverNow: string;
  endsAt: string;
  durationSec: number;
  remainingSec: number;
  state: 'open' | 'expired' | 'closed';
}

export interface SittingStart {
  sittingId: string;
  examName: string;
  totalQuestions: number;
  resumed: boolean;
  /**
   * What happened to a paper this one replaced, or null if there was none.
   *
   * 'EXPIRED' is the one worth saying out loud: the answers were marked, not
   * thrown away, and in silence a fresh "Question 1 of 20" reads as lost work.
   */
  settledPrevious: 'EXPIRED' | 'SUBMITTED' | null;
  clock: SittingClock;
}

export interface SittingManifest {
  sittingId: string;
  examName: string;
  totalQuestions: number;
  answeredCount: number;
  flaggedCount: number;
  clock: SittingClock;
  slots: { position: number; answered: boolean; flagged: boolean }[];
}

export interface SittingItem {
  position: number;
  totalQuestions: number;
  question: ServedQuestion;
  chosenLabel: string | null;
  flagged: boolean;
  clock: SittingClock;
}

export type PlanCode = 'SIX_MONTH' | 'TWELVE_MONTH';

export interface PlanOffer {
  code: PlanCode;
  months: number;
  priceEtb: number;
  perMonthEtb: number;
  savingPct: number;
  bestValue: boolean;
}

/** A charge that has been started and not yet settled. */
export interface StartedPayment {
  paymentId: string;
  subscriptionId: string;
  txRef: string;
}

export interface PaymentStatus {
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  expiresAt: string | null;
}

/** The admin overview's figures (T-160). The four segments sum to `signups`. */
export interface DashboardOverview {
  signups: number;
  paying: number;
  lapsed: number;
  trialling: number;
  dormant: number;
  awaitingSettlement: number;
}

export interface RevenueRow {
  method: 'TELEBIRR' | 'CBEBIRR' | 'CHAPA' | 'BANK';
  etb: number;
  count: number;
}

export interface RevenueSplit {
  rows: RevenueRow[];
  totalEtb: number;
  totalCount: number;
}

export interface UserSearchHit {
  userId: string;
  displayName: string;
  phone: string | null;
  telegramId: string | null;
  deactivated: boolean;
  matchedOn: 'phone' | 'displayName' | 'txRef';
  txRef?: string;
}

/** Where a student stands (T-190, T-191). Every figure derived from the ledger. */
export interface StandingView {
  totalPoints: number;
  streakDays: number;
  tier: 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  pointsToNextTier: number | null;
  lastActiveDay: string | null;
}

/** One award, and why it was given (T-190). */
export interface LedgerRow {
  ruleId: string;
  points: number;
  reason: string;
  day: string;
  at: string;
}

/**
 * One row of the board (T-193).
 *
 * Display name only — deliberately nowhere to put a legal name, mirroring the
 * server type exactly.
 */
export interface LeaderboardRow {
  rank: number;
  displayName: string;
  points: number;
  tier: StandingView['tier'];
  isYou: boolean;
}

export interface LeaderboardView {
  rows: LeaderboardRow[];
  /** Present even when opted out — hiding the row never hides the rank (T-194). */
  you: { rank: number; points: number; tier: StandingView['tier']; listed: boolean } | null;
}

export interface ThreadSummary {
  id: string;
  title: string;
  topicId: string;
  replies: number;
  authorName: string;
  authorVerified: boolean;
  createdAt: string;
}

export interface PostView {
  id: string;
  body: string;
  authorName: string;
  /** T-196: the product vouches for this reply. */
  verified: boolean;
  isYours: boolean;
  hidden: boolean;
  createdAt: string;
}

export interface ThreadView extends ThreadSummary {
  body: string;
  posts: PostView[];
}

export interface RowOutcome {
  stableId: string;
  line: number;
  action: 'created' | 'updated' | 'rejected';
  messages: string[];
}

export interface PaymentHistoryRow {
  id: string;
  method: string;
  status: string;
  amountEtb: number;
  txRef: string;
  months: number | null;
  claimedAt: string;
  settledAt: string | null;
  accessUntil: string | null;
}

export interface ManualClaim {
  paymentId: string;
  userId: string;
  status: string;
  amountEtb: number;
  txRef: string;
  note: string | null;
  claimedAt: string;
  settledAt: string | null;
  student: string | null;
  phone: string | null;
  joinedAt: string | null;
  priorPayments: number;
  priorVerified: number;
}

/** One thing that happened, in the provider's feed (T-227). */
export interface ActivityEvent {
  id: string;
  kind: 'staff' | 'signin' | 'signout' | 'payment' | 'practice' | 'exam';
  at: string;
  who: string;
  whoId: string;
  staff: boolean;
  what: string;
  reference: string | null;
}

export interface ActivityPage {
  events: ActivityEvent[];
  nextCursor: string | null;
  totals: { staff: number; signins: number; payments: number; attempts: number; sittings: number };
}

export type ComponentStatus = 'ok' | 'degraded' | 'down' | 'not_configured';

/** One thing being watched, and what was measured to say so (T-228). */
export interface HealthComponent {
  key: 'database' | 'api' | 'web' | 'security' | 'vps' | 'sms';
  status: ComponentStatus;
  value: string | null;
  derivation: string;
  details: { label: string; value: string }[];
  latencyMs: number | null;
}

export interface HealthReport {
  checkedAt: string;
  overall: ComponentStatus;
  components: HealthComponent[];
}

/** One draft, with everything standing between it and a student (T-231). */
export interface QueueDraft {
  id: string;
  stableId: string;
  stem: string;
  qType: string;
  field: string;
  topic: string;
  status: string;
  importFlags: string[];
  blockers: string[];
  updatedAt: string;
}

export interface ReviewQueue {
  counts: { draft: number; inReview: number; published: number; retired: number };
  drafts: QueueDraft[];
  more: number;
}

/** One question waiting on a reviewer, with everything needed to judge it. */
export interface ReviewItem {
  id: string;
  stableId: string;
  answerView: {
    qType: string;
    stem: string;
    codeBlock: string | null;
    timeLimitSec: number;
    chosenLabel: string | null;
    correctLabel: string | null;
    conceptLine: string | null;
    explanation: string | null;
    steps: { stepNo: number; text: string; formula: string | null }[];
    options: { label: string; text: string; isCorrect: boolean; whyWrong: string | null }[];
  };
  authorId: string | null;
  importFlags: string[];
  field: string;
  course: string;
  topic: string;
  topicWeighted: boolean;
  bounceNote: string | null;
  blockers: string[];
}

/**
 * What a reviewer may change (T-233).
 *
 * Why-wrongs and the concept line are deliberately absent from the import
 * template, so this is the only way anything imported ever becomes publishable.
 * Every field is optional and an omitted one is left alone — `null` clears.
 */
export interface ReviewPatch {
  correctOption?: string;
  whyWrong?: Record<string, string | null>;
  conceptLine?: string | null;
  explanation?: string | null;
  timeLimitSec?: number;
  steps?: { stepNo: number; text: string; formula?: string | null }[];
}

export interface ImportReport {
  read: number;
  created: number;
  updated: number;
  rejected: number;
  rows: RowOutcome[];
}

export const api = {
  nextQuestion: (): Promise<ServedQuestion> => call<ServedQuestion>('/questions/next'),

  /** The receipt and the payments behind it. Their own, from the session. */
  paymentHistory: (): Promise<{ payments: PaymentHistoryRow[] }> =>
    call<{ payments: PaymentHistoryRow[] }>('/payments/history'),

  /**
   * The number this student pays with, if Telegram has vouched for one (T-078a).
   *
   * Their own. The checkout pre-fills from it so somebody who has already
   * shared their number does not type it again.
   */
  myContact: (): Promise<{ phone: string | null; verifiedAt: string | null }> =>
    call('/me/contact'),

  /** What this account may reach beyond a student's own screens. Null for a student. */
  myStaffRole: (): Promise<{ role: 'REVIEWER' | 'ADMIN' | 'PROVIDER' | null }> => call('/me/staff'),

  /** PROVIDER: everything that happened, newest first. */
  activity: (kinds: readonly string[], before?: string): Promise<ActivityPage> => {
    const query = new URLSearchParams();
    if (kinds.length > 0) query.set('kinds', kinds.join(','));
    if (before) query.set('before', before);
    const suffix = query.toString();
    return call<ActivityPage>(`/provider/activity${suffix ? `?${suffix}` : ''}`);
  },

  /** PROVIDER: live health, measured at the moment of asking. */
  providerHealth: (): Promise<HealthReport> => call<HealthReport>('/provider/health'),

  /** STAFF: what is in the bank and what is stopping it. */
  reviewQueue: (): Promise<ReviewQueue> => call<ReviewQueue>('/admin/review/queue'),

  /** STAFF: the next question waiting on a reviewer, or null. */
  reviewNext: (): Promise<ReviewItem | null> => call<ReviewItem | null>('/admin/review/next'),

  /** STAFF: write the answer content the import could not carry. */
  reviewPatch: (
    id: string,
    patch: ReviewPatch,
  ): Promise<{ id: string; status: string; changed: string[] }> =>
    call(`/admin/review/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  /** STAFF: send a draft into the review queue. */
  reviewSubmit: (id: string): Promise<{ id: string; status: string }> =>
    call(`/admin/review/${id}/submit`, { method: 'POST' }),

  /** STAFF: send it back to its author. The note is required and is shown to them. */
  reviewBounce: (id: string, note: string): Promise<{ id: string; status: string }> =>
    call(`/admin/review/${id}/bounce`, { method: 'POST', body: JSON.stringify({ note }) }),

  /** ADMIN only: a reviewer proposes, an admin decides what a student reads. */
  reviewPublish: (id: string): Promise<{ id: string; status: string }> =>
    call(`/admin/review/${id}/publish`, { method: 'POST' }),

  /** ADMIN: claimed bank transfers, oldest pending first. */
  adminClaims: (): Promise<ManualClaim[]> => call<ManualClaim[]>('/admin/payments'),

  /** ADMIN: the money arrived. Grants access and messages the student. */
  adminConfirmPayment: (
    paymentId: string,
    note: string,
  ): Promise<{ activated: boolean; expiresAt: string | null }> =>
    call(`/admin/payments/${paymentId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  /** ADMIN: it did not. The reason is required — the student is told it. */
  adminRejectPayment: (
    paymentId: string,
    reason: string,
  ): Promise<{ paymentId: string; status: 'REJECTED' }> =>
    call(`/admin/payments/${paymentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /** ADMIN: sign a student out everywhere so they can pair a new phone. */
  adminResetDevices: (
    userId: string,
    reason: string,
  ): Promise<{ userId: string; displayName: string; revoked: number }> =>
    call(`/admin/users/${userId}/reset-devices`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /**
   * ADMIN: stop an account signing in, or let it back in. Nothing is deleted.
   *
   * `active` is explicit rather than a toggle: a route that flips whatever it
   * finds will reactivate an account when two operators press the button at
   * once, and the second one will believe they closed it.
   */
  adminSetActive: (
    userId: string,
    active: boolean,
    reason: string,
  ): Promise<{
    userId: string;
    displayName: string;
    active: boolean;
    deactivatedAt: string | null;
    revoked: number;
  }> =>
    call(`/admin/users/${userId}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({ active, reason }),
    }),

  plans: (): Promise<PlanOffer[]> => call<PlanOffer[]>('/payments/plans'),

  /**
   * Options 1 and 2: a USSD push to the student's own handset.
   *
   * Returns before they have typed their PIN, so the screen that calls this
   * shows "check your phone" and polls — there is nothing to wait for here.
   */
  payDirect: (
    channel: 'telebirr' | 'cbebirr',
    planCode: PlanCode,
    mobile: string,
  ): Promise<StartedPayment & { pushSentTo: string }> =>
    call(`/payments/${channel}`, { method: 'POST', body: JSON.stringify({ planCode, mobile }) }),

  /** Option 3: Chapa's hosted page. The URL is theirs; we only redirect to it. */
  payHosted: (planCode: PlanCode): Promise<StartedPayment & { checkoutUrl: string }> =>
    call('/payments/chapa', { method: 'POST', body: JSON.stringify({ planCode }) }),

  /** Option 4: any bank, then the reference off the receipt. Settled by a person. */
  payManual: (
    planCode: PlanCode,
    txRef: string,
  ): Promise<{ paymentId: string; subscriptionId: string; status: 'PENDING' }> =>
    call('/payments/manual', { method: 'POST', body: JSON.stringify({ planCode, txRef }) }),

  paymentStatus: (txRef: string): Promise<PaymentStatus> =>
    call<PaymentStatus>(`/payments/status?txRef=${encodeURIComponent(txRef)}`),

  mySubscription: (): Promise<{
    hasEverPaid: boolean;
    active: boolean;
    expiresAt: string | null;
    planCode: PlanCode | null;
    /** A bank transfer submitted and not yet settled. Null when there is none. */
    pendingClaim: { txRef: string; amountEtb: number } | null;
    /** Free questions left in the chosen programme. Null with none chosen. */
    freeRemaining: number | null;
  }> => call('/payments/me'),

  submitAttempt: (input: {
    questionId: string;
    chosenLabel: string;
    timeTakenSec: number;
  }): Promise<AttemptResult> =>
    call<AttemptResult>('/attempts', { method: 'POST', body: JSON.stringify(input) }),

  practiceSummary: (): Promise<PracticeSummary> => call<PracticeSummary>('/practice/summary'),

  /**
   * Every published programme, with the student's own marked `chosen`.
   *
   * One call rather than a list plus a "which is mine" — two calls can disagree,
   * and the screens that got this wrong were reading `fields[0]` and calling it
   * the student's programme.
   */
  myFields: (): Promise<FieldOption[]> => call<FieldOption[]>('/me/fields'),

  /** What the mock is, and whether one is already open — asked before starting. */
  examPreview: (): Promise<ExamPreview> => call<ExamPreview>('/exams/preview'),

  /** How much of a track has been beaten, and the plan to reach the target. */
  coverage: (fieldId: string): Promise<CoverageView> =>
    call<CoverageView>(`/me/coverage/${fieldId}`),

  /**
   * The banded board. Weekly unless asked otherwise — an all-time board is
   * decided by January and stops motivating whoever joined after it.
   */
  board: (window: 'week' | 'all' = 'week'): Promise<BoardView> =>
    call<BoardView>(`/me/board?window=${window}`),

  /**
   * Names the reason an answer was right, which is what turns a correct answer
   * into a *beaten* question. Answerable once.
   */
  answerReason: (
    attemptId: string,
    chosenId: string,
  ): Promise<{ attemptId: string; reasonCorrect: boolean; beaten: boolean }> =>
    call(`/attempts/${attemptId}/reason`, {
      method: 'POST',
      body: JSON.stringify({ chosenId }),
    }),

  /**
   * Signs in with a phone number and a password (T-263).
   *
   * The phone number is the username. Sent as typed — the server normalises,
   * so `0911…`, `+251911…` and `251 91 1…` all reach the same account and the
   * client never has to know the rules.
   */
  signInWithPassword: (
    phone: string,
    password: string,
  ): Promise<{ token: string; userId: string; displayName: string; fieldId: string | null }> =>
    call('/auth/sign-in', { method: 'POST', body: JSON.stringify({ phone, password }) }),

  /** Who am I. The generated handle, never a legal name. */
  me: (): Promise<Identity> => call<Identity>('/me'),

  /** Every session still open on this account, this one marked. */
  devices: (): Promise<DeviceEntry[]> => call<DeviceEntry[]>('/me/devices'),

  revokeDevice: (id: string): Promise<{ revoked: boolean; alreadyRevoked: boolean }> =>
    call<{ revoked: boolean; alreadyRevoked: boolean }>(`/me/devices/${id}/revoke`, {
      method: 'POST',
    }),

  /**
   * Ends this session, on the server as well as in the browser.
   *
   * The route revokes the row *and* clears the cookie — clearing the cookie
   * alone would leave a live session that anybody holding the token could keep
   * using, which is not signing out, it is hiding the key.
   */
  signOut: (): Promise<{ ok: boolean }> =>
    call<{ ok: boolean }>('/auth/sign-out', {
      method: 'POST',
    }),

  /**
   * Picks the programme every question is scoped to (PLAN.md 4.1).
   *
   * `isRetaker` rides along because the programme choice is the only onboarding
   * question the product asks — see TASK.md T-166.
   */
  chooseField: (fieldId: string, isRetaker?: boolean): Promise<{ fieldId: string; name: string }> =>
    call('/me/field', {
      method: 'PUT',
      body: JSON.stringify(isRetaker === undefined ? { fieldId } : { fieldId, isRetaker }),
    }),

  startExam: (fieldId: string): Promise<SittingStart> =>
    call<SittingStart>(`/exams/${fieldId}/start`, { method: 'POST', body: '{}' }),

  sitting: (sittingId: string): Promise<SittingManifest> =>
    call<SittingManifest>(`/exams/sittings/${sittingId}`),

  sittingItem: (sittingId: string, position: number): Promise<SittingItem> =>
    call<SittingItem>(`/exams/sittings/${sittingId}/paper/${position}`),

  /**
   * Records a choice, a flag, or both.
   *
   * Sent on every change rather than batched at the end: a sitting that loses
   * ninety minutes of answers to a closed tab is worse than a few more requests,
   * and the server is the only authority on what was answered in time.
   */
  answerExam: (
    sittingId: string,
    position: number,
    body: { chosenLabel?: string; isFlagged?: boolean },
  ): Promise<{
    position: number;
    chosenLabel: string | null;
    flagged: boolean;
    clock: SittingClock;
  }> =>
    call(`/exams/sittings/${sittingId}/answers/${position}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  submitExam: (sittingId: string): Promise<SittingResult> =>
    call<SittingResult>(`/exams/sittings/${sittingId}/submit`, {
      method: 'POST',
      body: '{}',
    }),

  /**
   * The full review. 409s while the sitting is open — the answers unlock at
   * close and not a moment sooner, which is the whole of T-129.
   */
  examResult: (sittingId: string): Promise<SittingResult> =>
    call<SittingResult>(`/exams/sittings/${sittingId}/result`),

  readiness: (fieldId: string): Promise<Readiness> => call<Readiness>(`/me/readiness/${fieldId}`),

  trend: (fieldId: string): Promise<TrendPoint[]> => call<TrendPoint[]>(`/me/trend/${fieldId}`),

  /** Bulk question upload (PLAN.md 4.6). Every row lands DRAFT — T-054. */
  adminImportCsv: (csv: string): Promise<ImportReport> =>
    call<ImportReport>('/admin/questions/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),

  adminOverview: (): Promise<DashboardOverview> =>
    call<DashboardOverview>('/admin/analytics/overview'),

  adminRevenue: (): Promise<RevenueSplit> => call<RevenueSplit>('/admin/analytics/revenue'),

  /** Phone, display name or an exact transaction reference (T-163). */
  adminSearchUsers: (query: string): Promise<UserSearchHit[]> =>
    call<UserSearchHit[]>(`/admin/analytics/users/search?q=${encodeURIComponent(query)}`),

  standing: (): Promise<StandingView> => call<StandingView>('/me/standing'),

  pointsLedger: (): Promise<LedgerRow[]> => call<LedgerRow[]>('/me/points'),

  leaderboard: (): Promise<LeaderboardView> => call<LeaderboardView>('/me/leaderboard'),

  setLeaderboardOptOut: (optOut: boolean): Promise<{ optedOut: boolean }> =>
    call('/me/leaderboard/opt-out', { method: 'POST', body: JSON.stringify({ optOut }) }),

  threads: (topicId: string): Promise<ThreadSummary[]> =>
    call<ThreadSummary[]>(`/community/topics/${topicId}/threads`),

  openThread: (topicId: string, title: string, body: string): Promise<{ id: string }> =>
    call(`/community/topics/${topicId}/threads`, {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    }),

  thread: (threadId: string): Promise<ThreadView> =>
    call<ThreadView>(`/community/threads/${threadId}`),

  reply: (threadId: string, body: string): Promise<{ id: string }> =>
    call(`/community/threads/${threadId}/posts`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  reportPost: (postId: string, reason: string, note?: string): Promise<{ queued: true }> =>
    call(`/community/posts/${postId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, note }),
    }),

  /** Admin. Every one of these is ADMIN-guarded and audited on the server. */
  adminWeights: (fieldId: string): Promise<EffectiveWeight[]> =>
    call<EffectiveWeight[]>(`/admin/fields/${fieldId}/weights`),

  adminDeriveWeights: (fieldId: string): Promise<EffectiveWeight[]> =>
    call<EffectiveWeight[]>(`/admin/fields/${fieldId}/weights/derive`, {
      method: 'POST',
      body: '{}',
    }),

  adminOverrideWeight: (
    fieldId: string,
    topicId: string,
    weightPct: number,
    reason: string,
  ): Promise<EffectiveWeight[]> =>
    call<EffectiveWeight[]>(`/admin/fields/${fieldId}/weights/topics/${topicId}`, {
      method: 'POST',
      body: JSON.stringify({ weightPct, reason }),
    }),

  adminClearWeightOverride: (fieldId: string, topicId: string): Promise<EffectiveWeight[]> =>
    call<EffectiveWeight[]>(`/admin/fields/${fieldId}/weights/topics/${topicId}`, {
      method: 'DELETE',
    }),

  adminRetire: (
    questionId: string,
    reason: string,
  ): Promise<{ id: string; status: string; alreadyRetired: boolean; blastRadius: BlastRadius }> =>
    call(`/admin/questions/${questionId}/retire`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
