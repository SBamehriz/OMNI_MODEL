import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Omni-Model Router — Dashboard',
  description: 'Analytics and usage for the most efficient API for AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="noise" />
        {children}
      </body>
    </html>
  );
}
