import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Background } from '@/components/Background';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Baseshooter',
  description: 'Throw the knife. Land every apple. Mint your win onchain on Base.',
  other: {
    'base:app_id': '6a227884e40711b9d5bdbe8d',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#05070F] text-zinc-100">
        <Providers>
          <Background />
          {children}
        </Providers>
      </body>
    </html>
  );
}
