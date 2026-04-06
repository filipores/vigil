import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Monitor',
  description: 'Monitor AI-generated code in real-time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-text-primary antialiased">{children}</body>
    </html>
  );
}
