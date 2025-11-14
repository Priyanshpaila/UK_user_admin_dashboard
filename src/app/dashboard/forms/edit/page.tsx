'use client';
import React from 'react';

export default function Page() {
  const items = Array.from({length:8}).map((_,i)=>({id:i+1,title:`Item ${i+1}`}));
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Edit</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item=>(
          <div key={item.id} className="p-4 rounded-lg bg-neutral-800">{item.title}</div>
        ))}
      </div>
    </div>
  );
}
