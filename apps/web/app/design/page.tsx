import { AnswerOptionGroup } from '../../components/AnswerOptionGroup';
import { AnswerView } from '../../components/AnswerView';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { CodeBlock } from '../../components/CodeBlock';
import { ExamTimer } from '../../components/ExamTimer';
import { ExamSummary } from '../../components/ExamSummary';
import { RetireConfirmationDemo } from './RetireConfirmationDemo';
import { ScoreTrend } from '../../components/ScoreTrend';
import { WeightSumIndicator } from '../../components/WeightSumIndicator';
import { JumpGridDemo } from './JumpGridDemo';
import { Input } from '../../components/Input';
import { ReadinessStatement } from '../../components/ReadinessStatement';
import { StatedFigure } from '../../components/StatedFigure';
import { ThemeToggle } from '../../components/ThemeToggle';
import { TotalBar } from '../../components/TotalBar';
import { buildReadiness } from '../../components/readiness';
import { Button } from '../../components/Button';

/**
 * The design-system gallery.
 *
 * Every component rendered in every state, on one route. It exists because the
 * assertions in TASK.md are about computed pixels — 52px tall, this shadow, that
 * contrast — and those can only be checked against a real browser. It is also
 * the fastest way to see a token change land across the whole system.
 *
 * Deliberately a normal route rather than a dev-only one: a gallery that only
 * exists in development is a gallery nobody checks against production CSS.
 * Nothing here reads data or takes an action.
 */
