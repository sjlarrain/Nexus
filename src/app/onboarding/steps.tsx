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
  type HelpKind,
  type Mode,
} from '@/lib/refdata/constants';
import {
  INTERESTS,
  OTHER_OPTION,
  SECTOR_OPTIONS,
  positionsForSectors,
} from '@/lib/refdata/taxonomy';
import { CITIES_BY_STATE, STATE_NAMES, formatCity, parseCity } from '@/lib/refdata/locations';
import { suggestCompanies } from '@/lib/refdata/peer-map';
import { hatchClass, hatchWarmClass } from '@/components/ui';
import type { Profile, School } from '@/lib/schemas/profile';
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
  4: { title: 'A little colour', sub: 'It gives people something to open with.' },
  5: { title: 'Review your card', sub: 'This is exactly what other people will see.' },
};

/* ================================================================== */
/* Shared: the taxonomy grid                                          */
/* ================================================================== */

/**
 * One multi-select grid with an escape hatch, used by every taxonomy field on steps
 * 2 and 3 — sectors, positions, roles.
 *
 * Deliberately one component rather than five copies: steps 2 and 3 ask for the same
 * two taxonomies, and separate implementations would drift the moment the sector list
 * changes. The escape hatch is also one interaction everywhere: an "Other" cell in
 * the grid opens a text field, and what the user types becomes its own selected cell.
 * Those values stay on this profile and never join the shared taxonomy.
 */
function TaxonomyField({
  label,
  options,
  selected,
  cap,
  onChange,
  emptyHint,
  addPlaceholder,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  cap: number;
  onChange: (next: string[]) => void;
  /** Shown instead of the grid when there is nothing to choose from yet. */
  emptyHint?: string;
  addPlaceholder: string;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');

  // Anything chosen that is not a listed option was typed by the user. It renders as
  // its own cell so it can be seen and removed the same way as everything else.
  const custom = selected.filter((entry) => !options.includes(entry));
  const cells = [...options, ...custom];
  const full = selected.length >= cap;

  function toggle(entry: string): void {
    if (entry === OTHER_OPTION) {
      setAdding((current) => !current);
      return;
    }
    onChange(
      selected.includes(entry)
        ? selected.filter((candidate) => candidate !== entry)
        : full
          ? [...selected]
          : [...selected, entry],
    );
  }

  function commit(): void {
    const entry = value.trim();
    if (!entry || full || selected.includes(entry)) return;
    onChange([...selected, entry]);
    setValue('');
    setAdding(false);
  }

  const showGrid = options.length > 0 || custom.length > 0;

  return (
    <Field label={`${label} · ${selected.length} of ${cap}`}>
      {showGrid ? (
        <SelectGrid options={cells} selected={selected} disabled={() => full} onToggle={toggle} />
      ) : (
        <p className={styles.status}>{emptyHint}</p>
      )}

      {options.includes(OTHER_OPTION) ? null : (
        <button type="button" className={styles.addOther} onClick={() => setAdding(!adding)}>
          <Chip>{adding ? 'Cancel' : '+ Add other'}</Chip>
        </button>
      )}

      {adding ? (
        <div className={styles.row} style={{ marginTop: 8 }}>
          <Input
            value={value}
            placeholder={addPlaceholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              commit();
            }}
          />
          <button type="button" onClick={commit}>
            <Chip tone="solid">Add</Chip>
          </button>
        </div>
      ) : null}

      {full ? <p className={styles.status}>That is the maximum. Remove one to swap.</p> : null}
    </Field>
  );
}

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

const BLANK_SCHOOL: School = { name: '', course: 'Undergraduate', year: '' };

