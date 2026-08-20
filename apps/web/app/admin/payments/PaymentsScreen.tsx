'use client';

/**
 * Settling claimed bank transfers (T-224, design handoff 2g).
 *
 * **The screen that decides whether a student who paid by transfer waits an
 * hour or a week.** `POST /admin/payments/:id/confirm` and `.../reject` have
 * existed since T-152; without a screen, settling a payment meant a developer
 * with a database client, so every transfer waited on one person being at a
 * laptop with credentials.
 *
 * The design gives admin 1200px and a real table, and that is not decoration:
 * an operator does this with a bank statement open beside them, and the job is
 * matching a reference and an amount across two windows. So the columns are the
 * things being matched — claimed, student, phone, reference, amount — in
 * tabular figures, and the open row restates all of them rather than assuming
 * the header is still in view.
 *
 * Two rules the buttons obey:
 *
 * - **Approve is Correct green, reject is Wrong red, and brand violet appears
 *   nowhere near either.** Violet marks the operator's current row and nothing
 *   else; a verdict in the brand colour is the Separation Rule broken on the
 *   one screen where a mistake moves money.
 * - **A reject needs a reason and says so before it is pressed.** The student
 *   is told that reason, and "rejected" with no explanation is not something a
 *   support conversation can start from.
 */
import { useCallback, useEffect, useState } from 'react';

import { Button } from '../../../components/Button';
import { Icon, type IconName } from '../../../components/icons';
import { api, refusalMessage, type ManualClaim } from '../../../lib/api';
import { dayAndTime } from '../../../lib/dates';
import { copy } from '../../../lib/i18n';

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; claims: ManualClaim[] }
  | { kind: 'error'; message: string };

const STATUS: Record<string, { tone: string; icon: IconName }> = {
  CONFIRMED: { tone: 'text-correct', icon: 'check' },
  PENDING: { tone: 'text-pending', icon: 'clock' },
  REJECTED: { tone: 'text-wrong', icon: 'cross' },
};

/** The grid, declared once. Header and rows must not drift apart. */
const COLUMNS = 'grid-cols-[150px_1fr_150px_180px_110px_120px]';

