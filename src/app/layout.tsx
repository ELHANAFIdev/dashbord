import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { SessionProvider } from '@/client/session';
import { THEME_SCRIPT } from '@/client/theme';
import { AppShell } from '@/components/shell/app-shell';

const plex = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-latin-wght.woff2', weight: '100 700', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-ext-wght.woff2', weight: '100 700', style: 'normal' },
  ],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Supervision UMMC', template: '%s · Supervision UMMC' },
  description: 'Supervision en lecture seule des unités médicales mobiles connectées (Maroc).',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#141b24' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="light" className={plex.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
