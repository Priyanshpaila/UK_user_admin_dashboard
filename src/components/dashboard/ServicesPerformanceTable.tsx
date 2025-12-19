"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  getAnalyticsByServiceApi,
  type AnalyticsByServiceResponse,
} from "../../api";
import { formatGBP } from "./dashboard-utils";
import CardPeriodPicker, { type CardPeriodKey } from "./CardPeriodPicker";

/* --------- date helpers (UTC) --------- */
function toIsoStartOfDayUTC(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return x.toISOString();
}
function toIsoEndOfDayUTC(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return x.toISOString();
}
function addDaysUTC(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
function addMonthsUTC(d: Date, months: number) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}
function addYearsUTC(d: Date, years: number) {
  const x = new Date(d);
  x.setUTCFullYear(x.getUTCFullYear() + years);
  return x;
}

function rangeFromKey(now: Date, key: CardPeriodKey) {
  const end = toIsoEndOfDayUTC(now);

  if (key === "daily7d") {
    const start = toIsoStartOfDayUTC(addDaysUTC(now, -6));
    return { start, end };
  }
  if (key === "weekly12w") {
    const start = toIsoStartOfDayUTC(addDaysUTC(now, -83));
    return { start, end };
  }
  if (key === "monthly12m") {
    const start = toIsoStartOfDayUTC(addMonthsUTC(now, -12));
    return { start, end };
  }
  const start = toIsoStartOfDayUTC(addYearsUTC(now, -5));
  return { start, end };
}

export default function ServicesPerformanceTable() {
  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<CardPeriodKey>("daily7d");

  const { start, end } = useMemo(() => rangeFromKey(now, period), [now, period]);

  const [data, setData] = useState<AnalyticsByServiceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await getAnalyticsByServiceApi({ start, end });
        if (!cancelled) setData(res);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const rows = data?.data || [];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-neutral-100">Services Performance</p>
          <p className="text-[11px] text-neutral-400">
            {new Date(start).toLocaleDateString("en-GB")} –{" "}
            {new Date(end).toLocaleDateString("en-GB")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {loading && (
            <span className="flex items-center gap-2 text-[11px] text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </span>
          )}

          <CardPeriodPicker
            title="Period"
            value={period}
            onChange={setPeriod}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-neutral-400 border-b border-neutral-800">
              <th className="text-left py-2">Service</th>
              <th className="text-right py-2">Bookings</th>
              <th className="text-right py-2">Revenue</th>
              <th className="text-right py-2">% of total</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="py-3 text-neutral-500" colSpan={4}>
                  No services data for selected period.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.service_id} className="border-b border-neutral-900">
                  <td className="py-2 text-neutral-200">{r.service_name}</td>
                  <td className="py-2 text-right text-neutral-200">{r.bookings}</td>
                  <td className="py-2 text-right text-neutral-200">
                    {formatGBP(r.revenue || 0)}
                  </td>
                  <td className="py-2 text-right text-neutral-200">
                    {Number(r.percent_of_total_revenue || 0).toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
