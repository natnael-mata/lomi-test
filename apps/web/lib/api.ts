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

export const api = {
  nextQuestion: (): Promise<ServedQuestion> => call<ServedQuestion>('/questions/next'),

  submitAttempt: (input: {
    questionId: string;
    chosenLabel: string;
    timeTakenSec: number;
  }): Promise<AttemptResult> =>
    call<AttemptResult>('/attempts', { method: 'POST', body: JSON.stringify(input) }),
};
