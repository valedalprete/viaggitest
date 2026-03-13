import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Viaggi',
  description: 'Il tuo pianificatore di viaggi personale',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={plusJakarta.variable}>
      <body className={plusJakarta.className}>
        <Navbar />
        <main className="min-h-screen bg-sand-100">
          {children}
        </main>
      </body>
    </html>
  );
}