export const metadata = { title: 'Design system · Lomi-Test' };

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-caption text-ink-2 mb-3 uppercase">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-title">Design system</h1>
      <p className="text-body text-ink-2 mt-1">Deresegn v3 — every component, every state.</p>

      <Row title="Theme">
        <ThemeToggle />
      </Row>

      <Row title="Buttons">
        <Button id="btn-primary" variant="primary">
          Start practice
        </Button>
        <Button id="btn-ghost" variant="ghost">
          Pay with CBE Birr
        </Button>
        <Button id="btn-danger" variant="danger">
          Retire question
        </Button>
        <Button id="btn-disabled" variant="primary" disabled>
          Publish
        </Button>
        <Button
          id="btn-blocked"
          variant="primary"
          disabled
          blockingReason="Can't publish · 3 blockers"
        >
          Publish
        </Button>
        <Button id="btn-ghost-disabled" variant="ghost" disabled blockingReason="No plan yet">
          Continue
        </Button>
      </Row>

      <Row title="Answer options — unanswered">
        <div id="group-unanswered">
          <AnswerOptionGroup
            ariaLabel="Which sampling method gives every household an equal chance?"
            choices={[
              { label: 'A', text: 'Purposive sampling' },
              { label: 'B', text: 'Snowball sampling', state: 'selected' },
              { label: 'C', text: 'Simple random sampling' },
              { label: 'D', text: 'Convenience sampling' },
            ]}
          />
        </div>
      </Row>

      <Row title="Answer options — answered wrongly">
        <div id="group-answered">
          <AnswerOptionGroup
            ariaLabel="Which sampling method gives every household an equal chance?"
            disabled
            choices={[
              { label: 'A', text: 'Purposive sampling' },
              { label: 'B', text: 'Snowball sampling', state: 'wrong', wasChosen: true },
              { label: 'C', text: 'Simple random sampling', state: 'correct' },
              { label: 'D', text: 'Convenience sampling' },
            ]}
          />
        </div>
      </Row>
      <Row title="Cards">
        <Card id="card-plain">
          <h3 className="text-label">Taxation · VAT</h3>
          <p className="text-body text-ink-2 mt-1">12 questions answered · 9 correct.</p>
        </Card>
      </Row>

      <Row title="Chips">
        <div className="flex flex-wrap gap-2">
          <Chip id="chip-neutral">share of past papers</Chip>
          <Chip id="chip-correct" tone="correct">
            Correct
          </Chip>
          <Chip id="chip-wrong" tone="wrong">
            Not quite
          </Chip>
          <Chip id="chip-pending" tone="pending">
            Over time
          </Chip>
          <Chip id="chip-brand" tone="brand">
            Focus
          </Chip>
          <Chip id="chip-reward" tone="reward">
            7-day streak
          </Chip>
        </div>
      </Row>

      <Row title="Inputs">
        <Input label="Phone number" name="phone" placeholder="09…" />
        <Input
          label="Display name"
          name="displayName"
          defaultValue="SwiftSummit4821"
          hint="Other students see this name, never your real one."
        />
        <Input
          label="Transaction number"
          name="txn"
          defaultValue="FT2"
          error="That is 3 characters. A CBE transaction number is 12."
        />
      </Row>
      <Row title="Total rule">
        <div id="total-bar">
          <TotalBar
            unit="%"
            totalLabel="All topics"
            rows={[
              { label: 'VAT', value: 40 },
              { label: 'Income tax', value: 35 },
              { label: 'Excise', value: 25 },
            ]}
            total={100}
          />
        </div>
        <div id="stated-figure">
          <StatedFigure
            label="Readiness"
            value="68%"
            derivation="weighted mean of 6 topic groups"
          />
        </div>
      </Row>

      <Row title="Readiness statement">
        <div id="readiness">
          <ReadinessStatement
            statement={buildReadiness([
              { topic: 'VAT', scorePct: 82, weightPct: 12 },
              { topic: 'Payroll tax', scorePct: 71, weightPct: 12 },
              { topic: 'Audit evidence', scorePct: 44, weightPct: 18 },
            ])}
          />
        </div>
      </Row>
      <Row title="Answer view — calculation, answered wrongly">
        <div id="answer-calculation">
          <AnswerView
            isCorrect={false}
            pacing="within"
            timeTakenSec={96}
            answer={{
              qType: 'CALCULATION',
              stem: 'A retailer sells goods for Br 1,150,000 VAT inclusive (15%). How much VAT?',
              codeBlock: null,
              timeLimitSec: 180,
              chosenLabel: 'D',
              correctLabel: 'B',
              conceptLine: 'VAT inside a gross amount is extracted with ×15/115.',
              explanation: null,
              steps: [
                { stepNo: 1, text: 'The amount is VAT-inclusive.', formula: null },
                { stepNo: 2, text: 'Extract the tax fraction.', formula: 'gross × 15/115' },
                { stepNo: 3, text: '1,150,000 × 15/115', formula: null },
                { stepNo: 4, text: '= 150,000 → answer B', formula: null },
              ],
              options: [
                {
                  label: 'A',
                  text: '172,500',
                  isCorrect: false,
                  whyWrong: 'That is 15% of the net amount, not the tax inside the gross.',
                },
                { label: 'B', text: '150,000', isCorrect: true, whyWrong: null },
                {
                  label: 'C',
                  text: '15,000',
                  isCorrect: false,
                  whyWrong: 'Off by a factor of ten.',
                },
                {
                  label: 'D',
                  text: '1,000,000',
                  isCorrect: false,
                  whyWrong: 'That is the net amount, not the VAT.',
                },
              ],
            }}
          />
        </div>
      </Row>

      <Row title="Answer view — concept, correct but over time">
        <div id="answer-concept">
          <AnswerView
            isCorrect={true}
            pacing="over"
            timeTakenSec={214}
            answer={{
              qType: 'CONCEPT',
              stem: 'Which sampling method gives every household an equal chance?',
              codeBlock: null,
              timeLimitSec: 60,
              chosenLabel: 'C',
              correctLabel: 'C',
              conceptLine: 'Equal probability for every unit is simple random sampling.',
              explanation:
                'Only simple random sampling gives every household the same chance of selection.',
              steps: [],
              options: [
                {
                  label: 'A',
                  text: 'Purposive',
                  isCorrect: false,
                  whyWrong: 'Picks units deliberately, not by chance.',
                },
                {
                  label: 'B',
                  text: 'Snowball',
                  isCorrect: false,
                  whyWrong: 'Recruits through referral, so chances are unequal.',
                },
                { label: 'C', text: 'Simple random', isCorrect: true, whyWrong: null },
                {
                  label: 'D',
                  text: 'Convenience',
                  isCorrect: false,
                  whyWrong: 'Takes whoever is reachable.',
                },
              ],
            }}
          />
        </div>
      </Row>
      <Row title="Code block — CS-0001">
        <div id="code-well">
          <CodeBlock code="nav ul { list-style-type: none; margin: 0; padding: 0; }" />
        </div>
        <div id="code-well-long">
          <CodeBlock
            code={
              'SELECT student_id, AVG(score) AS mean_score FROM attempts WHERE field_id = $1 GROUP BY student_id HAVING COUNT(*) > 10 ORDER BY mean_score DESC;'
            }
          />
        </div>
      </Row>
      <Row title="Exam timer — the three states">
        <div id="timer-normal">
          <ExamTimer remainingSec={10800} durationSec={10800} />
        </div>
        <div id="timer-warning">
          <ExamTimer remainingSec={1800} durationSec={10800} />
        </div>
        <div id="timer-critical">
          <ExamTimer remainingSec={240} durationSec={10800} />
        </div>
      </Row>

      <Row title="Jump grid">
        <div id="jump-grid-demo">
          <JumpGridDemo />
        </div>
      </Row>
      <Row title="Post-exam summary">
        <div id="exam-summary-demo">
          <ExamSummary
            summary={{
              scoreCorrect: 4,
              answeredCount: 7,
              totalQuestions: 8,
              scorePct: 50,
              weakestTopic: 'Algorithms',
              weakestTopicId: 'id-Algorithms',
              topics: [
                {
                  topicId: 'id-Algorithms',
                  topic: 'Algorithms',
                  asked: 4,
                  correct: 3,
                  scorePct: 75,
                  weightPct: 40,
                  weightedGapPct: 10,
                },
                {
                  topicId: 'id-Databases',
                  topic: 'Databases',
                  asked: 4,
                  correct: 1,
                  scorePct: 25,
                  weightPct: 10,
                  weightedGapPct: 7.5,
                },
                {
                  topicId: 'id-Networks',
                  topic: 'Networks',
                  asked: 0,
                  correct: 0,
                  scorePct: 0,
                  weightPct: null,
                  weightedGapPct: null,
                },
              ],
            }}
          />
        </div>
      </Row>
      <Row title="Mock score trend">
        <div id="score-trend-demo">
          <ScoreTrend
            points={[
              {
                sittingId: 's1',
                label: 'Mock 1',
                scorePct: 41,
                scoreCorrect: 41,
                totalQuestions: 100,
                unanswered: 0,
                ranOutOfTime: false,
              },
              {
                sittingId: 's2',
                label: 'Mock 2',
                scorePct: 38,
                scoreCorrect: 38,
                totalQuestions: 100,
                unanswered: 22,
                ranOutOfTime: true,
              },
              {
                sittingId: 's3',
                label: 'Mock 3',
                scorePct: 63,
                scoreCorrect: 63,
                totalQuestions: 100,
                unanswered: 0,
                ranOutOfTime: false,
              },
            ]}
          />
        </div>
      </Row>
      <Row title="Weight sum — balanced and not">
        <div id="weight-sum-balanced">
          <WeightSumIndicator
            rows={[
              { topicId: 'a', topicName: 'A', weightPct: 34 },
              { topicId: 'b', topicName: 'B', weightPct: 33 },
              { topicId: 'c', topicName: 'C', weightPct: 33 },
            ]}
          />
        </div>
        <div id="weight-sum-short">
          <WeightSumIndicator
            rows={[
              { topicId: 'a', topicName: 'A', weightPct: 34 },
              { topicId: 'b', topicName: 'B', weightPct: 33 },
              { topicId: 'c', topicName: 'C', weightPct: 30 },
            ]}
          />
        </div>
      </Row>

      <Row title="Retire confirmation — the only modal">
        <div id="retire-confirmation-demo">
          <RetireConfirmationDemo />
        </div>
      </Row>
    </main>
  );
}
