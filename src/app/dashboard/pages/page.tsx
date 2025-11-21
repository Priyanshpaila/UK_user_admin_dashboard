"use client";
import React, { useEffect, useState } from "react";
import { getPagesApi } from "../../../api";
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";

export default function Page() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        setLoading(true);

        const response = await getPagesApi();
        // response shape: { data: [...], meta: {...} }
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
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pages</h1>
          {total !== null && (
            <p className="text-xs text-neutral-500 mt-1">
              {total} page{total === 1 ? "" : "s"} total
            </p>
          )}
        </div>

        <Link
          href="/dashboard/pages/create"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
        >
          <Plus size={18} />
          New Page
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-400" size={32} />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-14 border border-neutral-800 bg-neutral-900 rounded-xl">
          <p className="text-neutral-300">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && pages.length === 0 && !error && (
        <div className="text-center py-14 border border-neutral-800 bg-neutral-900 rounded-xl">
          <p className="text-neutral-300">No pages found.</p>
          <Link
            href="/dashboard/pages/create"
            className="mt-4 inline-flex gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus size={18} />
            Create First Page
          </Link>
        </div>
      )}

      {/* List */}
      {!loading && pages.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
          {pages.map((page) => (
            <div
              key={page._id}
              className="p-4 flex justify-between items-center hover:bg-neutral-800 transition"
            >
              <div>
                <p className="text-white font-medium">{page.title}</p>
                <p className="text-neutral-400 text-xs mt-0.5">
                  /{page.slug}
                </p>
                <p className="text-neutral-500 text-xs mt-1 capitalize">
                  {page.status || "published"}
                </p>
              </div>

              <div className="flex space-x-4 items-center">
                {/* EDIT PAGE → uses PAGE ID */}
                <Link
                  href={`/dashboard/pages/${page._id}`}
                  className="text-yellow-400 hover:underline text-sm"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
