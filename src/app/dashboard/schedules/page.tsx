// app/dashboard/schedules/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSchedulesApi } from "../../../api"; // adjust path if needed
import Link from "next/link";
import { Loader2, CalendarPlus } from "lucide-react";

type ScheduleListItem = {
  _id: string;
  name: string;
  service_slug: string;
  timezone: string;
  slot_minutes: number;
  capacity: number;
  updatedAt?: string;
};

export default function Page() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getSchedulesApi();
        const list: ScheduleListItem[] = (res as any)?.data || (res as any) || [];
        setSchedules(list);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Failed to load schedules");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatUpdated = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-neutral-100">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedules</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage global and service-specific booking availability.
          </p>
        </div>

        <Link
          href="/dashboard/schedules/create"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-colors"
        >
          <CalendarPlus size={16} />
          New schedule
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading schedules…
        </div>
      ) : schedules.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-neutral-700 bg-neutral-900 px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-neutral-50">
            No schedules yet
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Create a global or service-specific schedule to start accepting
            bookings.
          </p>
          <Link
            href="/dashboard/schedules/create"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500"
          >
            <CalendarPlus size={16} />
            Create schedule
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/80 shadow-sm">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-950">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Slot (min)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Cap.
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Timezone
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {schedules.map((s) => (
                <tr
                  key={s._id}
                  onClick={() => router.push(`/dashboard/schedules/${s._id}`)}
                  className="cursor-pointer bg-neutral-950/60 hover:bg-neutral-900/70 transition-colors"
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="font-medium text-neutral-50">{s.name}</div>
                  </td>
                  <td className="px-4 py-3 align-middle text-neutral-300">
                    {s.service_slug || "—"}
                  </td>
                  <td className="px-4 py-3 align-middle text-neutral-300">
                    {s.slot_minutes}
                  </td>
                  <td className="px-4 py-3 align-middle text-neutral-300">
                    {s.capacity}
                  </td>
                  <td className="px-4 py-3 align-middle text-neutral-300">
                    {s.timezone}
                  </td>
                  <td className="px-4 py-3 align-middle text-neutral-300">
                    {formatUpdated(s.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-neutral-800 px-4 py-2 text-xs text-neutral-500">
            Showing {schedules.length} result
            {schedules.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
