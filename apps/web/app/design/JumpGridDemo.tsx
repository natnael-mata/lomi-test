'use client';

/** The grid needs a click handler, and the gallery is a server component. */
import { JumpGrid } from '../../components/JumpGrid';

export function JumpGridDemo() {
  return (
    <JumpGrid
      currentPosition={3}
      onJump={() => undefined}
      slots={[
        { position: 1, answered: true, flagged: false },
        { position: 2, answered: false, flagged: false },
        { position: 3, answered: false, flagged: false },
        { position: 4, answered: false, flagged: true },
        { position: 5, answered: true, flagged: true },
        { position: 6, answered: true, flagged: false },
      ]}
    />
  );
}
