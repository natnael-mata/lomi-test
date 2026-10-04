'use client';

/**
 * The receipt, and the payments behind it (T-154, design handoff 2f).
 *
 * *"The reference shows once; there is no receipt to keep."* That was the gap.
 * A student who paid by bank transfer saw their reference on one screen, once,
 * and had nowhere to look it up again — which is the exact moment somebody
 * pays a second time.
 *
 * Three decisions worth stating:
 *
 * - **The newest settled payment is the receipt**, and everything else is the
 *   list under it. One query, so the two halves cannot disagree about which
 *   payment is the latest.
 * - **Pending and rejected rows are shown**, with their status in words. A
 *   claim that is still being checked has to be visible, or it looks lost.
 * - **Every figure is tabular.** Amounts, references and dates are read against
 *   each other and against a bank statement; proportional digits make two
 *   references that differ in one place look identical.
 *
 * Nothing here is printable or downloadable — that is a product-wide rule
 * (T-205), and a receipt is not the exception people ask for; the reference is.
 */
import { useEffect, useState } from 'react';

import { Icon, type IconName } from './icons';
import { api, type PaymentHistoryRow } from '../lib/api';
import { day } from '../lib/dates';
import { copy } from '../lib/i18n';

type Phase = { kind: 'loading' } | { kind: 'ready'; rows: PaymentHistoryRow[] } | { kind: 'error' };

/** How a settled status reads: a word and a glyph, never the colour alone. */
const STATUS: Record<string, { tone: string; icon: IconName }> = {
  CONFIRMED: { tone: 'text-correct', icon: 'check' },
  PENDING: { tone: 'text-pending', icon: 'clock' },
  REJECTED: { tone: 'text-wrong', icon: 'cross' },
};

export function Receipt() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { payments } = await api.paymentHistory();
        if (alive) setPhase({ kind: 'ready', rows: payments });
      } catch {
        if (alive) setPhase({ kind: 'error' });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (phase.kind === 'loading') return <p className="text-body text-ink-2">{c.receipt.working}</p>;
  if (phase.kind === 'error') return <p className="text-body">{c.receipt.couldNotLoad}</p>;

  const latest = phase.rows.find((row) => row.status === 'CONFIRMED') ?? null;

  return (
    // Content height, not `flex-1` with an `mt-auto` button: that pair is
    // what opened the void the gap checker was written for.
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-[clamp(26px,3vw,32px)] leading-[1.2] font-extrabold tracking-[-0.025em]">
        {c.checkout.heading}
      </h1>

      {latest ? <Detail row={latest} /> : null}

      <span className="text-caption text-ink-3 mt-2 uppercase">{c.receipt.history}</span>

      {phase.rows.length === 0 ? (
        <p className="text-body text-ink-2">{c.receipt.noHistory}</p>
      ) : (
        <section className="border-border bg-surface rounded-card flex flex-col border px-5 py-1">
          {phase.rows.map((row, index) => (
            <span
              key={row.id}
              data-payment={row.txRef}
              className={[
                'flex items-center justify-between gap-3 py-3',
                index === phase.rows.length - 1 ? '' : 'border-border border-b',
              ].join(' ')}
            >
              <span className="flex flex-col">
                <span className="text-label num">
                  {c.receipt.historyRow(money(row.amountEtb), row.months ?? 0)}
                </span>
                <span className="text-caption text-ink-2 num">
                  {c.receipt.historyMeta(
                    methodName(row.method),
                    day(row.settledAt ?? row.claimedAt),
                  )}
                </span>
              </span>
              <StatusMark status={row.status} />
            </span>
          ))}
        </section>
      )}

      <a href="/practice" className="btn-primary">
        {c.receipt.backToPractising}
      </a>
    </div>
  );
}

/** The receipt proper: label and value, one fact per row. */
function Detail({ row }: { row: PaymentHistoryRow }) {
  const c = copy();
  const lines: [string, string][] = [
    [c.receipt.plan, c.receipt.planValue(row.months ?? 0)],
    [c.receipt.amount, money(row.amountEtb)],
    [c.receipt.method, methodName(row.method)],
    [c.receipt.reference, row.txRef],
    [c.receipt.paid, day(row.settledAt ?? row.claimedAt)],
  ];

  return (
    <section className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6">
      <span
        data-banner="correct"
        className="bg-correct-soft text-correct-deep rounded-option inline-flex items-center gap-2 p-3.5 text-[15px] font-bold"
      >
        <Icon name="check" size={18} strokeWidth={2.5} />
        {c.checkout.verifiedBanner}
      </span>

      <span className="num flex flex-col gap-2">
        {lines.map(([label, value]) => (
          <span key={label} className="flex justify-between gap-3">
            <span className="text-body text-ink-2">{label}</span>
            <span className="text-body text-right font-semibold">{value}</span>
          </span>
        ))}
        {/* The rule under the rule: what a student came to this screen to find
            out is the date access ends, so it sits below the divider on its
            own rather than fourth in a list of five. */}
        {row.accessUntil ? (
          <>
            <span className="bg-border h-px" />
            <span className="flex justify-between gap-3">
              <span className="text-body text-ink-2">{c.receipt.accessUntil}</span>
              <span className="text-body text-right font-semibold">{day(row.accessUntil)}</span>
            </span>
          </>
        ) : null}
      </span>
    </section>
  );
}

function StatusMark({ status }: { status: string }) {
  const c = copy();
  const look = STATUS[status] ?? STATUS.PENDING!;
  const word =
    status === 'CONFIRMED'
      ? c.receipt.verified
      : status === 'REJECTED'
        ? c.receipt.notAccepted
        : c.receipt.pending;
  return (
    <span className={`text-caption inline-flex shrink-0 items-center gap-1 ${look.tone}`}>
      <Icon name={look.icon} size={14} strokeWidth={2.5} />
      {word}
    </span>
  );
}

/**
 * `Br 800`. Whole birr, because the product never charges fractions of one and
 * a trailing `.00` is two characters of noise on a 375px screen.
 */
function money(etb: number): string {
  return copy().paywall.price(etb);
}

/** The payment method, in the words the checkout used to offer it. */
function methodName(method: string): string {
  const c = copy();
  if (method === 'TELEBIRR') return c.checkout.telebirr;
  if (method === 'CBEBIRR') return c.checkout.cbebirr;
  if (method === 'BANK') return c.checkout.bank;
  return c.checkout.chapa;
}
