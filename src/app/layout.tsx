import '../styles/globals.css';
import type { Metadata } from 'next';
import ThemeProvider from '../components/layout/ThemeProvider';
import AuthGuard from '../components/AuthGuard'; // <-- NEW

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Responsive dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0b0c] text-white overflow-hidden">
        <ThemeProvider>
          <AuthGuard>{children}</AuthGuard> {/* <-- WRAPPED */}
        </ThemeProvider>
      </body>
    </html>
  );
}
