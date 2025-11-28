"use client";

import React, { useEffect, useState } from "react";
import { getBackendBase } from "../../../api"; // centralized helper

/* -------------------- Types (new schema) -------------------- */

type Variation = {
  _id?: string;
  title: string;
  status: string; // "published" | "draft" | ...
  price: number;
  stock: number;
  max_qty: number;
  sort_order: number;
};

type Medicine = {
  _id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  status: string; // "published" | "draft" | ...
  max_bookable_quantity?: number;
  allow_reorder?: boolean;
  is_virtual?: boolean;
  variations: Variation[];
  image?: string;
};

type MedicinesListResponse = {
  data: Medicine[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};

type VariationForm = {
  title: string;
  price: string;
  stock: string;
  max_qty: string;
  sort_order: string;
  status: string;
};

type FormState = {
  sku: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  variations: VariationForm[];
};

/* -------------------- Helpers -------------------- */

const emptyVariation: VariationForm = {
  title: "",
  price: "",
  stock: "",
  max_qty: "",
  sort_order: "0",
  status: "published",
};

const emptyForm: FormState = {
  sku: "",
  name: "",
  slug: "",
  description: "",
  status: "draft",
  variations: [emptyVariation],
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function Page() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // image file + preview for the modal
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(
    null
  );

  // Track if user manually edited SKU / slug (so we don't override their value)
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  /* -------------------- Load list -------------------- */

  const loadMedicines = async () => {
    try {
      setLoading(true);
      setError(null);

      const base = getBackendBase();

      let token: string | null = null;
      if (typeof window !== "undefined") {
        token = localStorage.getItem("session_token");
      }

      const res = await fetch(`${base}/medicines`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to load medicines");
      }

      const json: MedicinesListResponse | Medicine[] = await res.json();

      const data = Array.isArray(json)
        ? json
        : (json.data as Medicine[]) || [];

      setMedicines(data);
      // if you need meta later: if (!Array.isArray(json) && json.meta) setMeta(json.meta);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load medicines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedicines();
  }, []);

  /* -------------------- Modal helpers -------------------- */

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      variations: [emptyVariation],
    });
    setImageFile(null);
    setImagePreview(null);
    setExistingImagePath(null);
    setSkuManuallyEdited(false);
    setSlugManuallyEdited(false);
    setIsModalOpen(true);
  };

  const openEdit = (med: Medicine) => {
    setEditing(med);

    const mappedVariations: VariationForm[] =
      med.variations && med.variations.length > 0
        ? med.variations.map((v, idx) => ({
            title: v.title || "",
            price: v.price != null ? String(v.price) : "",
            stock: v.stock != null ? String(v.stock) : "",
            max_qty: v.max_qty != null ? String(v.max_qty) : "",
            sort_order:
              v.sort_order != null ? String(v.sort_order) : String(idx),
            status: v.status || "published",
          }))
        : [emptyVariation];

    setForm({
      sku: med.sku || "",
      name: med.name || "",
      slug: med.slug || slugify(med.name || ""),
      description: med.description || "",
      status: med.status || "draft",
      variations: mappedVariations,
    });

    setImageFile(null);
    setExistingImagePath(med.image || null);

    if (med.image) {
      const baseForImage = getBackendBase().replace(/\/api\/?$/, "");
      const fullUrl = med.image.startsWith("http")
        ? med.image
        : `${baseForImage}/${med.image.replace(/^\/+/, "")}`;
      setImagePreview(fullUrl);
    } else {
      setImagePreview(null);
    }

    // Editing existing: treat slug/sku as manually set
    setSkuManuallyEdited(true);
    setSlugManuallyEdited(true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
    setExistingImagePath(null);
  };

  /* -------------------- Form handlers -------------------- */

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    // When name changes -> auto slug + sku unless manually overridden
    if (name === "name") {
      setForm((prev) => {
        const updated: FormState = { ...prev, name: value };
        const autoSlug = slugify(value);

        if (!slugManuallyEdited) {
          updated.slug = autoSlug;
        }
        if (!skuManuallyEdited) {
          updated.sku = autoSlug;
        }

        return updated;
      });
      return;
    }

    if (name === "slug") {
      setSlugManuallyEdited(true);
    }

    if (name === "sku") {
      setSkuManuallyEdited(true);
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleVariationChange = (
    index: number,
    field: keyof VariationForm,
    value: string
  ) => {
    setForm((prev) => {
      const updated = [...prev.variations];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variations: updated };
    });
  };

  const addVariation = () => {
    setForm((prev) => ({
      ...prev,
      variations: [
        ...prev.variations,
        {
          ...emptyVariation,
          sort_order: String(prev.variations.length),
        },
      ],
    }));
  };

  const removeVariation = (index: number) => {
    setForm((prev) => {
      if (prev.variations.length <= 1) return prev; // keep at least one
      const updated = prev.variations.filter((_, i) => i !== index);
      return { ...prev, variations: updated };
    });
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExistingImagePath(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!form.name.trim()) {
        throw new Error("Name is required.");
      }
      if (!form.sku.trim()) {
        throw new Error("SKU is required.");
      }

      const variationsPayload = form.variations
        .filter((v) => v.title.trim())
        .map((v, index) => ({
          title: v.title.trim(),
          status: v.status || "published",
          price: Number(v.price || 0),
          stock: Number(v.stock || 0),
          max_qty: Number(v.max_qty || 0),
          sort_order: v.sort_order
            ? Number(v.sort_order)
            : Number.isFinite(index)
            ? index
            : 0,
        }));

      if (variationsPayload.length === 0) {
        throw new Error("At least one variation is required.");
      }

      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        slug: (form.slug || slugify(form.name)).trim(),
        description: form.description.trim(),
        status: form.status || "draft",

        // 🔒 These are NOT taken from user
        max_bookable_quantity: 2,
        allow_reorder: true,
        is_virtual: false,

        variations: variationsPayload,
      };

      const base = getBackendBase();
      const url = editing?._id
        ? `${base}/medicines/${editing._id}`
        : `${base}/medicines`;
      const method = editing?._id ? "PUT" : "POST";

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("session_token")
          : null;

      if (!token) {
        throw new Error("No authentication token found.");
      }

      // Use FormData so we can still send image file + JSON payload
      const fd = new FormData();
      fd.append("sku", payload.sku);
      fd.append("name", payload.name);
      fd.append("slug", payload.slug);
      fd.append("description", payload.description);
      fd.append("status", payload.status);
      fd.append(
        "max_bookable_quantity",
        String(payload.max_bookable_quantity)
      );
      fd.append("allow_reorder", String(payload.allow_reorder));
      fd.append("is_virtual", String(payload.is_virtual));
      fd.append("variations", JSON.stringify(payload.variations));

      if (imageFile) {
        fd.append("image", imageFile);
      } else if (existingImagePath) {
        // backend can treat this as existing path
        fd.append("image", existingImagePath);
      }

      const res = await fetch(url, {
        method,
        body: fd,
        headers: {
          Authorization: `Bearer ${token}`,
          // ⚠️ Do NOT set Content-Type here; browser will set correct boundary for FormData
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to save medicine");
      }

      await loadMedicines();
      closeModal();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save medicine");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------- UI -------------------- */

  const baseForImageList = getBackendBase().replace(/\/api\/?$/, "");

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-neutral-100">
      {/* Header row with optional Create button */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Medicines</h1>

        {medicines.length > 0 && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
          >
            + Create medicine
          </button>
        )}
      </div>

      {/* Error (global) */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-10 text-center text-neutral-400">
          Loading medicines…
        </div>
      )}

      {/* Empty state */}
      {!loading && medicines.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-neutral-700 bg-neutral-900 px-8 py-10 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-neutral-50">
            No medicines yet
          </h2>
          <p className="mb-6 text-sm text-neutral-400">
            Start by creating your first medicine with variations and pricing.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
          >
            + Create medicine
          </button>
        </div>
      )}

      {/* Table list */}
      {!loading && medicines.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-sm">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-900/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Variations
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  From price
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {medicines.map((med) => {
                let imgSrc: string | undefined;
                if (med.image) {
                  imgSrc = med.image.startsWith("http")
                    ? med.image
                    : `${baseForImageList}/${med.image.replace(/^\/+/, "")}`;
                }

                const prices = (med.variations || [])
                  .map((v) => v.price)
                  .filter((p) => typeof p === "number" && !Number.isNaN(p));
                const minPrice =
                  prices.length > 0 ? Math.min(...prices) : undefined;

                const isActive =
                  med.status === "active" || med.status === "published";

                return (
                  <tr key={med._id} className="hover:bg-neutral-900/60">
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        {imgSrc && (
                          <div className="h-8 w-8 overflow-hidden rounded-md bg-neutral-808">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgSrc}
                              alt={med.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-neutral-50">
                            {med.name}
                          </div>
                          <p className="text-[11px] text-neutral-500">
                            {med.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      {med.sku}
                    </td>
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      {med.variations && med.variations.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {med.variations.slice(0, 3).map((v, idx) => (
                            <span
                              key={`${med._id}-var-${idx}`}
                              className="inline-flex rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-200"
                            >
                              {v.title}
                            </span>
                          ))}
                          {med.variations.length > 3 && (
                            <span className="text-[11px] text-neutral-500">
                              +{med.variations.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">
                          No variations
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-neutral-100">
                      {minPrice != null ? (
                        <>₹{minPrice.toFixed(2)}</>
                      ) : (
                        <span className="text-xs text-neutral-500">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-neutral-700 text-neutral-200"
                        }`}
                      >
                        {med.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(med)}
                        className="inline-flex items-center rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal (Create / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800/80 shadow-[0_18px_60px_rgba(0,0,0,0.85)] transform transition-all duration-200 scale-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  {editing ? "Update existing medicine" : "Add new medicine"}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-neutral-50 flex items-center gap-2">
                  {editing ? "Edit Medicine" : "Create Medicine"}
                  <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-[2px] text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                    Inventory
                  </span>
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700/70 bg-neutral-900/80 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/90 hover:border-neutral-600 transition-colors"
              >
                <span className="sr-only">Close</span>✕
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col max-h-[78vh]"
            >
              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 pr-3">
                {/* Section: Basic details */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[11px] text-blue-400 border border-blue-500/30">
                      1
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-200">
                        Basic details
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Name, slug and SKU for this medicine.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        placeholder="e.g. Mounjaro (tirzepatide)"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Slug <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="slug"
                        value={form.slug}
                        onChange={handleChange}
                        required
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        placeholder="mounjaro-tirzepatide"
                      />
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Auto-generated from name, but you can override if
                        needed.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        SKU <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="sku"
                        value={form.sku}
                        onChange={handleChange}
                        required
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        placeholder="mounjaro-tirzepatide"
                      />
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Defaults to the slug. You can use any internal code you
                        prefer.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Status
                      </label>
                      <select
                        name="status"
                        value={form.status}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section: Variations & pricing */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center text-[11px] text-amber-400 border border-amber-500/30">
                      2
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-200">
                        Variations &amp; pricing
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Configure different strengths / pack sizes with their
                        own price and stock.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {form.variations.map((variation, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                              Variation #{index + 1}
                            </span>
                            {variation.title && (
                              <span className="text-xs text-neutral-300">
                                ({variation.title})
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVariation(index)}
                            disabled={form.variations.length <= 1}
                            className="text-[11px] text-neutral-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                              Title <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={variation.title}
                              onChange={(e) =>
                                handleVariationChange(
                                  index,
                                  "title",
                                  e.target.value
                                )
                              }
                              required
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              placeholder="e.g. 2.5mg"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                              Price <span className="text-red-400">*</span>
                            </label>
                            <div className="flex items-center rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
                              <span className="mr-2 text-xs text-neutral-500">
                                ₹
                              </span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={variation.price}
                                onChange={(e) =>
                                  handleVariationChange(
                                    index,
                                    "price",
                                    e.target.value
                                  )
                                }
                                className="w-full bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                              Stock
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={variation.stock}
                              onChange={(e) =>
                                handleVariationChange(
                                  index,
                                  "stock",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                              Max qty per order
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={variation.max_qty}
                              onChange={(e) =>
                                handleVariationChange(
                                  index,
                                  "max_qty",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              placeholder="e.g. 2"
                            />
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                              Sort order
                            </label>
                            <input
                              type="number"
                              value={variation.sort_order}
                              onChange={(e) =>
                                handleVariationChange(
                                  index,
                                  "sort_order",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                              Status
                            </label>
                            <select
                              value={variation.status}
                              onChange={(e) =>
                                handleVariationChange(
                                  index,
                                  "status",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            >
                              <option value="published">Published</option>
                              <option value="draft">Draft</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addVariation}
                      className="inline-flex items-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:border-blue-500 hover:bg-neutral-900 transition-colors"
                    >
                      + Add variation
                    </button>
                    <p className="text-[11px] text-neutral-500">
                      Only title and price are required. Other fields help with
                      stock management and ordering behaviour.
                    </p>
                  </div>
                </div>

                {/* Section: Image & description */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-purple-500/10 flex items-center justify-center text-[11px] text-purple-300 border border-purple-500/30">
                      3
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-200">
                        Image &amp; description
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Optional details to make this medicine easy to
                        recognise.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Image uploader */}
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Image
                      </label>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          className="relative h-16 w-16 rounded-lg border border-dashed border-neutral-700 bg-neutral-900/80 flex items-center justify-center overflow-hidden hover:border-blue-500/60 hover:bg-neutral-800/80 transition-colors"
                          onClick={() =>
                            document
                              .getElementById("medicine-image-input")
                              ?.click()
                          }
                        >
                          {imagePreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imagePreview}
                              alt="preview"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[11px] text-neutral-400 text-center px-1">
                              Click to upload
                            </span>
                          )}
                        </button>

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                document
                                  .getElementById("medicine-image-input")
                                  ?.click()
                              }
                              className="inline-flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800 transition-colors"
                            >
                              Choose file
                            </button>

                            {(imagePreview || existingImagePath) && (
                              <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="inline-flex items-center justify-center rounded-md border border-red-500/60 bg-red-600/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-600/20 transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <span className="text-[11px] text-neutral-500">
                            JPG or PNG, a few MB max.
                          </span>
                        </div>
                      </div>
                      <input
                        id="medicine-image-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                          setExistingImagePath(null);
                        }}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        placeholder="Short description, e.g. available strengths or pack information."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky footer actions */}
              <div className="border-t border-neutral-800 bg-neutral-900/90 px-6 py-3 flex items-center justify-end gap-3 rounded-b-2xl">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-70 transition-colors"
                >
                  {submitting
                    ? editing
                      ? "Saving..."
                      : "Creating..."
                    : editing
                    ? "Save changes"
                    : "Create medicine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
