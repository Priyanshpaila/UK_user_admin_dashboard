"use client";

import React, { useMemo, useState } from "react";
import CalendarWidget from "../../components/ui/Calendar";

import PeriodFilter, {
  type PeriodPreset,
} from "../../components/dashboard/PeriodFilter";
import RevenueChartCard from "../../components/dashboard/RevenueChartCard";
import BookingsChartCard from "../../components/dashboard/BookingsChartCard";
import SummaryCards from "../../components/dashboard/SummaryCards";
import BookingStatusTable from "../../components/dashboard/BookingStatusTable";
import ServicesPerformanceTable from "../../components/dashboard/ServicesPerformanceTable";
import DailyRevenueTable from "../../components/dashboard/DailyRevenueTable";
import type { ChartPresetKey } from "../../components/dashboard/RangeGranularitySelect";

import {
  addDaysUTC,
  toIsoEndOfDayUTC,
  toIsoStartOfDayUTC,
} from "../../components/dashboard/dashboard-utils";

export default function DashboardPage() {
  const now = useMemo(() => new Date(), []);

  // Period filter (start/end range for tables + summaries)
  const [preset, setPreset] = useState<PeriodPreset>("7d");

  // Chart filter (Daily 7d / Weekly 12w / Monthly 12m / Yearly 5y)
  const [presetKey, setPresetKey] = useState<ChartPresetKey>("daily7d");

  // Default ranges
  const defaultEnd = useMemo(() => toIsoEndOfDayUTC(now), [now]);

  const defaultStart7 = useMemo(() => {
    const start = addDaysUTC(now, -6);
    return toIsoStartOfDayUTC(start);
  }, [now]);

  const defaultStart30 = useMemo(() => {
    const start = addDaysUTC(now, -29);
    return toIsoStartOfDayUTC(start);
  }, [now]);

  const [startIso, setStartIso] = useState<string>(defaultStart7);
  const [endIso, setEndIso] = useState<string>(defaultEnd);

  // Preset behavior
  function handlePresetChange(p: PeriodPreset) {
    setPreset(p);

    if (p === "7d") {
      setStartIso(defaultStart7);
      setEndIso(defaultEnd);
    } else if (p === "30d") {
      setStartIso(defaultStart30);
      setEndIso(defaultEnd);
    }
    // If you add more presets in PeriodFilter later, handle them here.
  }

  return (
    <div className="w-full max-w-7xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400">
            Overview of bookings, revenue, and service performance
          </p>
        </div>

        <PeriodFilter
          preset={preset}
          onPresetChange={handlePresetChange}
          start={startIso}
          end={endIso}
          onStartChange={setStartIso}
          onEndChange={setEndIso}
        />
      </div>

      {/* Calendar */}
      <div className="mb-6">
        <CalendarWidget />
      </div>

      {/* Charts (split into two segments) */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueChartCard presetKey={presetKey} onPresetChange={setPresetKey} />
        <BookingsChartCard presetKey={presetKey} onPresetChange={setPresetKey} />
      </div>

      {/* KPI cards */}
      <div className="mb-6 mt-6">
        <SummaryCards start={startIso} end={endIso} />
      </div>

      {/* Booking status */}
      <div className="mb-6">
       <BookingStatusTable />
      </div>

      {/* Services + Daily table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
       <ServicesPerformanceTable />
        <DailyRevenueTable start={startIso} end={endIso} />
      </div>
    </div>
  );
}
