import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@/styles/globals.css';
import { QueryProvider } from '@/components/layout/query-provider';

export const metadata: Metadata = {
  title: 'LongevityPlan — Coach Dashboard',
  description: 'AI-powered health intelligence for coaches and practitioners',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-gravity-bg text-gravity-text font-sans antialiased noise-bg min-h-screen">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
