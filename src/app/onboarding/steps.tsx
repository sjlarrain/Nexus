'use client';

import { Chip, ChipRow, Field, Input, SelectGrid } from '@/components/ui';
import {
  COURSE_TYPES,
  HELP_KINDS,
  LIMITS,
  OPEN_TO,
  PHOTO_SLOTS,
  PHOTO_SLOT_LABELS,
  YEARS_BANDS,
  type CourseType,
  type HelpKind,
  type Mode,
} from '@/lib/refdata/constants';
import { INDUSTRIES, FUNCTIONS, INTERESTS } from '@/lib/refdata/taxonomy';
import { CITIES_BY_STATE, STATE_NAMES, formatCity, parseCity } from '@/lib/refdata/locations';
import { suggestCompanies } from '@/lib/refdata/peer-map';
import { hatchClass, hatchWarmClass } from '@/components/ui';
import type { Profile } from '@/lib/schemas/profile';
import styles from './onboarding.module.css';
import { useState } from 'react';

/**
 * The five onboarding steps (spec section 2), in the shape of mock 1g: one question
 * per screen, big heading, options below, progress across the top.
 *
 * Each step is a pure-ish component over the merged draft. Gating is not their job —
 * `gateForStep()` already owns it and the page reads it for the button label.
 */

export type StepProps = {
  draft: Profile;
  patch: (fields: Partial<Profile>) => void;
};

export const STEP_HEADINGS: Record<number, { title: string; sub: string }> = {
  1: {
    title: 'Who are you?',
    sub: 'This is the top of your card. Three photos and a line about you.',
  },
  2: {
    title: 'Where are you today?',
    sub: 'It only decides what your card leads with. You can change it any week.',
  },
  3: {
    title: 'What are you looking for?',
    sub: 'We use this to rank who you see, and who sees you.',
  },
  4: { title: 'A little colour', sub: 'Skippable. It gives people something to open with.' },
  5: { title: 'Review your card', sub: 'This is exactly what other people will see.' },
};

/* ================================================================== */
/* Step 1 — Who are you?                                              */
/* ================================================================== */

/**
 * Photo upload is E5 and blocked on Firebase Storage (Blaze). Until then a slot can
 * be filled with a deterministic placeholder, so someone signing up during a demo
 * can still get past the three-photo gate. Clearly labelled as a placeholder — see
 * docs/decisions.md.
 */
