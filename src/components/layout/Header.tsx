'use client';
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function Header() {
  const { theme, setTheme } = useTheme();
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-[#0f0f10] border-b border-neutral-800">
      <div className="text-lg font-semibold">Dashboard</div>
      <div className="flex items-center gap-3">
        <button
          aria-label="toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-md bg-neutral-800/30 hover:bg-neutral-700/40">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
