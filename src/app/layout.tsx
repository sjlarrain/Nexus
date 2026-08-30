import { IBM_Plex_Mono, Inter, Inter_Tight } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * Fonts are self-hosted through next/font rather than linked from Google, as the
 * mock does: a PWA should not need a third-party request to render its own type,
 * and next/font removes the layout shift that comes with a late-loading face.
 * The mock's stacks are preserved in tokens.css.
 */
const display = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'QuadChat',
  description: 'Swipe-based professional referrals.',
};

// Mobile-first PWA target (docs/decisions.md, 2026-08-28).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