export function PaymentsScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const claims = await api.adminClaims();
      setPhase({ kind: 'ready', claims });
    } catch (error) {
      setPhase({
        kind: 'error',
        message: refusalMessage(error) ?? c.admin.payments.couldNotLoad,
      });
    }
  }, [c.admin.payments.couldNotLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  const settle = async (claim: ManualClaim, approve: boolean): Promise<void> => {
    // Checked here as well as on the server, so the operator is told before the
    // round trip rather than after it.
    if (!approve && reason.trim().length === 0) {
      setNotice(c.admin.payments.rejectNeedsReason);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (approve) await api.adminConfirmPayment(claim.paymentId, reason.trim());
      else await api.adminRejectPayment(claim.paymentId, reason.trim());
      setReason('');
      setOpen(null);
      setNotice(c.admin.payments.settled);
      await load();
    } catch {
      setNotice(c.admin.payments.couldNotSettle);
    } finally {
      setBusy(false);
    }
  };

  if (phase.kind === 'loading')
    return <p className="text-body text-ink-2">{c.admin.payments.working}</p>;
  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body">{phase.message}</p>
        <Button variant="ghost" onClick={() => void load()}>
          {c.common.tryAgain}
        </Button>
      </div>
    );
  }

  const waiting = phase.claims.filter((claim) => claim.status === 'PENDING').length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title">{c.admin.payments.title}</h1>
        <span className="bg-pending-soft text-pending text-caption inline-flex items-center gap-1.5 rounded-full px-3 py-1 uppercase">
          <Icon name="clock" size={14} />
          {c.admin.payments.waiting(waiting)}
        </span>
      </header>

      {notice ? (
        <p className="text-body" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {phase.claims.length === 0 ? (
        <p className="text-body text-ink-2">{c.admin.payments.nothingWaiting}</p>
      ) : (
        /* Scrolls inside its own container, so the page never moves sideways
           — the six columns need about 900px and a laptop is not always wider. */
        <div className="overflow-x-auto">
          <div className="bg-surface rounded-card shadow-card min-w-[900px] overflow-hidden">
            <div
              className={`${COLUMNS} border-border text-caption text-ink-2 grid gap-4 border-b px-5 py-3 uppercase`}
            >
              <span>{c.admin.payments.colClaimed}</span>
              <span>{c.admin.payments.colStudent}</span>
              <span>{c.admin.payments.colPhone}</span>
              <span>{c.admin.payments.colReference}</span>
              <span className="text-right">{c.admin.payments.colAmount}</span>
              <span>{c.admin.payments.colStatus}</span>
            </div>

            {phase.claims.map((claim) => (
              <div key={claim.paymentId} data-claim={claim.txRef}>
                <button
                  type="button"
                  aria-expanded={open === claim.paymentId}
                  aria-label={
                    open === claim.paymentId ? c.admin.payments.close : c.admin.payments.open
                  }
                  onClick={() => {
                    setOpen(open === claim.paymentId ? null : claim.paymentId);
                    setReason(claim.note ?? '');
                    setNotice(null);
                  }}
                  className={[
                    COLUMNS,
                    'border-border text-body num grid w-full items-center gap-4 border-b px-5 py-3.5 text-left',
                    // Brand Soft = the row the operator is on. Never a verdict.
                    open === claim.paymentId ? 'bg-brand-soft' : '',
                    claim.status === 'PENDING' ? '' : 'text-ink-2',
                  ].join(' ')}
                >
                  <span>{dayAndTime(claim.claimedAt)}</span>
                  <span className="font-semibold">{claim.student ?? '—'}</span>
                  <span>{claim.phone ?? '—'}</span>
                  <span>{claim.txRef}</span>
                  <span className="text-right font-semibold">
                    {c.paywall.price(claim.amountEtb)}
                  </span>
                  <Status status={claim.status} />
                </button>

                {open === claim.paymentId ? (
                  <div className="bg-bg border-border flex flex-wrap items-start gap-6 border-b p-5">
                    <div className="flex min-w-[320px] flex-1 flex-col gap-2">
                      <span className="text-caption text-ink-2 uppercase">
                        {c.admin.payments.checkAgainst}
                      </span>
                      <p className="text-body num">
                        {BANK_ACCOUNT
                          ? c.admin.payments.expected(
                              claim.txRef,
                              c.paywall.price(claim.amountEtb),
                              BANK_ACCOUNT,
                            )
                          : c.admin.payments.expectedNoAccount(
                              claim.txRef,
                              c.paywall.price(claim.amountEtb),
                            )}
                      </p>
                      <p className="text-body text-ink-2">
                        {c.admin.payments.claimedBy(
                          claim.student ?? '—',
                          claim.joinedAt ? dayAndTime(claim.joinedAt) : '—',
                        )}{' '}
                        {claim.priorPayments > 0
                          ? c.admin.payments.priorPayments(claim.priorVerified, claim.priorPayments)
                          : c.admin.payments.noPriorPayments}
                      </p>

                      <label className="mt-2 flex max-w-[520px] flex-col gap-1.5">
                        <span className="text-caption text-ink-2 uppercase">
                          {c.admin.payments.reasonLabel}
                        </span>
                        <input
                          className="field"
                          value={reason}
                          placeholder={c.admin.payments.reasonPlaceholder}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="flex w-[260px] shrink-0 flex-col gap-2">
                      {/* Correct green, not brand violet: this is a verdict. */}
                      <button
                        type="button"
                        className="bg-correct text-on-state rounded-control text-label inline-flex min-h-[52px] w-full items-center justify-center gap-2 px-6 disabled:opacity-60"
                        disabled={busy || claim.status !== 'PENDING'}
                        onClick={() => void settle(claim, true)}
                      >
                        <Icon name="check" size={18} strokeWidth={2.5} />
                        {busy ? c.admin.payments.approving : c.admin.payments.approve}
                      </button>
                      <button
                        type="button"
                        className="border-wrong text-wrong bg-surface rounded-control text-label inline-flex min-h-[52px] w-full items-center justify-center gap-2 border-2 px-6 disabled:opacity-60"
                        disabled={busy || claim.status !== 'PENDING'}
                        onClick={() => void settle(claim, false)}
                      >
                        <Icon name="cross" size={16} strokeWidth={2.5} />
                        {busy ? c.admin.payments.rejecting : c.admin.payments.reject}
                      </button>
                      <p className="text-caption text-ink-2">{c.admin.payments.approveNote}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The same account the checkout tells students to pay into, or nothing. */
const BANK_ACCOUNT = process.env.NEXT_PUBLIC_BANK_ACCOUNT ?? '';

function Status({ status }: { status: string }) {
  const c = copy();
  const look = STATUS[status] ?? STATUS.PENDING!;
  const word =
    status === 'CONFIRMED'
      ? c.receipt.verified
      : status === 'REJECTED'
        ? c.receipt.notAccepted
        : c.receipt.pending;
  return (
    <span className={`text-caption inline-flex items-center gap-1.5 ${look.tone}`}>
      <Icon name={look.icon} size={14} strokeWidth={2.5} />
      {word}
    </span>
  );
}
