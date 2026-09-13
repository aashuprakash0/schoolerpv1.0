import './globals.css';
import Link from 'next/link';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata = { title: 'Adarsh Avasiya School ERP', description: 'School student and fee management portal' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">Adarsh Avasiya School</Link>
          <nav>
            <Link href="/notices">Notice Board</Link>
            <Link href="/login">Admin Login</Link>
          </nav>
        </header>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
