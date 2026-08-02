import { describe, expect, it } from 'vitest';

import { chipClasses, type ChipTone } from './Chip';

describe('chipClasses (T-095)', () => {
  it('is a bare chip when neutral', () => {
    expect(chipClasses()).toBe('chip');
    expect(chipClasses('neutral')).toBe('chip');
  });

  // The semantic tones are never remapped — a student who learns that green
  // means correct must not meet a green that means something else two screens on.
  it('pairs each state with its own soft fill and text colour', () => {
    expect(chipClasses('correct')).toBe('chip bg-correct-soft text-correct');
    expect(chipClasses('wrong')).toBe('chip bg-wrong-soft text-wrong');
    expect(chipClasses('pending')).toBe('chip bg-pending-soft text-pending');
    expect(chipClasses('brand')).toBe('chip bg-brand-soft text-brand');
  });

  // Reward is the exception: a solid fill with fixed ink, because white on
  // yellow fails contrast in both themes.
  it('gives reward a solid fill with on-reward ink', () => {
    expect(chipClasses('reward')).toBe('chip bg-reward-fill text-on-reward');
  });

  it('appends a caller class', () => {
    expect(chipClasses('correct', 'ml-2')).toBe('chip bg-correct-soft text-correct ml-2');
  });

  it('covers every tone', () => {
    const tones: ChipTone[] = ['neutral', 'correct', 'wrong', 'pending', 'brand', 'reward'];
    for (const tone of tones) expect(chipClasses(tone).startsWith('chip')).toBe(true);
  });
});
