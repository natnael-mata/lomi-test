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

/** The pre-answer payload. Deliberately carries no answer content (T-106). */
export interface ServedQuestion {
  questionId: string;
  stableId: string;
  qType: string;
  stem: string;
  codeBlock: string | null;
  timeLimitSec: number;
  topic: string;
  options: { label: string; text: string }[];
}

export interface AttemptResult {
  attemptId: string;
  isCorrect: boolean;
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

export const api = {
  nextQuestion: (): Promise<ServedQuestion> => call<ServedQuestion>('/questions/next'),

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
  }> => call('/payments/me'),

  submitAttempt: (input: {
    questionId: string;
    chosenLabel: string;
    timeTakenSec: number;
  }): Promise<AttemptResult> =>
    call<AttemptResult>('/attempts', { method: 'POST', body: JSON.stringify(input) }),

  practiceSummary: (): Promise<PracticeSummary> => call<PracticeSummary>('/practice/summary'),

  myFields: (): Promise<{ id: string; name: string; slug: string }[]> =>
    call<{ id: string; name: string; slug: string }[]>('/me/fields'),

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
