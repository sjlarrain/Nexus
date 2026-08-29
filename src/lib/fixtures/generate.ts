import { emptyProfile, type Profile } from '@/lib/schemas/profile';
import { PHOTO_SLOTS, LIMITS, type HelpKind } from '@/lib/refdata/constants';
import { CITIES_BY_STATE, formatCity, type StateCode } from '@/lib/refdata/locations';
import {
  FUNCTIONS,
  INDUSTRIES,
  INTERESTS,
  TITLES_BY_FUNCTION,
  type FunctionName,
} from '@/lib/refdata/taxonomy';
import { industryForCompany, knownCompanies, suggestCompanies } from '@/lib/refdata/peer-map';
import { OPEN_TO } from '@/lib/refdata/constants';

/**
 * Fixture people for the demo deck (BACKLOG E1b.1).
 *
 * Deterministic: the same seed always produces the same population, so a demo can be
 * rehearsed and a failing test can be reproduced. That rules out Math.random.
 */

/** mulberry32 — small, fast, and good enough for fixtures. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = () => number;

function pick<T>(random: Random, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  // Invariant: callers only pass non-empty arrays; the index is always in range.
  if (item === undefined) throw new Error('pick() called with an empty array');
  return item;
}

function pickSome<T>(random: Random, items: readonly T[], min: number, max: number): T[] {
  const count = Math.min(items.length, min + Math.floor(random() * (max - min + 1)));
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(random() * pool.length);
    const [taken] = pool.splice(index, 1);
    if (taken !== undefined) out.push(taken);
  }
  return out;
}

const FIRST_NAMES = [
  'Jordan', 'Daniel', 'Priya', 'Marcus', 'Elena', 'Wei', 'Amara', 'Diego', 'Nina', 'Omar',
  'Sofia', 'Andre', 'Leila', 'Tomas', 'Grace', 'Rahul', 'Maya', 'Caleb', 'Yuki', 'Isabel',
  'Noah', 'Zara', 'Felix', 'Aisha', 'Lucas', 'Hana', 'Ethan', 'Camila', 'Ivan', 'Rosa',
  'Malik', 'Anya', 'Theo', 'Nadia', 'Sam', 'Farah', 'Julian', 'Mei', 'Adrian', 'Tessa',
];

const LAST_NAMES = [
  'Reyes', 'Okafor', 'Shah', 'Bennett', 'Rossi', 'Zhang', 'Okonkwo', 'Alvarez', 'Petrova', 'Haddad',
  'Moreau', 'Silva', 'Nakamura', 'Brennan', 'Osei', 'Kapoor', 'Lindqvist', 'Duarte', 'Kim', 'Ferreira',
  'Novak', 'Ahmed', 'Weber', 'Diallo', 'Costa', 'Tanaka', 'Murphy', 'Vargas', 'Sokolov', 'Mendes',
];

const HEADLINE_TEMPLATES = [
  'Happy to open doors at {company} for people breaking into {lane}.',
  '{years} years in {industry}. Ask me about {lane} interviews.',
  'Built the {lane} team at {company}. I answer every message.',
  'Ex-{industry} consultant, now {role}. Referrals are easy to ask for.',
  'I got here through a warm intro. Paying it back.',
  'Looking for my next {lane} role. Also glad to refer at {company}.',
  '{role} at {company}. Coffee beats a cold email.',
];

const PROMPT_1 = [
  'The intro I wish someone had made for me',
  'A referral I am glad I asked for',
  'What I look for before I refer someone',
];
const PROMPT_2 = [
  'Ask me about breaking into this industry',
  'The part of my job nobody warns you about',
  'How I actually got this role',
];
const PROMPT_3 = [
  'Coffee order',
  'What I do when I am not working',
  'The best career advice I ignored',
];

const SCHOOLS = [
  'UT Austin', 'Stanford', 'UC Berkeley', 'NYU', 'Columbia', 'Michigan', 'Georgia Tech',
  'Northwestern', 'UCLA', 'Carnegie Mellon', 'Duke', 'Cornell', 'USC', 'Wharton', 'MIT',
];

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

export type Fixture = {
  uid: string;
  email: string;
  profile: Profile;
};

/** Photos point at a deterministic placeholder service (BACKLOG E1b.2). */
function photosFor(uid: string): Profile['photos'] {
  return PHOTO_SLOTS.map((slot) => ({
    slot,
    url: `https://picsum.photos/seed/${uid}-${slot}/600/800`,
    storagePath: `users/${uid}/photos/${slot}`,
  }));
}

