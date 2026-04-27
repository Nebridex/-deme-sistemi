import './globals.css';
import type { Metadata } from 'next';
import { appEnv } from '@/lib/env';

export const metadata: Metadata = {
  title: appEnv.appName,
  description: appEnv.appDescription,
  manifest: '/manifest.webmanifest'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
