'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Public routes
    if (pathname === '/login') return;

    const token = localStorage.getItem('session_token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      router.push('/login');
      return;
    }

    const user = JSON.parse(userStr);

    if (!user.is_admin && !user.is_pharmacist) {
      router.push('/login');
      return;
    }
  }, [pathname, router]);

  return <>{children}</>;
}
