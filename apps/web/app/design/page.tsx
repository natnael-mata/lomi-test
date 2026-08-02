import { AnswerOptionGroup } from '../../components/AnswerOptionGroup';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Input } from '../../components/Input';
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
    </main>
  );
}
