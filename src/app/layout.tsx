import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Warm Intro',
  description: 'Swipe-based professional referrals.',
};

// Mobile-first PWA target (docs/decisions.md, 2026-08-28).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

// Deliberately unstyled. Visual language arrives with the HTML mocks (CLAUDE.md s2).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
