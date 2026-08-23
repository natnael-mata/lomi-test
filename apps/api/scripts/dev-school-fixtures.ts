/**
 * The school-track demo bank, for local testing only (T-261).
 *
 * **Invented content, and not exam content.** It lives under `grade-12-natural`
 * and `grade-6` and nowhere else, so it can never be mistaken for the reviewed
 * spreadsheets that fill the real tracks.
 *
 * It exists because the restructure could not be *tried* without it. The four
 * school tracks were seeded with year spans and no questions, so coverage read
 * zero out of zero, the per-grade diagnostic had no rows, and the banded
 * leaderboard had nobody to band. Somebody clicking through to judge the design
 * has to be able to reach those screens.
 *
 * Two things every question here carries, because two features depend on them:
 *
 * - **A `sourceGrade`**, spread across the track's span. The diagnostic answers
 *   "which year is holding you back", and a bank where every question is Grade
 *   12 answers it with one row.
 * - **A concept line and at least two distinct why-wrongs.** The reason check
 *   is built from exactly those and returns null without them (T-255), so a
 *   question missing them is a question that can never be *beaten* — the demo
 *   bank would show coverage stuck at zero and look broken.
 */
import type { Fixture } from './dev-fixtures';

/** A fixture plus the school year it came from. */
export interface SchoolFixture extends Fixture {
  sourceGrade: number;
}

export interface SchoolTrack {
  fieldSlug: string;
  fieldName: string;
  minGrade: number;
  maxGrade: number;
  topics: { slug: string; name: string; course: string; weightPct: number }[];
  fixtures: SchoolFixture[];
}

/** Four options where three carry a reason, which is what the check needs. */
const mcq = (right: string, wrongs: [string, string][]): Fixture['options'] => [
  { label: 'A', text: right, isCorrect: true },
  { label: 'B', text: wrongs[0][0], whyWrong: wrongs[0][1] },
  { label: 'C', text: wrongs[1][0], whyWrong: wrongs[1][1] },
  {
    label: 'D',
    text: 'None of the above',
    whyWrong: 'One of the other options is correct, so this cannot be.',
  },
];

