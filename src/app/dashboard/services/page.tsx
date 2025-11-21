"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Loader2, Search, RefreshCw } from "lucide-react";
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
        .some((v: string) => v.toLowerCase().includes(q))
    );
  }, [services, search]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Services</h1>
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

      {/* Services grid */}
      {!loading && filteredServices.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredServices.map((svc) => {
            const status = svc.status || "published";
            const isActive = svc.active !== false;

            return (
              <div
                key={svc._id}
                className="group rounded-xl border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 transition shadow-sm flex flex-col"
              >
                <div className="p-4 flex-1 flex flex-col gap-2">
                  {/* Top row: name + status pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-white line-clamp-1">
                        {svc.name}
                      </h2>
                      <p className="text-xs text-neutral-500">
                        /{svc.slug}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          status === "published"
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {status}
                      </span>

                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          isActive
                            ? "border-blue-500/40 text-blue-300 bg-blue-500/5"
                            : "border-neutral-600 text-neutral-300 bg-neutral-800"
                        }`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {svc.description && (
                    <p className="text-xs text-neutral-300 mt-1 line-clamp-3">
                      {svc.description}
                    </p>
                  )}
                </div>

                {/* Footer actions */}
                <div className="px-4 py-3 border-t border-neutral-800 flex items-center justify-between">
                  <div className="text-[11px] text-neutral-500">
                    View type:{" "}
                    <span className="text-neutral-300 font-medium">
                      {svc.view_type || "card"}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/services/${svc._id}`}
                    className="text-xs font-medium text-blue-400 group-hover:text-blue-300 hover:underline"
                  >
                    Edit service
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
