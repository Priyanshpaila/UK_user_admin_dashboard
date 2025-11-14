"use client";

import Sidebar from "../../components/layout/Sidebar";
import { Menu } from "lucide-react";
import { useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#0b0b0c] text-white overflow-hidden">

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar />
      </div>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14
                      bg-[#0b0b0c] border-b border-neutral-800
                      flex items-center px-4 z-50">
        <button onClick={() => setOpen(true)} className="text-neutral-200">
          <Menu size={24} />
        </button>

        <h1 className="ml-4 text-lg font-semibold">Dashboard</h1>
      </div>

      {/* Mobile Sidebar Drawer */}
      <div className="md:hidden">
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-300
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sidebar Panel (SCROLLABLE!) */}
          <div
            className={`
              absolute top-0 left-0 h-full w-64
              bg-[#0b0b0c] border-r border-neutral-800 shadow-xl
              flex flex-col overflow-y-auto
              transform transition-transform duration-300 ease-out
              ${open ? "translate-x-0" : "-translate-x-full"}
            `}
          >
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <section className="flex-1 overflow-y-auto bg-[#0f0f10] p-6 mt-14 md:mt-0">
          {children}
        </section>
      </main>
    </div>
  );
}
