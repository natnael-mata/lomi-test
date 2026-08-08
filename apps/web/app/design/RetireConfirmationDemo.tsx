'use client';

/** The confirmation needs handlers, and the gallery is a server component. */
import { useState } from 'react';

import { RetireConfirmation } from '../../components/RetireConfirmation';

export function RetireConfirmationDemo() {
  const [reason, setReason] = useState('Option B is also correct.');
  return (
    <RetireConfirmation
      stableId="ACC-0142"
      radius={{ attempts: 1284, liveSittings: 3, studentsAffected: 340, measurable: true }}
      reason={reason}
      onReasonChange={setReason}
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />
  );
}
