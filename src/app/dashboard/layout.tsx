import Sidebar from "../../components/layout/Sidebar";

// src/app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0b0b0c] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 bg-[#0b0b0c] flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Main content (scroll only here) */}
      <main className="flex-1 flex flex-col overflow-hidden">


        {/* Scrollable page content */}
        <section className="flex-1 overflow-y-auto bg-[#0f0f10]">
          {children}
        </section>
      </main>
    </div>
  );
}
