'use client';

/**
 * Where Chapa's hosted page sends the student back to (T-142, T-154).
 *
 * **Everything in this URL is untrusted.** Chapa appends `trx_ref` and a
 * `status`, and a student can type the same URL with `status=success` in five
 * seconds. So the `status` parameter is read and ignored: the reference is used
 * to *ask our own server*, which asks Chapa. This page reports; it never
 * decides.
 *
 * It also has to work when the student closed the tab and came back later, which
 * is why it holds no state of its own — the reference in the URL is enough.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Card } from '../../../components/Card';
import { api } from '../../../lib/api';
import { copy } from '../../../lib/i18n';

const POLL_MS = 3_000;
const SLOW_AFTER_MS = 45_000;

export function ReturnScreen() {
  const c = copy();
  const params = useSearchParams();
  // Chapa has used both spellings. Ours is the one we minted, so either is fine
  // as long as the server recognises it — and it will not recognise a made-up
  // one.
  const txRef = params.get('trx_ref') ?? params.get('tx_ref') ?? '';

  const [status, setStatus] = useState<'waiting' | 'confirmed'>('waiting');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (txRef === '') return;
    let live = true;
    const startedAt = Date.now();

    const ask = async (): Promise<void> => {
      try {
        const result = await api.paymentStatus(txRef);
        if (!live) return;
        if (result.status === 'CONFIRMED') {
          setStatus('confirmed');
          setExpiresAt(result.expiresAt);
          return;
        }
      } catch {
        // A failed poll is not a failed payment.
      }
      if (live && Date.now() - startedAt > SLOW_AFTER_MS) setSlow(true);
    };

    void ask();
    const timer = setInterval(() => void ask(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [txRef]);

  if (status === 'confirmed') {
    return (
      <Card as="section" className="flex flex-col gap-2">
        <h1 className="text-title">{c.checkout.confirmed}</h1>
        {expiresAt ? (
          <p className="text-body text-ink-2">
            {c.checkout.accessUntil(new Date(expiresAt).toLocaleDateString())}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card as="section" className="flex flex-col gap-3" aria-live="polite">
      <p className="text-body">{c.checkout.openingChapa}</p>
      {slow ? <p className="text-body text-ink-2">{c.checkout.stillWaiting}</p> : null}
      {txRef ? <p className="text-caption text-ink-2">{c.checkout.yourReference(txRef)}</p> : null}
    </Card>
  );
}