export const GRADE_12_NATURAL: SchoolTrack = {
  fieldSlug: 'grade-12-natural',
  fieldName: 'Grade 12 Natural',
  minGrade: 9,
  maxGrade: 12,
  topics: [
    { slug: 'g12-redox', name: 'Redox', course: 'Chemistry', weightPct: 34 },
    { slug: 'g12-motion', name: 'Motion', course: 'Physics', weightPct: 33 },
    { slug: 'g12-cells', name: 'Cells', course: 'Biology', weightPct: 33 },
  ],
  fixtures: [
    {
      stableId: 'DEV-G12-CHEM-1',
      topic: 'g12-redox',
      sourceGrade: 9,
      qType: 'CONCEPT',
      stem: 'In a redox reaction, which species is described as being oxidised?',
      conceptLine: 'Oxidation is the loss of electrons.',
      explanation: 'The species that loses electrons is oxidised; the one that gains is reduced.',
      timeLimitSec: 60,
      options: mcq('The one that loses electrons', [
        ['The one that gains electrons', 'That describes reduction, which is the opposite half.'],
        ['The one that changes state', 'A change of state is physical and moves no electrons.'],
      ]),
    },
    {
      stableId: 'DEV-G12-CHEM-2',
      topic: 'g12-redox',
      sourceGrade: 10,
      qType: 'CONCEPT',
      stem: 'What is the oxidation number of an element in its pure, uncombined form?',
      conceptLine: 'An uncombined element has an oxidation number of zero.',
      explanation: 'With no other element to share or transfer electrons with, there is no charge.',
      timeLimitSec: 60,
      options: mcq('Zero', [
        ['Its group number', 'The group number predicts likely charge in a compound, not alone.'],
        ['Always +1', 'That is the usual number for hydrogen in a compound, not for any element.'],
      ]),
    },
    {
      stableId: 'DEV-G12-CHEM-3',
      topic: 'g12-redox',
      sourceGrade: 11,
      qType: 'CONCEPT',
      stem: 'A reducing agent does what to another species?',
      conceptLine: 'A reducing agent donates electrons and is itself oxidised.',
      explanation: 'It causes reduction in something else by giving up its own electrons.',
      timeLimitSec: 60,
      options: mcq('Gives it electrons', [
        ['Takes its electrons', 'That is an oxidising agent, which is reduced itself.'],
        ['Raises its temperature', 'Redox is about electron transfer, not about heat.'],
      ]),
    },
    {
      stableId: 'DEV-G12-CHEM-4',
      topic: 'g12-redox',
      sourceGrade: 12,
      qType: 'CONCEPT',
      stem: 'Which change shows that iron has been oxidised from Fe to Fe²⁺?',
      conceptLine: 'A rise in oxidation number is oxidation.',
      explanation: 'Going from 0 to +2 means two electrons were lost.',
      timeLimitSec: 60,
      options: mcq('Its oxidation number rose from 0 to +2', [
        ['Its oxidation number fell', 'A fall is reduction, which is the other half of the pair.'],
        ['Its mass increased', 'Mass can change for many reasons and names no electron transfer.'],
      ]),
    },
    {
      stableId: 'DEV-G12-PHYS-1',
      topic: 'g12-motion',
      sourceGrade: 9,
      qType: 'CONCEPT',
      stem: 'A car travels at a constant 20 m/s in a straight line. What is its acceleration?',
      conceptLine:
        'Acceleration is the rate of change of velocity, so constant velocity means zero.',
      explanation: 'Nothing about the velocity is changing, so there is no acceleration.',
      timeLimitSec: 60,
      options: mcq('Zero', [
        ['20 m/s²', 'That is the speed with the wrong unit attached, not an acceleration.'],
        ['9.8 m/s²', 'That is gravity, which acts downward and not along the road.'],
      ]),
    },
    {
      stableId: 'DEV-G12-PHYS-2',
      topic: 'g12-motion',
      sourceGrade: 10,
      qType: 'CONCEPT',
      stem: 'Which quantity has both magnitude and direction?',
      conceptLine: 'A vector has direction; a scalar has only size.',
      explanation: 'Velocity is a vector because it states which way as well as how fast.',
      timeLimitSec: 60,
      options: mcq('Velocity', [
        ['Speed', 'Speed is how fast without which way, so it is a scalar.'],
        ['Mass', 'Mass is a scalar — a kilogram points nowhere.'],
      ]),
    },
    {
      stableId: 'DEV-G12-PHYS-3',
      topic: 'g12-motion',
      sourceGrade: 11,
      qType: 'CONCEPT',
      stem: 'An object is thrown straight up. At its highest point, what is true?',
      conceptLine: 'At the top the velocity is zero but the acceleration is still gravity.',
      explanation: 'It stops rising for an instant, but gravity never stops acting on it.',
      timeLimitSec: 60,
      options: mcq('Velocity is zero, acceleration is not', [
        ['Both are zero', 'If acceleration were zero it would hang there rather than fall back.'],
        ['Both are at a maximum', 'Velocity is at its minimum at the top, not its maximum.'],
      ]),
    },
    {
      stableId: 'DEV-G12-PHYS-4',
      topic: 'g12-motion',
      sourceGrade: 12,
      qType: 'CONCEPT',
      stem: "Newton's first law describes the behaviour of a body when...",
      conceptLine: 'With no net force, a body keeps its state of motion.',
      explanation: 'It stays at rest, or keeps moving in a straight line at a constant speed.',
      timeLimitSec: 60,
      options: mcq('no net force acts on it', [
        ['a constant force acts on it', 'A constant net force produces a constant acceleration.'],
        ['it is at rest only', 'The law covers steady motion just as much as rest.'],
      ]),
    },
    {
      stableId: 'DEV-G12-BIO-1',
      topic: 'g12-cells',
      sourceGrade: 9,
      qType: 'CONCEPT',
      stem: 'Which structure is present in a plant cell but not in an animal cell?',
      conceptLine: 'A cell wall is a plant feature; animal cells have only a membrane.',
      explanation: 'The wall is rigid cellulose outside the membrane and gives the cell its shape.',
      timeLimitSec: 60,
      options: mcq('Cell wall', [
        ['Nucleus', 'Both have a nucleus — it holds the genetic material in either.'],
        ['Mitochondrion', 'Both respire, so both carry mitochondria.'],
      ]),
    },
    {
      stableId: 'DEV-G12-BIO-2',
      topic: 'g12-cells',
      sourceGrade: 10,
      qType: 'CONCEPT',
      stem: 'What is the main role of the mitochondrion?',
      conceptLine: 'Mitochondria release energy from glucose in respiration.',
      explanation: 'They produce ATP, which is the form of energy the cell can spend.',
      timeLimitSec: 60,
      options: mcq('Releasing energy through respiration', [
        ['Making proteins', 'That is the ribosome, which assembles amino acids into chains.'],
        ['Storing genetic material', 'That is the nucleus, which holds the chromosomes.'],
      ]),
    },
    {
      stableId: 'DEV-G12-BIO-3',
      topic: 'g12-cells',
      sourceGrade: 11,
      qType: 'CONCEPT',
      stem: 'Diffusion moves a substance in which direction?',
      conceptLine: 'Diffusion moves particles from higher to lower concentration.',
      explanation: 'It needs no energy because it follows the gradient rather than fighting it.',
      timeLimitSec: 60,
      options: mcq('From high concentration to low', [
        ['From low to high', 'That is active transport, and it costs the cell energy.'],
        ['Only across a cell wall', 'Diffusion happens in air and liquid, with no wall involved.'],
      ]),
    },
    {
      stableId: 'DEV-G12-BIO-4',
      topic: 'g12-cells',
      sourceGrade: 12,
      qType: 'CONCEPT',
      stem: 'Which process produces two genetically identical daughter cells?',
      conceptLine: 'Mitosis produces two identical cells; meiosis produces four different ones.',
      explanation: 'Mitosis is for growth and repair, where a faithful copy is what is wanted.',
      timeLimitSec: 60,
      options: mcq('Mitosis', [
        ['Meiosis', 'Meiosis makes four cells with half the chromosomes, for reproduction.'],
        ['Respiration', 'Respiration releases energy and makes no cells at all.'],
      ]),
    },
  ],
};

