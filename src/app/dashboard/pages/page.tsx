"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, Search, RefreshCw, FileText } from "lucide-react";
import { getPagesApi } from "../../../api";

export default function PagesListPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const fetchPages = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getPagesApi();
      const list = Array.isArray((response as any)?.data)
        ? (response as any).data
        : [];

      setPages(list);
      setTotal((response as any)?.meta?.total ?? list.length);

      if (!list.length) {
        setError("No pages found.");
      }
    } catch (err) {
      console.error("Error fetching pages:", err);
      setError("Failed to load pages.");
      setPages([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const filteredPages = useMemo(() => {
    if (!search.trim()) return pages;
    const q = search.toLowerCase();

    return pages.filter((p) =>
      [p.title, p.slug, p.description]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q))
    );
  }, [pages, search]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText size={22} className="text-neutral-400" />
            Pages
          </h1>
          {total !== null && (
            <p className="text-xs text-neutral-500 mt-1">
              {total} page{total === 1 ? "" : "s"} total
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPages}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            <RefreshCw size={16} className="shrink-0" />
            Refresh
          </button>

          <Link
            href="/dashboard/pages/create"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
          >
            <Plus size={18} />
            New Page
          </Link>
        </div>
      </div>

      {/* Toolbar: search + count */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
        <div className="relative w-full md:max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, slug, or description…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {!loading && (
          <p className="text-xs text-neutral-500">
            Showing{" "}
            <span className="font-medium text-neutral-200">
              {filteredPages.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-neutral-200">
              {pages.length}
            </span>{" "}
            pages
          </p>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 border border-neutral-800 bg-neutral-900/60 rounded-xl">
          <Loader2 className="animate-spin text-neutral-400 mb-3" size={32} />
          <p className="text-neutral-300 text-sm">Loading pages…</p>
        </div>
      )}

      {/* Error / empty */}
      {!loading && (error || filteredPages.length === 0) && (
        <div className="text-center py-14 border border-neutral-800 bg-neutral-900 rounded-xl">
          <p className="text-neutral-300 mb-2">
            {error || "No pages match your search."}
          </p>

          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={fetchPages}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              <RefreshCw size={16} />
              Retry
            </button>

            <Link
              href="/dashboard/pages/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Plus size={16} />
              Create Page
            </Link>
          </div>
        </div>
      )}

      {/* Pages grid */}
      {!loading && filteredPages.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPages.map((page) => {
            const status = page.status || "published";
            const isActive = page.active !== false;

            return (
              <div
                key={page._id}
                className="group rounded-xl border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 transition shadow-sm flex flex-col"
              >
                <div className="p-4 flex-1 flex flex-col gap-2">
                  {/* Top row: title + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-white line-clamp-1">
                        {page.title}
                      </h2>
                      <p className="text-xs text-neutral-500">
                        /{page.slug}
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
                  {page.description && (
                    <p className="text-xs text-neutral-300 mt-1 line-clamp-3">
                      {page.description}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-neutral-800 flex items-center justify-between">
                  <div className="text-[11px] text-neutral-500">
                    Linked service:{" "}
                    <span className="text-neutral-300 font-medium">
                      {page.service_id ? "Yes" : "No"}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/pages/${page._id}`}
                    className="text-xs font-medium text-blue-400 group-hover:text-blue-300 hover:underline"
                  >
                    Edit page
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
