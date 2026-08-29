'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import styles from './AppShell.module.css';

/**
 * App chrome from mock 1a: brand bar, optional actions, and the four-tab bar.
 *
 * The mock draws a phone (status bar, notch, home indicator) because it is a
 * presentation board. Those are the device, not the app, so only the home indicator
 * survives — as the bottom safe-area spacer it really is.
 */

const TABS: { href: Route; label: string; match: string }[] = [
  { href: '/deck', label: 'Explore', match: '/deck' },
  { href: '/likes', label: 'Likes', match: '/likes' },
  { href: '/chat', label: 'Chats', match: '/chat' },
  { href: '/profile', label: 'Profile', match: '/profile' },
];

export default function AppShell({
  children,
  actions,
}: {
  children: ReactNode;
  /** Right-hand app-bar buttons — Activity and Filters on the deck (mock 1a). */
  actions?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <header className={styles.appbar}>
        <span className={styles.brand}>
          <span className={styles.brandName}>Warm Intro</span>
          <span className={styles.brandBeta}>BETA</span>
        </span>
        {actions ? <span className={styles.actions}>{actions}</span> : null}
      </header>

      <main className={styles.main}>{children}</main>

      <nav className={styles.tabbar} aria-label="Sections">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.match);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={active ? `${styles.tab} ${styles.tabOn}` : styles.tab}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.homebar} />
    </div>
  );
}