export const GRADE_6: SchoolTrack = {
  fieldSlug: 'grade-6',
  fieldName: 'Grade 6',
  minGrade: 4,
  maxGrade: 6,
  topics: [
    { slug: 'g6-fractions', name: 'Fractions', course: 'Mathematics', weightPct: 50 },
    { slug: 'g6-plants', name: 'Plants', course: 'Environmental Science', weightPct: 50 },
  ],
  fixtures: [
    {
      stableId: 'DEV-G6-MATH-1',
      topic: 'g6-fractions',
      sourceGrade: 4,
      qType: 'CONCEPT',
      stem: 'Which fraction is the largest?',
      conceptLine: 'With the same numerator, a smaller denominator means a larger fraction.',
      explanation: 'Cutting the same whole into fewer pieces makes each piece bigger.',
      timeLimitSec: 60,
      options: mcq('1/2', [
        ['1/4', 'Quarters are smaller pieces than halves, so one of them is less.'],
        ['1/8', 'Eighths are the smallest pieces here, so one of them is the least.'],
      ]),
    },
    {
      stableId: 'DEV-G6-MATH-2',
      topic: 'g6-fractions',
      sourceGrade: 5,
      qType: 'CONCEPT',
      stem: 'What is 1/2 + 1/4?',
      conceptLine: 'Fractions can only be added once they share a denominator.',
      explanation: 'Rewrite 1/2 as 2/4, then 2/4 + 1/4 is 3/4.',
      timeLimitSec: 60,
      options: mcq('3/4', [
        ['2/6', 'That comes from adding the tops and bottoms separately, which is not addition.'],
        ['1/6', 'That is smaller than either fraction, and a sum cannot be.'],
      ]),
    },
    {
      stableId: 'DEV-G6-MATH-3',
      topic: 'g6-fractions',
      sourceGrade: 6,
      qType: 'CONCEPT',
      stem: 'Which decimal is the same as 3/4?',
      conceptLine: 'A fraction is a division: 3 divided by 4.',
      explanation: '3 ÷ 4 is 0.75.',
      timeLimitSec: 60,
      options: mcq('0.75', [
        ['0.34', 'That is the digits read off the fraction rather than the division done.'],
        ['0.43', 'That reverses the digits and still does no division.'],
      ]),
    },
    {
      stableId: 'DEV-G6-SCI-1',
      topic: 'g6-plants',
      sourceGrade: 4,
      qType: 'CONCEPT',
      stem: 'Which part of a plant takes in water from the soil?',
      conceptLine: 'Roots take up water and hold the plant in the ground.',
      explanation: 'Fine root hairs give a large surface for water to enter.',
      timeLimitSec: 60,
      options: mcq('The roots', [
        ['The leaves', 'Leaves make food and lose water; they do not draw it from soil.'],
        ['The flower', 'The flower is for reproduction and takes up nothing.'],
      ]),
    },
    {
      stableId: 'DEV-G6-SCI-2',
      topic: 'g6-plants',
      sourceGrade: 5,
      qType: 'CONCEPT',
      stem: 'What gas do plants take in for photosynthesis?',
      conceptLine: 'Photosynthesis uses carbon dioxide and gives out oxygen.',
      explanation: 'The plant combines carbon dioxide and water using light to make food.',
      timeLimitSec: 60,
      options: mcq('Carbon dioxide', [
        ['Oxygen', 'Oxygen is what photosynthesis releases, not what it uses.'],
        ['Nitrogen', 'Nitrogen is most of the air but takes no part in photosynthesis.'],
      ]),
    },
    {
      stableId: 'DEV-G6-SCI-3',
      topic: 'g6-plants',
      sourceGrade: 6,
      qType: 'CONCEPT',
      stem: 'Where in the leaf does photosynthesis mainly happen?',
      conceptLine: 'Chloroplasts hold the chlorophyll that captures light.',
      explanation: 'They are packed into the cells near the top surface, where the light is.',
      timeLimitSec: 60,
      options: mcq('In the chloroplasts', [
        ['In the nucleus', 'The nucleus stores instructions; it captures no light.'],
        ['In the cell wall', 'The wall is a rigid support and takes no part in the reaction.'],
      ]),
    },
  ],
};

