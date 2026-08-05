/**
 * The API client.
 *
 * Everything goes through `/api/*` on this origin, which `next.config.ts`
 * rewrites to the Nest server. The browser never learns the API's real address.
 */

export const TOKEN_STORAGE_KEY = 'lomi-session';

/**
 * Where the session token lives.
 *
 * `localStorage` today, and that is a **known tradeoff, not an oversight**: any
 * script that runs on this page can read it, so an XSS becomes a stolen session.
 * The alternative — an httpOnly cookie set by the auth route — cannot be read by
 * the client at all, and is where this should end up. It is deferred rather than
 * done because the auth flow that would set that cookie is T-077, which the
 * project owner is handling separately. The rewrite above is what keeps that
 * move a one-file change.
 */
export function sessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
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
  const token = sessionToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export const api = {
  nextQuestion: (): Promise<ServedQuestion> => call<ServedQuestion>('/questions/next'),

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
};
