"use client";
import CalendarWidget from "../../components/ui/Calendar";

export default function DashboardPage() {
  return (
    <div className="w-full max-w-7xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400">
          Overview of appointments and schedules
        </p>
      </div>

      <CalendarWidget />
    </div>
  );
}
