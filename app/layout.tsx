import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cafe Bill MVP',
  description: 'QR-ready cafe table bill management MVP'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
