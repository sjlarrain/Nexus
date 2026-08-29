import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { GateResult } from '@/lib/onboarding/gates';
import styles from './ui.module.css';

/**
 * UI primitives (BACKLOG E15.2), extracted from docs/mocks/planup-designs.html.
 *
 * Presentational only — no fetching, no business logic — so screens stay readable
 * and the mock's values live in exactly one place.
 */

function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/* --- text ------------------------------------------------------------ */

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className={styles.eyebrow}>{children}</span>;
}

export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx(styles.meta, className)}>{children}</span>;
}

export function Quote({ children }: { children: ReactNode }) {
  return <p className={styles.quote}>{children}</p>;
}

/* --- chip ------------------------------------------------------------ */

type ChipTone = 'default' | 'amber' | 'solid';

export function Chip({
  children,
  tone = 'default',
  pill = false,
  className,
}: {
  children: ReactNode;
  tone?: ChipTone;
  pill?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        styles.chip,
        tone === 'amber' && styles.chipAmber,
        tone === 'solid' && styles.chipSolid,
        pill && styles.chipPill,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx(styles.badge, className)}>{children}</span>;
}

/* --- buttons --------------------------------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * The ink-filled primary button.
 *
 * Spec section 5: "disabled state is ink at 28% opacity and the label becomes the
 * validation message". Passing a `gate` does both at once, so no screen has to
 * remember the rule — and the gates already return exactly that label (E3.2).
 */
export function PrimaryButton({
  label,
  gate,
  tone = 'dark',
  className,
  ...rest
}: ButtonProps & { label: string; gate?: GateResult; tone?: 'dark' | 'light' }) {
  const blocked = gate !== undefined && !gate.ok;
  return (
    <button
      type="button"
      {...rest}
      disabled={blocked || rest.disabled}
      className={cx(tone === 'light' ? styles.light : styles.primary, className)}
    >
      {blocked ? gate.label : label}
    </button>
  );
}

export function GhostButton({
  children,
  onDark = false,
  className,
  ...rest
}: ButtonProps & { children: ReactNode; onDark?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(onDark ? styles.ghostDark : styles.ghost, className)}
    >
      {children}
    </button>
  );
}

export function PillButton({
  children,
  dot = false,
  className,
  ...rest
}: ButtonProps & { children: ReactNode; dot?: boolean }) {
  return (
    <button type="button" {...rest} className={cx(styles.pillButton, className)}>
      {children}
      {dot ? <i className={styles.pillDot} /> : null}
    </button>
  );
}

/* --- surfaces -------------------------------------------------------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cx(styles.card, className)}>{children}</article>;
}

/** "Can refer into — DoorDash · Growth, Marketplace" (mock 1a). */
export function RefBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.refbox}>
      <Eyebrow>{label}</Eyebrow>
      <p>{value}</p>
    </div>
  );
}

/* --- photos ---------------------------------------------------------- */

export function Dots({ count, active }: { count: number; active: number }) {
  return (
    <span className={styles.dots}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={index === active ? styles.dotOn : undefined} />
      ))}
    </span>
  );
}

/** The hatch the mock uses for an empty photo slot; also our broken-image fallback. */
export const hatchClass = styles.hatch;
export const hatchWarmClass = styles.hatchWarm;

/* --- form ------------------------------------------------------------ */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <p className={styles.fieldLabel}>{label}</p>
      {children}
    </div>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className={styles.fieldChips}>{children}</div>;
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(styles.input, className)} />;
}

/**
 * Multi-select grid (spec section 5): equal columns, tick on the right when chosen,
 * ink fill when selected. Three columns for short values like course names.
 */
export function SelectGrid<T extends string>({
  options,
  selected,
  onToggle,
  columns = 2,
  disabled,
}: {
  options: readonly T[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  columns?: 2 | 3;
  /** Values that cannot be added because a cap is reached (spec section 2). */
  disabled?: (value: T) => boolean;
}) {
  return (
    <div className={cx(styles.grid, columns === 3 && styles.gridThree)}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            disabled={!on && disabled?.(option) === true}
            onClick={() => onToggle(option)}
            className={cx(styles.gridCell, on && styles.gridCellOn)}
          >
            <span>{option}</span>
            {on ? <span className={styles.gridCheck}>✓</span> : null}
          </button>
        );
      })}
    </div>
  );
}
