"use client";

import React, { useEffect, useState } from "react";
import { getMedicinesApi, getBackendBase } from "../../../api"; // centralized helpers

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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const base = getBackendBase();

    // Build FormData for multipart/form-data
    const fd = new FormData();
    fd.append("sku", form.sku.trim());
    fd.append("name", form.name.trim());
    fd.append("variations", form.variations.trim());
    fd.append("variation", (form.variation || form.variations).trim());
    fd.append("strength", form.strength.trim());
    fd.append("qty", form.qty || "0");
    fd.append("unitMinor", form.unitMinor || "0");
    fd.append("totalMinor", form.totalMinor || "0");
    fd.append("price", form.price || "0");
    fd.append("description", form.description.trim());
    fd.append("status", form.status.trim() || "active");

    // If a new image is chosen, send it as file in FormData
    if (imageFile) {
      // 👇 field name "image" must match your Nest multer @UploadedFile() name
      fd.append("image", imageFile);
    }
    // If no new file selected and you want backend to keep the old image,
    // you can either:
    // - do nothing (backend keeps current image), OR
    // - send existingImage manually if your backend supports that.
    // I'll leave it as "do nothing" to avoid extra DTO fields.

    try {
      let url = `${base}/medicines`;
      let method: "POST" | "PUT" = "POST";

      if (editing?._id) {
        url = `${base}/medicines/${editing._id}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Medicine save failed:", txt);
        setError("Failed to save medicine");
        return;
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
                    : `${baseForImageList}/${med.image.replace(
                        /^\/+/,
                        ""
                      )}`;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-50">
                {editing ? "Edit medicine" : "Create medicine"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              >
                <span className="sr-only">Close</span>✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    SKU
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={form.sku}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
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
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Variation (primary)
                  </label>
                  <input
                    type="text"
                    name="variation"
                    value={form.variation}
                    onChange={handleChange}
                    placeholder="If empty, variations will be used"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Qty (stock)
                  </label>
                  <input
                    type="number"
                    name="qty"
                    value={form.qty}
                    onChange={handleChange}
                    min={0}
                    required
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Unit minor
                  </label>
                  <input
                    type="number"
                    name="unitMinor"
                    value={form.unitMinor}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Total minor
                  </label>
                  <input
                    type="number"
                    name="totalMinor"
                    value={form.totalMinor}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Price
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    required
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Image uploader */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Image
                  </label>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-16 w-16 rounded-md border border-neutral-700 bg-neutral-800 flex items-center justify-center overflow-hidden cursor-pointer"
                      onClick={() =>
                        document.getElementById("medicine-image-input")?.click()
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
                        <span className="text-xs text-neutral-400">
                          Upload
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          document
                            .getElementById("medicine-image-input")
                            ?.click()
                        }
                        className="px-3 py-1.5 text-xs rounded-md border border-neutral-700 text-neutral-100 hover:bg-neutral-800"
                      >
                        Choose file
                      </button>
                      <span className="text-[11px] text-neutral-500">
                        JPG, PNG up to a few MB.
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
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-70"
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