function placeholderPhoto(slot: string, seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(`${seed}-${slot}`)}/600/800`;
}

export function Step1({ draft, patch }: StepProps) {
  const [school, setSchool] = useState<{ name: string; course: CourseType; year: string } | null>(
    null,
  );

  const parsed = parseCity(draft.city);
  const stateCode = parsed?.state ?? (draft.stateName as keyof typeof CITIES_BY_STATE | '');
  const cities = stateCode ? (CITIES_BY_STATE[stateCode] ?? []) : [];
  const seed = `${draft.first || 'you'}-${draft.last || 'here'}`.toLowerCase();

  function setPhoto(slot: (typeof PHOTO_SLOTS)[number]): void {
    const without = draft.photos.filter((photo) => photo.slot !== slot);
    patch({
      photos: [
        ...without,
        { slot, url: placeholderPhoto(slot, seed), storagePath: `users/pending/photos/${slot}` },
      ],
    });
  }

  return (
    <>
      <Field label={`Photos · ${draft.photos.length} of ${LIMITS.photos}`}>
        <div className={styles.photos}>
          {PHOTO_SLOTS.map((slot, index) => {
            const photo = draft.photos.find((candidate) => candidate.slot === slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setPhoto(slot)}
                className={`${styles.photoSlot} ${index % 2 === 0 ? hatchClass : hatchWarmClass}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photo ? <img src={photo.url} alt="" /> : null}
                <span className={styles.photoSlotLabel}>{PHOTO_SLOT_LABELS[slot]}</span>
              </button>
            );
          })}
        </div>
        <p className={styles.status}>
          Tap a slot to use a placeholder. Real uploads arrive with photo storage.
        </p>
      </Field>

      <div className={styles.row}>
        <Field label="First name">
          <Input value={draft.first} onChange={(e) => patch({ first: e.target.value })} />
        </Field>
        <Field label="Last name">
          <Input value={draft.last} onChange={(e) => patch({ last: e.target.value })} />
        </Field>
      </div>

      <Field label="Headline">
        <Input
          value={draft.headline}
          maxLength={LIMITS.headlineChars}
          placeholder="Product Designer at Figma. Happy to refer."
          onChange={(e) => patch({ headline: e.target.value })}
        />
        <span
          className={`${styles.counter} ${
            draft.headline.length >= LIMITS.headlineChars ? styles.counterOver : ''
          }`}
        >
          {draft.headline.length} / {LIMITS.headlineChars}
        </span>
      </Field>

      <div className={styles.row}>
        <Field label="State">
          <select
            className={styles.select}
            value={stateCode}
            /* Spec section 2: changing state clears the city. */
            onChange={(e) => patch({ stateName: e.target.value, city: '' })}
          >
            <option value="">Choose a state</option>
            {Object.entries(STATE_NAMES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <select
            className={styles.select}
            value={parsed?.city ?? ''}
            disabled={!stateCode}
            onChange={(e) =>
              patch({
                city: e.target.value
                  ? formatCity(e.target.value, stateCode as keyof typeof CITIES_BY_STATE)
                  : '',
              })
            }
          >
            <option value="">{stateCode ? 'Choose a city' : 'Pick a state first'}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="LinkedIn (optional)">
        <Input
          value={draft.linkedin}
          placeholder="linkedin.com/in/…"
          onChange={(e) => patch({ linkedin: e.target.value })}
        />
      </Field>

      <Field label={`Education (optional, up to ${LIMITS.schools})`}>
        {draft.schools.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className={styles.listRow}>
            <p>
              {entry.name}
              <small>
                {entry.course} · Class of {entry.year}
              </small>
            </p>
            <button
              type="button"
              aria-label={`Remove ${entry.name}`}
              className={styles.remove}
              onClick={() => patch({ schools: draft.schools.filter((_, i) => i !== index) })}
            >
              ×
            </button>
          </div>
        ))}

        {school ? (
          <div className={styles.listRow} style={{ display: 'block' }}>
            <ChipRow>
              {COURSE_TYPES.map((course) => (
                <button key={course} type="button" onClick={() => setSchool({ ...school, course })}>
                  <Chip tone={school.course === course ? 'solid' : 'default'}>{course}</Chip>
                </button>
              ))}
            </ChipRow>
            <div className={styles.row} style={{ marginTop: 10 }}>
              <Input
                value={school.name}
                placeholder="College"
                onChange={(e) => setSchool({ ...school, name: e.target.value })}
              />
              <Input
                value={school.year}
                placeholder="Batch year"
                onChange={(e) => setSchool({ ...school, year: e.target.value })}
              />
            </div>
            <div className={styles.doorHelp}>
              <button type="button" onClick={() => setSchool(null)}>
                <Chip>Cancel</Chip>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!school.name.trim()) return;
                  patch({ schools: [...draft.schools, school] });
                  setSchool(null);
                }}
              >
                <Chip tone="solid">Save school</Chip>
              </button>
            </div>
          </div>
        ) : draft.schools.length < LIMITS.schools ? (
          <button
            type="button"
            onClick={() => setSchool({ name: '', course: 'Undergraduate', year: '' })}
          >
            <Chip>+ Add new school</Chip>
          </button>
        ) : null}
      </Field>
    </>
  );
}

/* ================================================================== */
/* Step 2 — Where are you today?                                      */
/* ================================================================== */

const MODE_OPTIONS: { mode: Mode; title: string; blurb: string }[] = [
  {
    mode: 'working',
    title: 'I am working',
    blurb: 'Your card shows where you are and the teams you can vouch for.',
  },
  {
    mode: 'student',
    title: 'I am a student',
    blurb: 'Your card leads with your course and school.',
  },
  {
    mode: 'looking',
    title: 'I am looking out',
    blurb: 'Your card leads with target roles and your pitch.',
  },
];