export function Step1({ draft, patch }: StepProps) {
  // The add-school form is open from the start rather than hidden behind a button:
  // education is the first thing most people fill in and an empty section read as
  // "nothing to do here".
  const [school, setSchool] = useState<School | null>(
    draft.schools.length > 0 ? null : { ...BLANK_SCHOOL },
  );
  const [courseOther, setCourseOther] = useState('');

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

  // "Other" is a chip like any other; picking it swaps the chip row for a text field
  // and whatever is typed becomes the stored course name.
  const onOther = school !== null && !COURSE_TYPES.includes(school.course as never);

  function save(): void {
    if (school === null || !school.name.trim()) return;
    const course = onOther ? courseOther.trim() || OTHER_OPTION : school.course;
    patch({ schools: [...draft.schools, { ...school, course }] });
    setSchool(null);
    setCourseOther('');
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

      <Field label={`School (up to ${LIMITS.schools})`}>
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
                <button
                  key={course}
                  type="button"
                  onClick={() =>
                    setSchool({ ...school, course: course === OTHER_OPTION ? '' : course })
                  }
                >
                  <Chip
                    tone={
                      (course === OTHER_OPTION ? onOther : school.course === course)
                        ? 'solid'
                        : 'default'
                    }
                  >
                    {course}
                  </Chip>
                </button>
              ))}
            </ChipRow>

            {onOther ? (
              <div style={{ marginTop: 10 }}>
                <Input
                  value={courseOther}
                  placeholder="Which course?"
                  onChange={(e) => setCourseOther(e.target.value)}
                />
              </div>
            ) : null}

            <div className={styles.row} style={{ marginTop: 10 }}>
              <Input
                value={school.name}
                placeholder="College"
                onChange={(e) => setSchool({ ...school, name: e.target.value })}
              />
              <Input
                value={school.year}
                inputMode="numeric"
                maxLength={4}
                placeholder="Batch year"
                onChange={(e) => setSchool({ ...school, year: e.target.value })}
              />
            </div>
            <div className={styles.doorHelp}>
              {draft.schools.length > 0 ? (
                <button type="button" onClick={() => setSchool(null)}>
                  <Chip>Cancel</Chip>
                </button>
              ) : null}
              <button type="button" onClick={save}>
                <Chip tone="solid">Save school</Chip>
              </button>
            </div>
          </div>
        ) : null}

        {school === null && draft.schools.length < LIMITS.schools ? (
          <button type="button" onClick={() => setSchool({ ...BLANK_SCHOOL })}>
            <Chip>+ Add new</Chip>
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
    blurb: 'Your card shows where you are and the team you can vouch for.',
  },
  {
    mode: 'student',
    title: 'I am a student',
    blurb: 'Your card leads with your course and school.',
  },
  {
    mode: 'looking',
    title: 'I am looking out',
    blurb: 'Your card leads with where you were most recently.',
  },
];

/** School and graduation, carried over from step 1 and editable in place. */
function StudentSection({ draft, patch }: StepProps) {
  const source = draft.schools[0] ?? null;
  const schoolName = source?.name ?? draft.school2;
  const gradYear = source?.year ?? draft.gradYear;

  // Nothing to carry over means there is nothing to confirm — open straight into
  // the inputs rather than showing two empty read-only rows.
  const [editing, setEditing] = useState(schoolName.trim().length === 0);

  /**
   * Step 1's school list is the single source of truth (docs/decisions.md), so an
   * edit here writes back to it and mirrors into the flat fields the card reads.
   * A part-typed year would fail `schoolSchema`, so it only reaches the list once it
   * is four digits.
   */
  function setName(value: string): void {
    patch(
      source
        ? { schools: [{ ...source, name: value }, ...draft.schools.slice(1)], school2: value }
        : { school2: value },
    );
  }

  function setYear(value: string): void {
    const complete = /^\d{4}$/.test(value);
    patch(
      source && complete
        ? { schools: [{ ...source, year: value }, ...draft.schools.slice(1)], gradYear: value }
        : { gradYear: value },
    );
  }

  return (
    <>
      <div className={styles.sectionHead}>
        <span className={styles.sectionHeadLabel}>From your profile</span>
        <button
          type="button"
          className={styles.editIcon}
          aria-label={editing ? 'Done editing' : 'Edit school and graduation'}
          aria-pressed={editing}
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Done' : '✎ Edit'}
        </button>
      </div>

      <div className={styles.row}>
        <Field label="School">
          <Input
            value={schoolName}
            readOnly={!editing}
            placeholder="Where do you study?"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Graduating">
          <Input
            value={gradYear}
            readOnly={!editing}
            inputMode="numeric"
            maxLength={4}
            placeholder="2027"
            onChange={(e) => setYear(e.target.value)}
          />
        </Field>
      </div>
    </>
  );
}

