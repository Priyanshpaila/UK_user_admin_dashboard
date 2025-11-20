"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClinicFormsApi, type ClinicForm } from "../../../api";
import { Loader2, Plus, FileText, ChevronRight } from "lucide-react";

type FormsListItem = ClinicForm & {
  updatedAt?: string;
};

export default function Page() {
  const router = useRouter();
  const [forms, setForms] = useState<FormsListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // route to your create page (adjust if needed)
    router.push("/dashboard/forms/create");
  };

  const handleRowClick = (id: string) => {
    // route to your edit page (adjust if needed)
    router.push(`/dashboard/forms/${id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-neutral-50">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-400" />
            Clinic Forms
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage dynamic forms used across services (RAF, consent, etc.).
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          <Plus className="h-4 w-4" />
          New form
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
      {!loading && !error && forms.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-neutral-700 bg-neutral-900 px-8 py-10 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-neutral-50">
            No forms yet
          </h2>
          <p className="mb-6 text-sm text-neutral-400">
            Create your first clinic form to power risk assessments, consents and
            other intake flows.
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
      {!loading && !error && forms.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-sm">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-900/80">
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {forms.map((form) => {
                const updated =
                  form.updatedAt ||
                  (form as any).updated_at ||
                  (form as any).createdAt;

                const updatedDisplay = updated
                  ? new Date(updated).toLocaleString()
                  : "—";

                return (
                  <tr
                    key={form._id}
                    className="group hover:bg-neutral-900/70 cursor-pointer"
                    onClick={() => handleRowClick(form._id)}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/40">
                          {form.name?.charAt(0)?.toUpperCase() || "F"}
                        </span>
                        <div>
                          <div className="font-medium text-neutral-50">
                            {form.name || "Untitled form"}
                          </div>
                          {form.description && (
                            <div className="text-xs text-neutral-500 line-clamp-1">
                              {form.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 align-middle text-neutral-300">
                      {form.service_slug || "global"}
                    </td>

                    <td className="px-4 py-3 align-middle text-neutral-300">
                      {(form.form_type || "general").toUpperCase()}
                    </td>

                    <td className="px-4 py-3 align-middle text-center text-neutral-200">
                      {form.version ?? 1}
                    </td>

                    <td className="px-4 py-3 align-middle text-neutral-300">
                      {updatedDisplay}
                    </td>

                    <td className="px-4 py-3 align-middle text-right">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
