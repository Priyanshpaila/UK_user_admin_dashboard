"use client";

import React, { useEffect, useState } from "react";
import {
  getMedicinesApi,
  getBackendBase,
  createMedicineApi,
  updateMedicineApi,
} from "../../../api"; // centralized helpers

type Medicine = {
  _id: string;
  sku: string;
  name: string;
  variations: string;
  variation: string;
  strength: string | null;
  qty: number;
  unitMinor: number;
  totalMinor: number;
  price: number;
  image?: string;
  description?: string;
  status: string;
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

type FormState = {
  sku: string;
  name: string;
  variations: string;
  variation: string;
  strength: string;
  qty: string;
  unitMinor: string;
  totalMinor: string;
  price: string;
  description: string;
  status: string;
};

const emptyForm: FormState = {
  sku: "",
  name: "",
  variations: "",
  variation: "",
  strength: "",
  qty: "",
  unitMinor: "",
  totalMinor: "",
  price: "",
  description: "",
  status: "active",
};

// ---- SKU generator: PARA500 from "Paracetamol" + "500mg" ----
function generateSku(name: string, strength: string): string {
  // Take letters from name, strip spaces/symbols
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = letters.slice(0, 4); // PARA

  // Take all digits from strength (handles "500mg", "500 MG", "500/125mg", etc)
  const digitsMatch = strength.match(/\d+/g);
  const digits = digitsMatch ? digitsMatch.join("") : ""; // "500"

  if (!prefix && !digits) return "";
  return `${prefix}${digits}`;
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

  // Track if user manually edited SKU (so we don't override their value)
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);

  /* ------------ Fetch list ------------ */

  const loadMedicines = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await getMedicinesApi()) as MedicinesListResponse;
      setMedicines(res?.data || []);
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

  /* ------------ Modal helpers ------------ */

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setExistingImagePath(null);
    setSkuManuallyEdited(false); // fresh auto-SKU generation for new item
    setIsModalOpen(true);
  };

  const openEdit = (med: Medicine) => {
    setEditing(med);
    setForm({
      sku: med.sku || "",
      name: med.name || "",
      variations: med.variations || "",
      variation: med.variation || med.variations || "",
      strength: med.strength || "",
      qty: med.qty != null ? String(med.qty) : "",
      unitMinor: med.unitMinor != null ? String(med.unitMinor) : "",
      totalMinor: med.totalMinor != null ? String(med.totalMinor) : "",
      price: med.price != null ? String(med.price) : "",
      description: med.description || "",
      status: med.status || "active",
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

    // When editing, treat SKU as "manual" so we don't auto-change it if they tweak name/strength
    setSkuManuallyEdited(true);
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

  /* ------------ Form handlers ------------ */

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    // If user types directly in SKU, mark it as manually edited and update as-is
    if (name === "sku") {
      setSkuManuallyEdited(true);
      setForm((prev) => ({ ...prev, sku: value }));
      return;
    }

    // For name/strength, auto-generate SKU when user hasn't manually changed SKU yet
    if (name === "name" || name === "strength") {
      setForm((prev) => {
        const updated: FormState = { ...prev, [name]: value };

        if (!skuManuallyEdited) {
          updated.sku = generateSku(
            name === "name" ? value : updated.name,
            name === "strength" ? value : updated.strength
          );
        }

        return updated;
      });
      return;
    }

    // Default for other fields
    setForm((prev) => ({ ...prev, [name]: value }));
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
      // Build payload for the helper (matches MedicinePayload in api.ts)
      const payload: any = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        variations: form.variations.trim(),
        strength: form.strength.trim() || null,
        qty: Number(form.qty || 0),
        price: Number(form.price || 0),
        status: form.status.trim() || "active",
        description: form.description.trim() || "",
      };

      // Image handling – matches updated api.ts field name: image
      if (imageFile) {
        payload.image = imageFile;
      } else if (existingImagePath) {
        payload.image = existingImagePath;
      }

      if (editing?._id) {
        await updateMedicineApi(editing._id, payload);
      } else {
        await createMedicineApi(payload);
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

  /* ------------ UI ------------ */

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
            Start by creating your first medicine. You can later edit details
            and update stock.
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
                  Variation
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Qty
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

                return (
                  <tr key={med._id} className="hover:bg-neutral-900/60">
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        {imgSrc && (
                          <div className="h-8 w-8 overflow-hidden rounded-md bg-neutral-800">
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
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      {med.sku}
                    </td>
                    <td className="px-4 py-3 align-middle text-neutral-300">
                      {med.variation || med.variations}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-neutral-100">
                      ₹{med.price?.toFixed?.(2) ?? med.price}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-neutral-100">
                      {med.qty}
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          med.status === "active"
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
                        Name, SKU and key identification fields.
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
                        placeholder="e.g. Paracetamol"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Strength
                      </label>
                      <input
                        type="text"
                        name="strength"
                        value={form.strength}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        placeholder="e.g. 500mg"
                      />
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
                        placeholder="Auto from name + strength (editable)"
                      />
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Auto-generated like <span className="font-mono">PARA500</span> from
                        name + strength. You can still override it.
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Variations
                      </label>
                      <input
                        type="text"
                        name="variations"
                        value={form.variations}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        placeholder='e.g. "10 tablets | 20 tablets"'
                      />
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
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section: Stock & pricing */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center text-[11px] text-amber-400 border border-amber-500/30">
                      2
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-200">
                        Stock & pricing
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Manage stock units and price.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Qty (stock) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        name="qty"
                        value={form.qty}
                        onChange={handleChange}
                        min={0}
                        required
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Price <span className="text-red-400">*</span>
                      </label>
                      <div className="flex items-center rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
                        <span className="mr-2 text-xs text-neutral-500">₹</span>
                        <input
                          type="number"
                          name="price"
                          value={form.price}
                          onChange={handleChange}
                          min={0}
                          step="0.01"
                          required
                          className="w-full bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
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
                        Image & description
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
                        placeholder="Notes, usage instructions or other helpful info for staff."
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
