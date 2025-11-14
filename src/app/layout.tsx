import '../styles/globals.css';
import type { Metadata } from 'next';
import ThemeProvider from '../components/layout/ThemeProvider';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Responsive dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
