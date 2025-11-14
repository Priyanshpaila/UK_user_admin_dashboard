"use client";
import CalendarWidget from "../../components/ui/Calendar";

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-8">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-neutral-400">
          Overview of appointments and schedules
        </p>
      </div>

      {/* Calendar Section */}
      <section className="bg-[#0f0f10] border border-neutral-800 rounded-2xl shadow-lg p-6 sm:p-8">
        <CalendarWidget />
      </section>
    </div>
  );
}