export function Step2({ draft, patch }: StepProps) {
  const [custom, setCustom] = useState('');
  // Already-chosen companies are passed so the suggestions never repeat them.
  const doors = suggestCompanies(draft.company, draft.referCompanies, 8);

  function toggleDoor(company: string): void {
    const on = draft.referCompanies.includes(company);
    const will = { ...draft.will };
    if (on) delete will[company];
    else will[company] = 'Happy to refer';
    patch({
      referCompanies: on
        ? draft.referCompanies.filter((entry) => entry !== company)
        : [...draft.referCompanies, company],
      will,
    });
  }

  return (
    <>
      <div className={styles.section}>
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            className={`${styles.option} ${draft.mode === option.mode ? styles.optionOn : ''}`}
            onClick={() => patch({ mode: option.mode })}
          >
            <strong>{option.title}</strong>
            <span>{option.blurb}</span>
          </button>
        ))}
      </div>

      {draft.mode === null ? null : (
        <>
          <div className={styles.row}>
            <Field label={draft.mode === 'looking' ? 'Most recent company' : 'Company'}>
              <Input
                value={draft.company}
                disabled={draft.mode === 'student'}
                onChange={(e) => patch({ company: e.target.value })}
              />
            </Field>
            <Field label={draft.mode === 'looking' ? 'Most recent title' : 'Title'}>
              <Input
                value={draft.role}
                disabled={draft.mode === 'student'}
                onChange={(e) => patch({ role: e.target.value })}
              />
            </Field>
          </div>

          {draft.mode === 'student' ? (
            <div className={styles.row}>
              <Field label="School">
                <Input
                  value={draft.schools[0]?.name ?? draft.school2}
                  disabled={draft.schools.length > 0}
                  onChange={(e) => patch({ school2: e.target.value })}
                />
              </Field>
              <Field label="Graduating">
                <Input
                  value={draft.gradYear}
                  onChange={(e) => patch({ gradYear: e.target.value })}
                />
              </Field>
            </div>
          ) : null}

          <Field label="Function">
            <SelectGrid
              options={FUNCTIONS}
              selected={draft.lane ? [draft.lane] : []}
              onToggle={(lane) => patch({ lane: draft.lane === lane ? '' : lane })}
            />
          </Field>

          <Field label={draft.mode === 'student' ? 'Industry (optional)' : 'Industry'}>
            <SelectGrid
              options={INDUSTRIES}
              selected={draft.industry ? [draft.industry] : []}
              onToggle={(industry) =>
                patch({ industry: draft.industry === industry ? '' : industry })
              }
            />
          </Field>

          {draft.mode === 'student' ? null : (
            <Field label="Years in this line of work">
              <SelectGrid
                columns={3}
                options={YEARS_BANDS}
                selected={draft.years ? [draft.years] : []}
                onToggle={(years) => patch({ years: draft.years === years ? '' : years })}
              />
            </Field>
          )}

          {draft.mode === 'student' ? null : (
            <Field label="Where you can open a door">
              <SelectGrid options={doors} selected={draft.referCompanies} onToggle={toggleDoor} />

              <div className={styles.row} style={{ marginTop: 8 }}>
                <Input
                  value={custom}
                  placeholder="Add a company we missed"
                  onChange={(e) => setCustom(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = custom.trim();
                    if (!name || draft.referCompanies.includes(name)) return;
                    patch({
                      referCompanies: [...draft.referCompanies, name],
                      will: { ...draft.will, [name]: 'Happy to refer' },
                    });
                    setCustom('');
                  }}
                >
                  <Chip>Add</Chip>
                </button>
              </div>

              {draft.referCompanies.map((company) => (
                <div key={company} className={styles.listRow} style={{ display: 'block' }}>
                  <p>{company}</p>
                  <div className={styles.doorHelp}>
                    {HELP_KINDS.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => patch({ will: { ...draft.will, [company]: kind } })}
                      >
                        <Chip tone={draft.will[company] === kind ? 'solid' : 'default'}>
                          {kind}
                        </Chip>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </Field>
          )}
        </>
      )}
    </>
  );
}

/* ================================================================== */
/* Step 3 — What are you looking for?                                 */
/* ================================================================== */

export function Step3({ draft, patch }: StepProps) {
  const [custom, setCustom] = useState('');
  const targets = suggestCompanies(draft.company, draft.targetCompanies, 8);

  function toggle<T extends string>(list: readonly T[], value: T, cap: number): T[] {
    if (list.includes(value)) return list.filter((entry) => entry !== value);
    return list.length >= cap ? [...list] : [...list, value];
  }

  return (
    <>
      <Field label={`Industries you want intros in (max ${LIMITS.industries})`}>
        <SelectGrid
          options={INDUSTRIES}
          selected={draft.industries}
          disabled={() => draft.industries.length >= LIMITS.industries}
          onToggle={(value) =>
            patch({ industries: toggle(draft.industries, value, LIMITS.industries) })
          }
        />
      </Field>

      <Field label={`Roles you are targeting (max ${LIMITS.roles})`}>
        <SelectGrid
          options={FUNCTIONS}
          selected={draft.lanes}
          disabled={() => draft.lanes.length >= LIMITS.roles}
          onToggle={(value) => patch({ lanes: toggle(draft.lanes, value, LIMITS.roles) })}
        />
      </Field>

      <Field label="Target companies">
        <SelectGrid
          options={targets}
          selected={draft.targetCompanies}
          onToggle={(value) => patch({ targetCompanies: toggle(draft.targetCompanies, value, 12) })}
        />
        <div className={styles.row} style={{ marginTop: 8 }}>
          <Input
            value={custom}
            placeholder="Add a company we missed"
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              const name = custom.trim();
              if (!name || draft.targetCompanies.includes(name)) return;
              patch({ targetCompanies: [...draft.targetCompanies, name] });
              setCustom('');
            }}
          >
            <Chip>Add</Chip>
          </button>
        </div>
      </Field>
    </>
  );
}

