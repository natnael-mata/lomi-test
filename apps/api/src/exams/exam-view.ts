/**
 * What a student may see **during** a sitting.
 *
 * The rule is stricter than practice's. `GET /questions/next` withholds answer
 * content until an attempt; an exam withholds it until the sitting **closes**.
 * So these payloads carry no correctness of any kind, and — because
 * `SittingAnswer` has no correctness column at all — there is nothing on the row
 * a future `select` could accidentally leak.
 *
 * Declared as field lists with compile-time exhaustiveness, the same as
 * `question-view.ts` and `answer-view.ts`, so a field added here fails a test
 * rather than shipping.
 */
import type { ServedQuestion } from '../practice/question-view';
import type { SittingClock } from './sitting-clock';

/** One slot on the paper, as the jump grid sees it. Carries no question text. */
export interface SittingSlot {
  position: number;
  answered: boolean;
  flagged: boolean;
}

export const SITTING_SLOT_FIELDS = ['position', 'answered', 'flagged'] as const;

/** The whole paper's shape: where the student is, and what is left. */
export interface SittingManifest {
  sittingId: string;
  examName: string;
  totalQuestions: number;
  answeredCount: number;
  flaggedCount: number;
  clock: SittingClock;
  slots: SittingSlot[];
}

export const SITTING_MANIFEST_FIELDS = [
  'sittingId',
  'examName',
  'totalQuestions',
  'answeredCount',
  'flaggedCount',
  'clock',
  'slots',
] as const;

/**
 * One question, as it appears during a sitting.
 *
 * Reuses `ServedQuestion` — the same shape practice serves before an attempt —
 * rather than declaring a second pre-answer payload that could drift from it.
 * What is added is only about this student's progress through the paper.
 */
export interface SittingItem {
  position: number;
  totalQuestions: number;
  question: ServedQuestion;
  /** What the student has picked so far, or null. Never whether it is right. */
  chosenLabel: string | null;
  flagged: boolean;
  clock: SittingClock;
}

export const SITTING_ITEM_FIELDS = [
  'position',
  'totalQuestions',
  'question',
  'chosenLabel',
  'flagged',
  'clock',
] as const;

type SlotFieldsCover = Exclude<keyof SittingSlot, (typeof SITTING_SLOT_FIELDS)[number]>;
type SlotTypeCovers = Exclude<(typeof SITTING_SLOT_FIELDS)[number], keyof SittingSlot>;
type ManifestFieldsCover = Exclude<keyof SittingManifest, (typeof SITTING_MANIFEST_FIELDS)[number]>;
type ManifestTypeCovers = Exclude<(typeof SITTING_MANIFEST_FIELDS)[number], keyof SittingManifest>;
type ItemFieldsCover = Exclude<keyof SittingItem, (typeof SITTING_ITEM_FIELDS)[number]>;
type ItemTypeCovers = Exclude<(typeof SITTING_ITEM_FIELDS)[number], keyof SittingItem>;

export const _slotFieldsCover: SlotFieldsCover extends never ? true : false = true;
export const _slotTypeCovers: SlotTypeCovers extends never ? true : false = true;
export const _manifestFieldsCover: ManifestFieldsCover extends never ? true : false = true;
export const _manifestTypeCovers: ManifestTypeCovers extends never ? true : false = true;
export const _itemFieldsCover: ItemFieldsCover extends never ? true : false = true;
export const _itemTypeCovers: ItemTypeCovers extends never ? true : false = true;
