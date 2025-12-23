"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  Search,
  RefreshCw,
  FileText,
  Trash2,
  X,
} from "lucide-react";
import { getPagesApi, deletePageApi } from "../../../api";

export default function PagesListPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // delete modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        .some((v: string) => String(v).toLowerCase().includes(q))
    );
  }, [pages, search]);

  const openDeleteModal = (page: any) => {
    setSelectedPage(page);
    setConfirmOpen(true);
  };

  const closeDeleteModal = () => {
    if (deletingId) return; // prevent closing while deleting
    setConfirmOpen(false);
    setSelectedPage(null);
  };

  const confirmDelete = async () => {
    if (!selectedPage?._id) return;

    const id = String(selectedPage._id);
    try {
      setDeletingId(id);
      await deletePageApi(id);

      // optimistic remove
      setPages((prev) => prev.filter((p) => String(p._id) !== id));
      setTotal((prev) => (typeof prev === "number" ? Math.max(0, prev - 1) : prev));

      closeDeleteModal();
    } catch (err: any) {
      console.error("Delete page failed:", err);
      setError(err?.message || "Failed to delete page.");
      setConfirmOpen(false);
      setSelectedPage(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 text-neutral-100">
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
            <span className="font-medium text-neutral-200">{pages.length}</span>{" "}
            pages
          </p>
        )}
      </div>

      {/* Error */}
      {!loading && error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 border border-neutral-800 bg-neutral-900/60 rounded-xl">
          <Loader2 className="animate-spin text-neutral-400 mb-3" size={32} />
          <p className="text-neutral-300 text-sm">Loading pages…</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filteredPages.length === 0 && (
        <div className="text-center py-14 border border-neutral-800 bg-neutral-900 rounded-xl">
          <p className="text-neutral-300 mb-2">No pages match your search.</p>

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

      {/* LIST TABLE */}
      {!loading && filteredPages.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/90 shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-950/90">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Title
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
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-800">
              {filteredPages.map((page) => {
                const status = page.status || "published";
                const isActive = page.active !== false;

                return (
                  <tr
                    key={page._id}
                    className="hover:bg-neutral-900/70 transition"
                  >
                    {/* Title */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/40">
                          {page.title?.charAt(0)?.toUpperCase() || "P"}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-50 line-clamp-1">
                            {page.title || "Untitled"}
                          </span>
                          {page.description && (
                            <span className="text-xs text-neutral-500 line-clamp-1">
                              {page.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      <span className="inline-flex items-center rounded-full bg-neutral-900/80 border border-neutral-700 px-2.5 py-1 text-[11px] font-mono">
                        /{page.slug}
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

                    {/* Actions */}
                    <td className="px-4 py-3 align-middle text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/pages/${page._id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800"
                        >
                          Edit
                        </Link>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(page)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="border-t border-neutral-800 px-4 py-2 text-xs text-neutral-500 flex items-center justify-between">
            <span>
              Showing {filteredPages.length} of {pages.length} page
              {pages.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRM MODAL */}
      {confirmOpen && selectedPage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onMouseDown={(e) => {
            // close only if backdrop clicked
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-neutral-800">
              <div>
                <h3 className="text-sm font-semibold text-neutral-100">
                  Delete page?
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  This action cannot be undone.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={!!deletingId}
                className="p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-400 disabled:opacity-50"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
                <p className="text-xs text-neutral-400">You are deleting:</p>
                <p className="text-sm font-medium text-neutral-100 mt-1 line-clamp-1">
                  {selectedPage.title || "Untitled"}
                </p>
                <p className="text-xs text-neutral-500 mt-1 font-mono">
                  /{selectedPage.slug}
                </p>
              </div>

              <p className="text-xs text-neutral-500">
                Tip: If you only want to hide it, consider setting it to inactive instead.
              </p>
            </div>

            <div className="p-4 border-t border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={!!deletingId}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={!!deletingId}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/25 disabled:opacity-60"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete page
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
