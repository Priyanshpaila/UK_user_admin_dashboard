'use client';
import React from 'react';

export function Button({ children, className='', ...props }: any) {
  return (
    <button {...props} className={`px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 ${className}`}>
      {children}
    </button>
  );
}
export default Button;