export function Step2({ draft, patch }: StepProps) {
  const positions = positionsForSectors(draft.industry);
  const door = draft.company.trim();
  const doorOn = door.length > 0 && draft.referCompanies.includes(door);

  function toggleDoor(): void {
    patch(
      doorOn
        ? { referCompanies: [], will: {} }
        : { referCompanies: [door], will: { [door]: 'Happy to refer' } },
    );
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

      {draft.mode === null ? null : draft.mode === 'student' ? (
        <StudentSection draft={draft} patch={patch} />
      ) : (
        <>
          <div className={styles.row}>
            <Field label={draft.mode === 'looking' ? 'Most recent company' : 'Company'}>
              <Input value={draft.company} onChange={(e) => patch({ company: e.target.value })} />
            </Field>
            <Field label={draft.mode === 'looking' ? 'Most recent title' : 'Title'}>
              <Input value={draft.role} onChange={(e) => patch({ role: e.target.value })} />
            </Field>
          </div>

          {/* Someone looking out is asked for their most recent seat and nothing more. */}
          {draft.mode === 'working' ? (
            <>
              <TaxonomyField
                label="Industry"
                options={SECTOR_OPTIONS}
                selected={draft.industry}
                cap={LIMITS.industries}
                addPlaceholder="Which industry?"
                onChange={(industry) =>
                  patch({
                    industry,
                    // Positions are scoped to the chosen sectors, so dropping a
                    // sector must drop the positions it was the only source of.
                    lane: draft.lane.filter(
                      (entry) =>
                        positionsForSectors(industry).includes(entry) ||
                        !positionsForSectors(draft.industry).includes(entry),
                    ),
                  })
                }
              />

              <TaxonomyField
                label="Function (optional)"
                options={positions}
                selected={draft.lane}
                cap={LIMITS.roles}
                addPlaceholder="Which function?"
                emptyHint="Pick an industry first — functions are scoped to it."
                onChange={(lane) => patch({ lane })}
              />

              <Field label="Years in this line of work (optional)">
                <SelectGrid
                  columns={3}
                  options={YEARS_BANDS}
                  selected={draft.years ? [draft.years] : []}
                  onToggle={(years) => patch({ years: draft.years === years ? '' : years })}
                />
              </Field>

              <Field label="Where you can open a door (optional)">
                {door ? (
                  <>
                    <SelectGrid
                      options={[door]}
                      selected={doorOn ? [door] : []}
                      onToggle={toggleDoor}
                    />
                    {doorOn ? (
                      <div className={styles.doorHelp}>
                        {HELP_KINDS.map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => patch({ will: { [door]: kind } })}
                          >
                            <Chip tone={draft.will[door] === kind ? 'solid' : 'default'}>
                              {kind}
                            </Chip>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className={styles.status}>Add your company above and it appears here.</p>
                )}
              </Field>
            </>
          ) : null}
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
  const roles = positionsForSectors(draft.industries);

  return (
    <>
      <TaxonomyField
        label="Industries you want intros in"
        options={SECTOR_OPTIONS}
        selected={draft.industries}
        cap={LIMITS.industries}
        addPlaceholder="Which industry?"
        onChange={(industries) =>
          patch({
            industries,
            lanes: draft.lanes.filter(
              (entry) =>
                positionsForSectors(industries).includes(entry) ||
                !positionsForSectors(draft.industries).includes(entry),
            ),
          })
        }
      />

      <TaxonomyField
        label="Roles you are targeting"
        options={roles}
        selected={draft.lanes}
        cap={LIMITS.roles}
        addPlaceholder="Which role?"
        emptyHint="Pick an industry first — roles are scoped to it."
        onChange={(lanes) => patch({ lanes })}
      />

      <Field label="Target companies (optional)">
        <SelectGrid
          options={targets}
          selected={draft.targetCompanies}
          onToggle={(value) =>
            patch({
              targetCompanies: draft.targetCompanies.includes(value)
                ? draft.targetCompanies.filter((entry) => entry !== value)
                : [...draft.targetCompanies, value],
            })
          }
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
      <Field label={`What you are into · ${draft.interests.length} of ${LIMITS.interests}`}>
        <SelectGrid
          options={[
            ...INTERESTS,
            ...draft.interests.filter((entry) => !INTERESTS.includes(entry as never)),
          ]}
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

      <Field label="Short bio (optional)">
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
        .map((entry) => {
          const done = entry.status === 'Complete';
          return (
            // Continue on the step this opens comes straight back here once every
            // section is green, so a review-time fix does not restart the walk.
            <a key={entry.step} href={`/onboarding/${entry.step}`} className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{NAMES[entry.step]}</span>
              <span className={`${styles.reviewState} ${done ? styles.reviewDone : ''}`}>
                {done ? '✓ ' : ''}
                {entry.status}
              </span>
            </a>
          );
        })}
    </>
  );
}

export const helpKinds: readonly HelpKind[] = HELP_KINDS;
