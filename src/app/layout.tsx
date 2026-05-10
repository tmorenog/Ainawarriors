import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Warriors of the Clans',
  description: 'A multiplayer browser game inspired by the world of Warrior Cats.',
  applicationName: 'Warriors of the Clans',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#15241a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body">
        {/* SVG color-blind filters */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <filter id="cb-prot">
            <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0" />
          </filter>
          <filter id="cb-deut">
            <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0" />
          </filter>
          <filter id="cb-trit">
            <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0" />
          </filter>
        </svg>
        {children}
      </body>
    </html>
  );
}