export const GRADE_8: SchoolTrack = {
  fieldSlug: 'grade-8',
  fieldName: 'Grade 8',
  minGrade: 7,
  maxGrade: 8,
  topics: [
    { slug: 'g8-integers', name: 'Integers', course: 'Mathematics', weightPct: 50 },
    { slug: 'g8-matter', name: 'Matter', course: 'General Science', weightPct: 50 },
  ],
  fixtures: [
    {
      stableId: 'DEV-G8-MATH-1',
      topic: 'g8-integers',
      sourceGrade: 7,
      qType: 'CONCEPT',
      stem: 'What is (−5) + 8?',
      conceptLine: 'Adding a positive moves you to the right on the number line.',
      explanation: 'Starting at −5 and moving 8 to the right lands on 3.',
      timeLimitSec: 60,
      options: mcq('3', [
        ['−3', 'That is the answer if you subtract instead of adding.'],
        ['13', 'That adds the sizes and ignores the minus sign entirely.'],
      ]),
    },
    {
      stableId: 'DEV-G8-MATH-2',
      topic: 'g8-integers',
      sourceGrade: 8,
      qType: 'CONCEPT',
      stem: 'What is (−4) × (−6)?',
      conceptLine: 'A negative times a negative gives a positive.',
      explanation: 'The signs cancel, so the answer is 24.',
      timeLimitSec: 60,
      options: mcq('24', [
        ['−24', 'That keeps one minus sign; two negatives cancel each other.'],
        ['−10', 'That adds the numbers rather than multiplying them.'],
      ]),
    },
    {
      stableId: 'DEV-G8-SCI-1',
      topic: 'g8-matter',
      sourceGrade: 7,
      qType: 'CONCEPT',
      stem: 'Which state of matter has a fixed volume but takes the shape of its container?',
      conceptLine: 'A liquid keeps its volume and takes the shape of what holds it.',
      explanation: 'Its particles stay close together but can slide past each other.',
      timeLimitSec: 60,
      options: mcq('Liquid', [
        ['Solid', 'A solid keeps its own shape as well as its volume.'],
        ['Gas', 'A gas spreads out to fill whatever it is in, so it has no fixed volume.'],
      ]),
    },
    {
      stableId: 'DEV-G8-SCI-2',
      topic: 'g8-matter',
      sourceGrade: 8,
      qType: 'CONCEPT',
      stem: 'What happens to the mass of a substance when it melts?',
      conceptLine: 'Melting changes the state, not the amount of matter.',
      explanation: 'The particles rearrange, but none are added or lost.',
      timeLimitSec: 60,
      options: mcq('It stays the same', [
        ['It increases', 'Nothing is added during melting, so there is nothing to increase it.'],
        ['It decreases', 'Nothing escapes in a closed container; only the state changes.'],
      ]),
    },
  ],
};

