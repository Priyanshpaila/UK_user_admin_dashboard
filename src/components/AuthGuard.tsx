'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const PUBLIC_ROUTES = ['/', '/login']; // add more like '/contact' if needed

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // 1) Handle public routes
    if (PUBLIC_ROUTES.includes(pathname)) {
      // If user is already logged in and is on /login, send them to dashboard
      if (pathname === '/login') {
        const token = localStorage.getItem('session_token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
          try {
            const user = JSON.parse(userStr);
            if (user?.is_admin || user?.is_pharmacist) {
              router.replace('/dashboard');
            }
          } catch {
            // If parse fails, just stay on login
          }
        }
      }
      return; // allow landing and login to render without blocking
    }

    // 2) Protected routes (everything else)
    const token = localStorage.getItem('session_token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      router.replace('/login');
      return;
    }

    let user: any;
    try {
      user = JSON.parse(userStr);
    } catch {
      router.replace('/login');
      return;
    }

    if (!user?.is_admin && !user?.is_pharmacist) {
      router.replace('/login');
      return;
    }
  }, [pathname, router]);

  return <>{children}</>;
}
