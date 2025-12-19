"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getAnalyticsSummaryApi, type AnalyticsSummaryResponse } from "../../api";
import { formatGBP } from "./dashboard-utils";

export default function SummaryCards({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await getAnalyticsSummaryApi({ start, end });
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

  const totals = data?.totals;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        title="Total Revenue"
        value={loading ? "—" : formatGBP(totals?.revenue || 0)}
        loading={loading}
      />
      <KpiCard
        title="Total Bookings"
        value={loading ? "—" : String(totals?.bookings || 0)}
        loading={loading}
      />
      <KpiCard
        title="Avg / Booking"
        value={loading ? "—" : formatGBP(totals?.avg_revenue_per_booking || 0)}
        loading={loading}
      />
      <KpiCard
        title="Unpaid (from breakdown)"
        value={
          loading
            ? "—"
            : String(
                data?.breakdown?.byPaymentStatus?.find((x) => x.payment_status === "pending")
                  ?.bookings || 0
              )
        }
        loading={loading}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  loading,
}: {
  title: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-[0_0_40px_rgba(0,0,0,0.25)]">
      <p className="text-[11px] text-neutral-400">{title}</p>
      <div className="mt-2 flex items-center gap-2">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
        <p className="text-xl font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}
