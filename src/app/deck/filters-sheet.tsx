'use client';

import { useState } from 'react';
import { Input } from '@/components/ui';
import { SECTOR_OPTIONS, positionsForSectors } from '@/lib/refdata/taxonomy';
import type { Direction } from '@/lib/refdata/constants';
import styles from './filters.module.css';

/**
 * "Narrow the deck" (docs/mocks/planup-filters.unpacked.html): a bottom sheet of
 * chip groups over the deck, College first.
 *
 * The mock's college list is a fixed set with "+ Add new". There is no college
 * directory in this app, so the whole section is the "add new" half — you type a
 * school and it becomes a chip. `passesFilters` matches loosely on purpose, so
 * "Michigan" finds "University of Michigan".
 *
 * Every group here maps to a filter the deck API already applies (src/lib/deck/rank.ts).
 * Nothing is offered that would not actually narrow the deck.
 */

export type DeckFilterState = {
  colleges: string[];
  industries: string[];
  lanes: string[];
  city: string | null;
  direction: Direction | null;
};

export const NO_FILTERS: DeckFilterState = {
  colleges: [],
  industries: [],
  lanes: [],
  city: null,
  direction: null,
};

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'refer', label: 'Can refer' },
  { value: 'looking', label: 'Looking' },
  { value: 'both', label: 'Open both ways' },
];

/** The chips above the deck: what is on right now, in the mock's summary style. */
export function filterSummary(filters: DeckFilterState): string[] {
  const summary = [
    filters.industries.length > 0 ? filters.industries.join(', ') : 'Any industry',
    filters.lanes.length > 0 ? filters.lanes.join(', ') : 'Any role',
    filters.city ?? 'Nationwide',
  ];
  if (filters.colleges.length > 0) summary.push(filters.colleges.join(', '));
  if (filters.direction) {
    summary.push(DIRECTIONS.find((d) => d.value === filters.direction)?.label ?? '');
  }
  return summary.filter((value) => value.length > 0);
}

/** The query string the deck API reads. */
export function filtersToQuery(filters: DeckFilterState): string {
  const params = new URLSearchParams();
  for (const college of filters.colleges) params.append('college', college);
  for (const industry of filters.industries) params.append('industry', industry);
  for (const lane of filters.lanes) params.append('lane', lane);
  if (filters.city) params.append('city', filters.city);
  if (filters.direction) params.append('direction', filters.direction);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function FiltersSheet({
  filters,
  onChange,
  onClose,
  myCity,
}: {
  filters: DeckFilterState;
  onChange: (next: DeckFilterState) => void;
  onClose: () => void;
  /** The only city offered: filtering to a city you cannot name is not a feature. */
  myCity: string;
}) {
  const [newCollege, setNewCollege] = useState('');

  // Roles are scoped to the chosen industries, exactly as they are in onboarding —
  // the full position list is hundreds long and unreadable as chips.
  const roles = positionsForSectors(filters.industries);

  function addCollege(): void {
    const name = newCollege.trim();
    if (name.length === 0 || filters.colleges.includes(name)) return;
    onChange({ ...filters, colleges: [...filters.colleges, name] });
    setNewCollege('');
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Narrow the deck">
      <div className={styles.sheet}>
        <div className={styles.head}>
          <h2 className={styles.title}>Narrow the deck</h2>
          <div className={styles.headActions}>
            <button type="button" className={styles.reset} onClick={() => onChange(NO_FILTERS)}>
              Reset
            </button>
            <button type="button" className={styles.done} onClick={onClose}>
              Done
            </button>
          </div>
        </div>

        <section className={styles.group}>
          <p className={styles.groupLabel}>College</p>
          <div className={styles.chips}>
            {filters.colleges.map((college) => (
              <button
                key={college}
                type="button"
                className={`${styles.chip} ${styles.chipOn}`}
                onClick={() => onChange({ ...filters, colleges: toggle(filters.colleges, college) })}
              >
                {college} ×
              </button>
            ))}
          </div>
          <div className={styles.addRow}>
            <Input
              value={newCollege}
              placeholder="School name"
              aria-label="School name"
              onChange={(event) => setNewCollege(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCollege();
                }
              }}
            />
            <button
              type="button"
              className={styles.add}
              disabled={newCollege.trim().length === 0}
              onClick={addCollege}
            >
              Add
            </button>
          </div>
        </section>

        <section className={styles.group}>
          <p className={styles.groupLabel}>Industry</p>
          <div className={styles.chips}>
            {SECTOR_OPTIONS.map((sector) => (
              <button
                key={sector}
                type="button"
                className={`${styles.chip} ${filters.industries.includes(sector) ? styles.chipOn : ''}`}
                onClick={() => {
                  const industries = toggle(filters.industries, sector);
                  // A role that no longer has an industry behind it cannot match.
                  const allowed = new Set(positionsForSectors(industries));
                  onChange({
                    ...filters,
                    industries,
                    lanes: filters.lanes.filter((lane) => allowed.has(lane)),
                  });
                }}
              >
                {sector}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <p className={styles.groupLabel}>Role</p>
          {roles.length === 0 ? (
            <p className={styles.groupNote}>Pick an industry first — roles are scoped to it.</p>
          ) : (
            <div className={styles.chips}>
              {roles.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`${styles.chip} ${filters.lanes.includes(role) ? styles.chipOn : ''}`}
                  onClick={() => onChange({ ...filters, lanes: toggle(filters.lanes, role) })}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={styles.group}>
          <p className={styles.groupLabel}>Location</p>
          <div className={styles.chips}>
            <button
              type="button"
              className={`${styles.chip} ${filters.city === null ? styles.chipOn : ''}`}
              onClick={() => onChange({ ...filters, city: null })}
            >
              Nationwide
            </button>
            {myCity ? (
              <button
                type="button"
                className={`${styles.chip} ${filters.city ? styles.chipOn : ''}`}
                onClick={() => onChange({ ...filters, city: myCity })}
              >
                {myCity}
              </button>
            ) : null}
          </div>
        </section>

        <section className={styles.group}>
          <p className={styles.groupLabel}>They are here to</p>
          <div className={styles.chips}>
            <button
              type="button"
              className={`${styles.chip} ${filters.direction === null ? styles.chipOn : ''}`}
              onClick={() => onChange({ ...filters, direction: null })}
            >
              Either
            </button>
            {DIRECTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.chip} ${filters.direction === option.value ? styles.chipOn : ''}`}
                onClick={() => onChange({ ...filters, direction: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
