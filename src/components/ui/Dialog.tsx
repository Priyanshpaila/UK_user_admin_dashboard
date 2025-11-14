'use client';
import React from 'react';

export function Dialog({ open, children, onOpenChange, ...props }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg w-full max-w-md mx-4">
        {children}
      </div>
    </div>
  );
}
export default Dialog;
