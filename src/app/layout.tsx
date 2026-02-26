import type { Metadata } from 'next';
import { Orbitron, JetBrains_Mono } from 'next/font/google';
import Providers from '@/components/layout/Providers';
import './globals.css';

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-orbitron',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mission Control',
  description: 'AI Agent Dashboard — Blue Tees Golf',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${orbitron.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-mono antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
