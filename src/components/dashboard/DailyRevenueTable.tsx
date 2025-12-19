"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  getRevenueBookingsAnalyticsApi,
  type RevenueBookingsResponse,
} from "../../api";
import { formatBucketLabel, formatGBP } from "./dashboard-utils";

export default function DailyRevenueTable({
  start,
  end,
}: {
  start: string;
  end: string;
}) {
  const [data, setData] = useState<RevenueBookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await getRevenueBookingsAnalyticsApi({
          start,
          end,
          granularity: "daily",
        });
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

  const rows = useMemo(() => {
    const s = data?.series || [];
    // latest first
    return [...s].reverse();
  }, [data]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-neutral-100">Daily Revenue Table</p>
        {loading && (
          <span className="flex items-center gap-2 text-[11px] text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-neutral-400 border-b border-neutral-800">
              <th className="text-left py-2">Date</th>
              <th className="text-right py-2">Revenue</th>
              <th className="text-right py-2">Bookings</th>
              <th className="text-right py-2">Avg / booking</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="py-3 text-neutral-500" colSpan={4}>
                  No daily rows for selected period.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.bucket} className="border-b border-neutral-900">
                  <td className="py-2 text-neutral-200">{formatBucketLabel(r.bucket)}</td>
                  <td className="py-2 text-right text-neutral-200">{formatGBP(r.revenue || 0)}</td>
                  <td className="py-2 text-right text-neutral-200">{r.bookings || 0}</td>
                  <td className="py-2 text-right text-neutral-200">
                    {formatGBP(r.avg_revenue_per_booking || 0)}
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
