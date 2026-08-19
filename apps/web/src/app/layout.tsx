import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteFooter, SiteHeader } from '../components/site-shell';
import '@fontsource-variable/roboto-flex/wght.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'League Hub',
    template: '%s | League Hub',
  },
  description: 'Official schedules and team information published by your league.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
