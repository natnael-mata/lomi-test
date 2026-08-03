'use client';

/**
 * The practice screen (T-112) — the first surface reading live data.
 *
 * One question at a time, answered, explained, next. The three states it can be
 * in are distinct on purpose: asking, explaining, and out of free questions.
 * Nothing is collapsed and nothing is behind a tap.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { AnswerOptionGroup } from '../../components/AnswerOptionGroup';
import { AnswerView } from '../../components/AnswerView';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { CodeBlock } from '../../components/CodeBlock';
import type { OptionLabel } from '../../components/AnswerOption';
import { ApiError, api, type AttemptResult, type ServedQuestion } from '../../lib/api';

type Phase =
  | { kind: 'loading' }
  | { kind: 'asking'; question: ServedQuestion }
  | { kind: 'answered'; question: ServedQuestion; result: AttemptResult }
  | { kind: 'exhausted'; reason: string }
  | { kind: 'paywalled' }
  | { kind: 'error'; message: string };

export function PracticeScreen() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [chosen, setChosen] = useState<OptionLabel | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * When this question was first shown.
   *
   * A ref, not state: it must not survive a re-render as a stale value and it
   * must never trigger one. The server treats whatever arrives as advisory
   * anyway (it clamps), so this is a best effort at honest pacing, not a
   * measurement anyone is scored on.
   */
  const shownAt = useRef<number>(Date.now());

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' });
    setChosen(null);
    try {
      const question = await api.nextQuestion();
      shownAt.current = Date.now();
      setPhase({ kind: 'asking', question });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setPhase({
          kind: 'exhausted',
          reason: 'Nothing left to practise in this programme today.',
        });
        return;
      }
      if (e instanceof ApiError && e.code === 'FIELD_REQUIRED') {
        setPhase({ kind: 'error', message: 'Choose a programme before practising.' });
        return;
      }
      setPhase({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Something went wrong.',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (): Promise<void> => {
    if (phase.kind !== 'asking' || chosen === null || submitting) return;
    setSubmitting(true);
    try {
      const result = await api.submitAttempt({
        questionId: phase.question.questionId,
        chosenLabel: chosen,
        timeTakenSec: Math.round((Date.now() - shownAt.current) / 1000),
      });
      setPhase({ kind: 'answered', question: phase.question, result });
    } catch (e) {
      // 402 is not an error state, it is the end of the free tier — a different
      // screen with a different action.
      if (e instanceof ApiError && e.code === 'FREE_LIMIT_REACHED') {
        setPhase({ kind: 'paywalled' });
        return;
      }
      setPhase({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Something went wrong.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (phase.kind === 'loading') {
    return (
      <p data-state="loading" className="text-body text-ink-2 py-8 text-center">
        Loading a question…
      </p>
    );
  }

  if (phase.kind === 'error') {
    return (
      <Card data-state="error">
        <p className="text-body">{phase.message}</p>
        <Button className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </Card>
    );
  }

  if (phase.kind === 'exhausted') {
    return (
      <Card data-state="exhausted">
        <h1 className="text-title">Done for today</h1>
        <p className="text-body text-ink-2 mt-2">{phase.reason}</p>
      </Card>
    );
  }

  if (phase.kind === 'paywalled') {
    return (
      <Card data-state="paywalled">
        <h1 className="text-title">That is your ten free questions</h1>
        <p className="text-body text-ink-2 mt-2">
          Every question in the bank comes with a full explanation. Unlock the rest for six or
          twelve months.
        </p>
        <Button className="mt-4">See the plans</Button>
      </Card>
    );
  }

  const { question } = phase;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <Chip>{question.topic}</Chip>
        {phase.kind === 'answered' && phase.result.freeRemaining !== null && (
          <Chip tone={phase.result.freeRemaining <= 2 ? 'pending' : 'neutral'}>
            {phase.result.freeRemaining} free left
          </Chip>
        )}
      </header>

      <Card as="section">
        <p className="text-stem" data-stem="">
          {question.stem}
        </p>
        {question.codeBlock && (
          <div className="mt-3">
            <CodeBlock code={question.codeBlock} />
          </div>
        )}
      </Card>

      {phase.kind === 'asking' ? (
        <>
          <AnswerOptionGroup
            ariaLabel={question.stem}
            choices={question.options.map((o) => ({
              label: o.label as OptionLabel,
              text: o.text,
              state: chosen === o.label ? 'selected' : 'default',
            }))}
            onSelect={(label) => setChosen(label)}
          />
          <Button
            disabled={chosen === null || submitting}
            blockingReason={chosen === null ? 'Choose an answer first' : undefined}
            onClick={() => void submit()}
          >
            {submitting ? 'Checking…' : 'Check answer'}
          </Button>
        </>
      ) : (
        <>
          <AnswerView
            answer={phase.result.answerView}
            isCorrect={phase.result.isCorrect}
            pacing={phase.result.pacing}
            timeTakenSec={phase.result.timeTakenSec}
          />
          <Button onClick={() => void load()}>Next question</Button>
        </>
      )}
    </div>
  );
}
