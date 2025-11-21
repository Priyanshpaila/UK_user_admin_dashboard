"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClinicFormsApi, type ClinicForm } from "../../../api";
import {
  Loader2,
  Plus,
  FileText,
  ChevronRight,
  Filter,
  Activity,
} from "lucide-react";

type FormsListItem = ClinicForm & {
  updatedAt?: string;
  createdAt?: string;
};

export default function Page() {
  const router = useRouter();
  const [forms, setForms] = useState<FormsListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  const loadForms = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: any = await getClinicFormsApi();
      const list: FormsListItem[] = res?.data || res || [];
      setForms(list);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load forms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const handleCreate = () => {
    router.push("/dashboard/forms/create");
  };

  const handleRowClick = (id: string) => {
    router.push(`/dashboard/forms/${id}`);
  };

  const filteredForms = forms.filter((f) => {
    const matchesSearch =
      !search.trim() ||
      f.name?.toLowerCase().includes(search.toLowerCase()) ||
      f.service_slug?.toLowerCase().includes(search.toLowerCase()) ||
      f.form_type?.toLowerCase().includes(search.toLowerCase());

    const matchesActive = showOnlyActive ? f.is_active !== false : true;
    return matchesSearch && matchesActive;
  });

  const total = forms.length;
  const activeCount = forms.filter((f) => f.is_active !== false).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-neutral-50">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-400" />
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Clinic Forms
            </h1>
          </div>
          <p className="text-sm text-neutral-400">
            Manage dynamic forms used across services (RAF, consent, intake
            and more).
          </p>

          {/* Small stats row */}
          <div className="mt-2 flex gap-3 text-xs text-neutral-400">
            <div className="inline-flex items-center gap-1 rounded-full bg-neutral-900/80 border border-neutral-800 px-3 py-1.5">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-medium text-neutral-200">
                {activeCount}
              </span>
              <span>active form{activeCount === 1 ? "" : "s"}</span>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-neutral-900/80 border border-neutral-800 px-3 py-1.5">
              <span className="font-medium text-neutral-200">{total}</span>
              <span>total form{total === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg bg-neutral-900/80 border border-neutral-800 px-3 py-2 text-sm">
            <Filter className="h-4 w-4 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, service, type..."
              className="w-40 sm:w-56 bg-transparent outline-none text-neutral-100 placeholder:text-neutral-500"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
          >
            <Plus className="h-4 w-4" />
            New form
          </button>
        </div>
      </div>

      {/* Filter chips row */}
      <div className="mb-5 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setShowOnlyActive((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 transition-colors ${
            showOnlyActive
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
              : "bg-neutral-900/80 border-neutral-700 text-neutral-400 hover:border-emerald-500/40 hover:text-emerald-200"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Active only
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 text-neutral-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading forms…
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredForms.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-neutral-700 bg-neutral-900 px-8 py-10 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-neutral-50">
            No matching forms
          </h2>
          <p className="mb-6 text-sm text-neutral-400">
            {forms.length === 0
              ? "Create your first clinic form to power risk assessments, consents and intake flows."
              : "Try clearing filters or search to see more forms."}
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Create form
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filteredForms.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/90 shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-950/90">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Version
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Updated
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filteredForms.map((form) => {
                const updated =
                  form.updatedAt ||
                  (form as any).updated_at ||
                  form.createdAt;

                const updatedDisplay = updated
                  ? new Date(updated).toLocaleString()
                  : "—";

                const isActive = form.is_active !== false;
                const formType =
                  (form.form_type || "general").toString().toUpperCase();

                return (
                  <tr
                    key={form._id}
                    className="group hover:bg-neutral-900/80 cursor-pointer"
                    onClick={() => handleRowClick(form._id)}
                  >
                    {/* Name */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/40">
                          {form.name?.charAt(0)?.toUpperCase() || "F"}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-50">
                            {form.name || "Untitled form"}
                          </span>
                          {form.description && (
                            <span className="text-xs text-neutral-500 line-clamp-1">
                              {form.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Service */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      <span className="inline-flex items-center rounded-full bg-neutral-900/80 border border-neutral-700 px-2.5 py-1 text-[11px] font-mono">
                        {form.service_slug || "global"}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      <span className="inline-flex items-center rounded-full bg-neutral-900/80 border border-neutral-700 px-2.5 py-1 text-[11px]">
                        {formType}
                      </span>
                    </td>

                    {/* Version */}
                    <td className="px-4 py-3 align-middle text-center text-neutral-200">
                      {form.version ?? 1}
                    </td>

                    {/* Updated */}
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      <span className="text-xs">{updatedDisplay}</span>
                    </td>

                    {/* Status / action */}
                    <td className="px-4 py-3 align-middle text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                            isActive
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                              : "bg-neutral-800 border-neutral-600 text-neutral-400"
                          }`}
                        >
                          <span
                            className={`mr-1 h-1.5 w-1.5 rounded-full ${
                              isActive
                                ? "bg-emerald-400"
                                : "bg-neutral-500"
                            }`}
                          />
                          {isActive ? "Active" : "Inactive"}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(form._id);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800"
                        >
                          Edit
                          <ChevronRight className="h-3 w-3" />
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
              Showing {filteredForms.length} of {forms.length} form
              {forms.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
