import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AA QR Code Generator',
  description: 'Validate a UTM-tagged aa.co.nz link and generate a branded QR code.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ">
      <body>{children}</body>
    </html>
  );
}
