import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SyncProvider } from '@/components/SyncProvider';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Repify — your gym log',
  description: 'Track every set, every rep, every kilo.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Repify',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SyncProvider>{children}</SyncProvider>
      </body>
    </html>
  );
}
