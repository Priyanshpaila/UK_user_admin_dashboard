"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  getRevenueBookingsAnalyticsApi,
  type RevenueBookingsResponse,
} from "../../api";
import { formatBucketLabel } from "./dashboard-utils";
import RangeGranularitySelect, {
  type ChartPresetKey,
  getPreset,
} from "./RangeGranularitySelect";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function BookingsChartCard({
  presetKey,
  onPresetChange,
}: {
  presetKey: ChartPresetKey;
  onPresetChange: (k: ChartPresetKey) => void;
}) {
  const [data, setData] = useState<RevenueBookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const preset = getPreset(presetKey);

        const res = await getRevenueBookingsAnalyticsApi({
          granularity: preset.granularity,
          ...(typeof preset.start === "string" ? { start: preset.start } : {}),
          ...(typeof preset.end === "string" ? { end: preset.end } : {}),
          ...(typeof preset.last === "number" ? { last: preset.last } : {}),
        });

        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load bookings analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [presetKey]);

  const series = useMemo(() => {
    const s = data?.series || [];
    return s.map((r) => ({
      bucket: formatBucketLabel(r.bucket),
      bookings: r.bookings || 0,
    }));
  }, [data]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-neutral-100">
            Bookings Analysis
          </p>
          <p className="text-[11px] text-neutral-400">
            Bookings trend for selected period
          </p>
        </div>

        <div className="flex items-center gap-3">
          {data?.totals && (
            <div className="text-right">
              <p className="text-[11px] text-neutral-400">Total</p>
              <p className="text-sm font-semibold text-neutral-100">
                {data.totals.bookings ?? 0}
              </p>
            </div>
          )}

          <RangeGranularitySelect value={presetKey} onChange={onPresetChange} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-neutral-300 text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading bookings…
        </div>
      ) : err ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          {err}
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v: any) => Number(v)} labelStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="bookings" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