export const GRADE_12_SOCIAL: SchoolTrack = {
  fieldSlug: 'grade-12-social',
  fieldName: 'Grade 12 Social',
  minGrade: 9,
  maxGrade: 12,
  topics: [
    { slug: 'g12s-landforms', name: 'Landforms', course: 'Geography', weightPct: 50 },
    { slug: 'g12s-trade', name: 'Trade', course: 'Economics', weightPct: 50 },
  ],
  fixtures: [
    {
      stableId: 'DEV-G12S-GEO-1',
      topic: 'g12s-landforms',
      sourceGrade: 9,
      qType: 'CONCEPT',
      stem: 'Which process formed the Great Rift Valley?',
      conceptLine: 'The Rift Valley formed where the crust pulled apart and the floor dropped.',
      explanation: 'Two plates moving away from each other let the block between them sink.',
      timeLimitSec: 60,
      options: mcq('Plates moving apart', [
        ['Plates colliding', 'A collision pushes crust up into mountains rather than dropping it.'],
        ['River erosion', 'A river carves a V-shaped valley, not a flat-floored rift.'],
      ]),
    },
    {
      stableId: 'DEV-G12S-GEO-2',
      topic: 'g12s-landforms',
      sourceGrade: 11,
      qType: 'CONCEPT',
      stem: 'What is the main agent shaping a delta?',
      conceptLine: 'A delta is built by deposition where a river slows at its mouth.',
      explanation: 'Losing speed, the river drops the sediment it was carrying.',
      timeLimitSec: 60,
      options: mcq('Deposition by a river', [
        ['Wind erosion', 'Wind shapes dunes in dry places, not the mouth of a river.'],
        ['Glacial scouring', 'A glacier carves valleys inland; a delta forms where water slows.'],
      ]),
    },
    {
      stableId: 'DEV-G12S-ECON-1',
      topic: 'g12s-trade',
      sourceGrade: 10,
      qType: 'CONCEPT',
      stem: 'What does a country have when it can produce a good at a lower opportunity cost?',
      conceptLine: 'Comparative advantage is about opportunity cost, not raw output.',
      explanation: 'It gives up less of something else to make the good.',
      timeLimitSec: 60,
      options: mcq('Comparative advantage', [
        ['Absolute advantage', 'That is producing more of it, which is a different comparison.'],
        ['A trade surplus', 'A surplus is about what it sells abroad, not what it gives up.'],
      ]),
    },
    {
      stableId: 'DEV-G12S-ECON-2',
      topic: 'g12s-trade',
      sourceGrade: 12,
      qType: 'CONCEPT',
      stem: 'What is a tariff?',
      conceptLine: 'A tariff is a tax on imported goods.',
      explanation: 'It raises the price of what comes in from abroad.',
      timeLimitSec: 60,
      options: mcq('A tax on imports', [
        [
          'A limit on import quantity',
          'That is a quota, which caps volume rather than adding cost.',
        ],
        [
          'A payment to exporters',
          'That is a subsidy, which lowers a price rather than raising one.',
        ],
      ]),
    },
  ],
};

export const SCHOOL_TRACKS: SchoolTrack[] = [GRADE_12_NATURAL, GRADE_12_SOCIAL, GRADE_8, GRADE_6];
