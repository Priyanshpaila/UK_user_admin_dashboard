// app/dashboard/schedules/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSchedulesApi } from "../../../api";
import Link from "next/link";
import {
  Loader2,
  CalendarPlus,
  Globe2,
  CalendarRange,
} from "lucide-react";

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
        const list: ScheduleListItem[] =
          (res as any)?.data || (res as any) || [];
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

  const isGlobal = (slug: string) =>
    !slug || slug.toLowerCase() === "global";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-neutral-100">
      {/* Header */}
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Schedules
          </h1>
          <p className="text-sm text-neutral-500">
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

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
          <Loader2 className="mb-2 h-6 w-6 animate-spin" />
          <p className="text-sm">Loading schedules…</p>
        </div>
      ) : schedules.length === 0 ? (
        // Empty state
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
        // Table
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/90 shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-gradient-to-r from-neutral-950 via-neutral-950/95 to-neutral-900/90">
            <div className="text-xs text-neutral-400">
              Showing{" "}
              <span className="font-semibold text-neutral-100">
                {schedules.length}
              </span>{" "}
              schedule{schedules.length !== 1 ? "s" : ""}
            </div>
          </div>

          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-950/90">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Service key
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
              {schedules.map((s) => {
                const global = isGlobal(s.service_slug);

                return (
                  <tr
                    key={s._id}
                    onClick={() =>
                      router.push(`/dashboard/schedules/${s._id}`)
                    }
                    className="cursor-pointer bg-neutral-950/60 hover:bg-neutral-900/80 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-50">
                          {s.name}
                        </span>
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          global
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                            : "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {global ? (
                          <Globe2 size={12} />
                        ) : (
                          <CalendarRange size={12} />
                        )}
                        {global ? "Global" : "Service-specific"}
                      </span>
                    </td>

                    {/* Service slug */}
                    <td className="px-4 py-3 align-middle">
                      <span className="inline-flex items-center rounded-full bg-neutral-900/80 px-2.5 py-1 text-[11px] font-mono text-neutral-300 border border-neutral-700/70">
                        {s.service_slug || "global"}
                      </span>
                    </td>

                    {/* Slot minutes */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      {s.slot_minutes}
                    </td>

                    {/* Capacity */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      {s.capacity}
                    </td>

                    {/* Timezone */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      <span className="text-xs">{s.timezone}</span>
                    </td>

                    {/* Updated */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      <span className="text-xs">
                        {formatUpdated(s.updatedAt)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="border-t border-neutral-800 px-4 py-2 text-xs text-neutral-500 flex items-center justify-between">
            <span>
              Showing {schedules.length} result
              {schedules.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
