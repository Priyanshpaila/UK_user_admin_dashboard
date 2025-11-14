'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    const user = localStorage.getItem("user");

    if (!token || !user) {
      router.push('/login');
    } else {
      router.push('/dashboard');
    }
  }, [router]);

  return null;
}
