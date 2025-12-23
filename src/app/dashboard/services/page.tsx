"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, Search, RefreshCw, Settings2 } from "lucide-react";
import { getServiceApi } from "../../../api";

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getServiceApi("");

      if (!response || !Array.isArray(response.data) || response.data.length === 0) {
        setServices([]);
        setError("No services found.");
      } else {
        setServices(response.data);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load services.");
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter((svc) =>
      [svc.name, svc.slug, svc.description]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q))
    );
  }, [services, search]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 text-neutral-100">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings2 className="text-neutral-400" size={20} />
            Services
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage all pharmacy services and their booking flows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchServices}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            <RefreshCw size={16} className="shrink-0" />
            Refresh
          </button>

          <Link
            href="/dashboard/services/create"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
          >
            <Plus size={18} />
            Add Service
          </Link>
        </div>
      </div>

      {/* Top toolbar: search + count */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
        <div className="relative w-full md:max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, or description…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {!loading && (
          <p className="text-xs text-neutral-500">
            Showing{" "}
            <span className="font-medium text-neutral-200">
              {filteredServices.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-neutral-200">
              {services.length}
            </span>{" "}
            services
          </p>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 border border-neutral-800 bg-neutral-900/60 rounded-xl">
          <Loader2 className="animate-spin text-neutral-400 mb-3" size={32} />
          <p className="text-neutral-300 text-sm">Loading services…</p>
        </div>
      )}

      {/* Error / empty state */}
      {!loading && (error || filteredServices.length === 0) && (
        <div className="text-center py-14 border border-neutral-800 bg-neutral-900 rounded-xl">
          <p className="text-neutral-300 mb-2">
            {error || "No services match your search."}
          </p>

          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={fetchServices}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              <RefreshCw size={16} />
              Retry
            </button>

            <Link
              href="/dashboard/services/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Plus size={16} />
              Create Service
            </Link>
          </div>
        </div>
      )}

      {/* LIST TABLE */}
      {!loading && filteredServices.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/90 shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-950/90">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Slug
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Active
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  View Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-800">
              {filteredServices.map((svc) => {
                const status = svc.status || "published";
                const isActive = svc.active !== false;

                return (
                  <tr key={svc._id} className="hover:bg-neutral-900/70 transition">
                    {/* Name */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/40">
                          {svc.name?.charAt(0)?.toUpperCase() || "S"}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-50">
                            {svc.name || "Untitled service"}
                          </span>
                          {svc.description && (
                            <span className="text-xs text-neutral-500 line-clamp-1">
                              {svc.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      <span className="inline-flex items-center rounded-full bg-neutral-900/80 border border-neutral-700 px-2.5 py-1 text-[11px] font-mono">
                        /{svc.slug || "—"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                          status === "published"
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                            : "bg-amber-500/10 border-amber-500/40 text-amber-300"
                        }`}
                      >
                        {String(status).toUpperCase()}
                      </span>
                    </td>

                    {/* Active */}
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                          isActive
                            ? "bg-blue-500/10 border-blue-500/40 text-blue-300"
                            : "bg-neutral-800 border-neutral-700 text-neutral-400"
                        }`}
                      >
                        <span
                          className={`mr-1 h-1.5 w-1.5 rounded-full ${
                            isActive ? "bg-blue-400" : "bg-neutral-500"
                          }`}
                        />
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* View type */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      <span className="inline-flex items-center rounded-full bg-neutral-900/80 border border-neutral-700 px-2.5 py-1 text-[11px]">
                        {svc.view_type || "card"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 align-middle text-right">
                      <Link
                        href={`/dashboard/services/${svc._id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="border-t border-neutral-800 px-4 py-2 text-xs text-neutral-500 flex items-center justify-between">
            <span>
              Showing {filteredServices.length} of {services.length} service
              {services.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