/* ================================================================== */
/* Step 4 — A little colour                                           */
/* ================================================================== */

export function Step4({ draft, patch }: StepProps) {
  const [hobby, setHobby] = useState('');

  return (
    <>
      <Field label={`What you are into (max ${LIMITS.interests})`}>
        <SelectGrid
          options={INTERESTS}
          selected={draft.interests}
          disabled={() => draft.interests.length >= LIMITS.interests}
          onToggle={(value) =>
            patch({
              interests: draft.interests.includes(value)
                ? draft.interests.filter((entry) => entry !== value)
                : draft.interests.length >= LIMITS.interests
                  ? draft.interests
                  : [...draft.interests, value],
            })
          }
        />
        <div className={styles.row} style={{ marginTop: 8 }}>
          <Input
            value={hobby}
            placeholder="Something else"
            onChange={(e) => setHobby(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              const value = hobby.trim();
              if (!value || draft.interests.length >= LIMITS.interests) return;
              patch({ interests: [...draft.interests, value] });
              setHobby('');
            }}
          >
            <Chip>Add</Chip>
          </button>
        </div>
      </Field>

      <Field label="You are open to">
        <SelectGrid
          options={OPEN_TO}
          selected={draft.openTo}
          onToggle={(value) =>
            patch({
              openTo: draft.openTo.includes(value)
                ? draft.openTo.filter((entry) => entry !== value)
                : [...draft.openTo, value],
            })
          }
        />
      </Field>

      <Field label="Short bio">
        <textarea
          className={styles.textarea}
          value={draft.bio}
          maxLength={LIMITS.bioChars}
          onChange={(e) => patch({ bio: e.target.value })}
        />
        <span className={styles.counter}>
          {draft.bio.length} / {LIMITS.bioChars}
        </span>
      </Field>
    </>
  );
}

/* ================================================================== */
/* Step 5 — Review                                                    */
/* ================================================================== */

export function Step5({
  steps,
}: StepProps & { steps: { step: number; status: string; label: string }[] }) {
  const NAMES: Record<number, string> = {
    1: 'Who you are',
    2: 'Where you are today',
    3: 'What you are looking for',
    4: 'A little colour',
  };

  return (
    <>
      {steps
        .filter((entry) => entry.step <= 4)
        .map((entry) => (
          <a key={entry.step} href={`/onboarding/${entry.step}`} className={styles.reviewRow}>
            <span className={styles.reviewLabel}>{NAMES[entry.step]}</span>
            <span
              className={`${styles.reviewState} ${
                entry.status === 'Complete' ? styles.reviewDone : ''
              }`}
            >
              {entry.status}
            </span>
          </a>
        ))}
    </>
  );
}

export const helpKinds: readonly HelpKind[] = HELP_KINDS;