export function generateFixture(index: number, seed = 1): Fixture {
  const random = rng(seed * 7919 + index * 104729);

  const first = pick(random, FIRST_NAMES);
  const last = pick(random, LAST_NAMES);
  const uid = `demo-${String(index).padStart(3, '0')}`;

  const state = pick(random, Object.keys(CITIES_BY_STATE)) as StateCode;
  const city = formatCity(pick(random, CITIES_BY_STATE[state]), state);

  const lane: FunctionName = pick(random, FUNCTIONS);
  const titles = TITLES_BY_FUNCTION[lane] ?? [lane];
  const role = pick(random, titles);
  const company = pick(random, knownCompanies());
  const industry = industryForCompany(company);
  const years = pick(random, ['0-1', '2-3', '4-6', '7-10', '10+'] as const);

  // Roughly: 60% working, 20% student, 20% looking out — a deck that skews toward
  // people who can actually open a door.
  const roll = random();
  const mode = roll < 0.6 ? 'working' : roll < 0.8 ? 'student' : 'looking';

  const doors = mode === 'student' ? [] : suggestCompanies(company, [], 3 + Math.floor(random() * 3));
  const will: Record<string, HelpKind> = {};
  for (const door of doors) {
    will[door] = random() < 0.6 ? 'Happy to refer' : 'Happy to chat';
  }

  const direction =
    mode === 'looking' ? 'looking' : mode === 'student' ? 'looking' : random() < 0.4 ? 'both' : 'refer';

  const headline = fill(pick(random, HEADLINE_TEMPLATES), {
    company,
    lane,
    industry,
    role,
    years,
  }).slice(0, LIMITS.headlineChars);

  const schools =
    mode === 'student' || random() < 0.5
      ? [
          {
            name: pick(random, SCHOOLS),
            course: pick(random, ['Undergraduate', 'MBA', 'MS', 'MSBA'] as const),
            year: String(2024 + Math.floor(random() * 5)),
          },
        ]
      : [];

  return {
    uid,
    email: `${first.toLowerCase()}.${last.toLowerCase()}.${index}@warmintro.test`,
    profile: {
      ...emptyProfile(),
      first,
      last,
      photos: photosFor(uid),
      headline,
      city,
      stateName: state,
      schools,
      mode,
      company,
      role: mode === 'student' ? '' : role,
      industry,
      lane,
      years: mode === 'student' ? '' : years,
      school2: '',
      gradYear: '',
      referCompanies: doors,
      will,
      industries: pickSome(random, INDUSTRIES, 1, LIMITS.industries),
      lanes: pickSome(random, FUNCTIONS, 1, LIMITS.roles),
      targetCompanies: suggestCompanies(company, [], 3),
      interests: pickSome(random, INTERESTS, 3, LIMITS.interests),
      openTo: pickSome(random, OPEN_TO, 2, 4),
      bio: `${first} works in ${lane.toLowerCase()} and is happy to trade notes over a 30-minute coffee.`,
      direction,
      p1: pick(random, PROMPT_1),
      p2: pick(random, PROMPT_2),
      p3: pick(random, PROMPT_3),
    },
  };
}

export function generatePopulation(count: number, seed = 1): Fixture[] {
  return Array.from({ length: count }, (_, i) => generateFixture(i + 1, seed));
}

/**
 * The two people named in the spec's demo data. Fixed uids so a demo script can
 * always sign in as Jordan and always find Daniel (BACKLOG E1b.6).
 */
export const DEMO_VIEWER_UID = 'demo-jordan';
export const DEMO_COUNTERPART_UID = 'demo-daniel';

export function demoViewer(): Fixture {
  return {
    uid: DEMO_VIEWER_UID,
    email: 'jordan.reyes@warmintro.test',
    profile: {
      ...emptyProfile(),
      first: 'Jordan',
      last: 'Reyes',
      photos: photosFor(DEMO_VIEWER_UID),
      headline: 'Product Designer at Figma. Happy to refer designers who show their work.',
      city: 'San Francisco, CA',
      stateName: 'CA',
      schools: [{ name: 'UT Austin', course: 'Undergraduate', year: '2019' }],
      mode: 'working',
      company: 'Figma',
      role: 'Product Designer',
      industry: 'Software',
      lane: 'Product Design',
      years: '4-6',
      referCompanies: ['Notion', 'Canva', 'Adobe', 'Linear', 'Airtable'],
      will: {
        Notion: 'Happy to refer',
        Canva: 'Happy to refer',
        Adobe: 'Happy to chat',
        Linear: 'Happy to refer',
        Airtable: 'Happy to chat',
      },
      industries: ['Software', 'Consumer', 'Enterprise SaaS'],
      lanes: ['Product Design', 'Product Management'],
      targetCompanies: ['Notion', 'Linear', 'Stripe'],
      interests: ['Coffee', 'Climbing', 'Film', 'Pottery'],
      openTo: ['Referrals', 'Mock interviews', 'Career advice'],
      bio: 'Designer at Figma. I got my first job through a warm intro and I have been paying it back since.',
      direction: 'both',
      p1: 'The intro I wish someone had made for me',
      p2: 'Ask me about breaking into product design',
      p3: 'Coffee order: cortado, no sugar',
    },
  };
}

export function demoCounterpart(): Fixture {
  return {
    uid: DEMO_COUNTERPART_UID,
    email: 'daniel.okafor@warmintro.test',
    profile: {
      ...emptyProfile(),
      first: 'Daniel',
      last: 'Okafor',
      photos: photosFor(DEMO_COUNTERPART_UID),
      headline: 'Senior PM at DoorDash. I answer every message and I refer often.',
      city: 'San Francisco, CA',
      stateName: 'CA',
      schools: [{ name: 'Michigan', course: 'MBA', year: '2021' }],
      mode: 'working',
      company: 'DoorDash',
      role: 'Senior Product Manager',
      industry: 'Marketplaces',
      lane: 'Product Management',
      years: '7-10',
      referCompanies: ['Uber', 'Instacart', 'Gopuff', 'Lyft'],
      will: {
        Uber: 'Happy to refer',
        Instacart: 'Happy to refer',
        Gopuff: 'Happy to chat',
        Lyft: 'Happy to chat',
      },
      industries: ['Marketplaces', 'Consumer', 'Logistics & Supply Chain'],
      lanes: ['Product Management', 'Strategy'],
      targetCompanies: ['Figma', 'Notion', 'Stripe'],
      interests: ['Running', 'Cooking', 'Podcasts', 'Basketball'],
      openTo: ['Referrals', 'Career advice', 'Industry intel'],
      bio: 'PM at DoorDash working on merchant tools. Ask me how referrals really work inside a big company.',
      direction: 'refer',
      p1: 'What I look for before I refer someone',
      p2: 'How I actually got this role',
      p3: 'The best career advice I ignored',
    },
  };
}
