"use client";

import React, { useState, memo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Upload,
  Save,
  Plus,
  X,
  GripVertical,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import {
  getBackendBase,
  getMedicinesApi,
  createServiceMedicineApi,
} from "../../../../api";
import { toast, ToastContainer } from "react-toastify";
import Link from "next/link";
import "react-toastify/dist/ReactToastify.css";

const DEFAULT_FLOW_OPTIONS = [
  "Treatments",
  "Login",
  "RAF",
  "Calendar",
  "Payment",
];

type Medicine = {
  _id: string;
  sku: string;
  name: string;
  strength?: string | null;
  variations?: string;
};

type ServiceMedicineRow = {
  medicine_id: string;
  min_qty: string;
  max_qty: string;
  sort_order: string;
  active: boolean;
};

const SectionCard = memo(function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-neutral-800/80 bg-gradient-to-br from-neutral-900/95 via-neutral-900/90 to-neutral-950/95 shadow-[0_18px_45px_rgba(0,0,0,0.8)] p-[1px]">
      <div className="rounded-2xl bg-neutral-950/80 p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-wide text-neutral-50">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
});

const FlowEditor = memo(function FlowEditor({
  title,
  list,
  setList,
  customStep,
  setCustomStep,
  selectedOption,
  setSelectedOption,
}: any) {
  const reorderList = useCallback(
    (result: any) => {
      if (!result.destination) return;

      const updated = [...list];
      const [removed] = updated.splice(result.source.index, 1);
      updated.splice(result.destination.index, 0, removed);

      setList(updated);
    },
    [list, setList]
  );

  const removeStep = (i: number) => {
    const updated = list.filter((_: any, idx: number) => idx !== i);
    setList(updated);
  };

  return (
    <SectionCard
      title={title}
      subtitle="Design the exact steps your patient will follow."
    >
      <div className="space-y-6">
        {/* Preset step selector */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-300">
              Add from common steps
            </label>
            <select
              value={selectedOption}
              className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                if (!list.includes(val)) setList([...list, val]);
                setSelectedOption("");
              }}
            >
              <option value="">Select step...</option>
              {DEFAULT_FLOW_OPTIONS.map((step) => (
                <option key={step} value={step}>
                  {step}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom step input */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-300">
              Custom step
            </label>
            <input
              placeholder="Add custom step (e.g. 'Verify insurance')"
              value={customStep}
              onChange={(e) => setCustomStep(e.target.value)}
              className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!customStep.trim()) return;
              setList([...list, customStep.trim()]);
              setCustomStep("");
            }}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-blue-500 transition-colors disabled:opacity-60 sm:mt-6"
          >
            <Plus size={16} />
            Add step
          </button>
        </div>

        {/* Drag + drop list */}
        <DragDropContext onDragEnd={reorderList}>
          <Droppable droppableId={title}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {list.length === 0 && (
                  <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-3 text-xs text-neutral-500">
                    No steps added yet. Choose from the dropdown above or add a
                    custom step to begin.
                  </div>
                )}

                {list.map((step: string, idx: number) => (
                  <Draggable
                    key={`${title}-${idx}`}
                    draggableId={`${title}-${idx}`}
                    index={idx}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`flex items-center justify-between gap-3 rounded-lg border bg-neutral-900/90 px-3 py-2.5 text-sm shadow-sm transition-all ${
                          snapshot.isDragging
                            ? "border-blue-500/60 shadow-[0_12px_30px_rgba(0,0,0,0.9)] scale-[1.01]"
                            : "border-neutral-700 hover:border-neutral-500"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-medium text-neutral-300 border border-neutral-700">
                            {idx + 1}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <GripVertical className="h-4 w-4 text-neutral-500" />
                            <span className="truncate text-neutral-200">
                              {step}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </SectionCard>
  );
});

export default function CreateServicePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [viewType, setViewType] = useState("card");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [bookingFlow, setBookingFlow] = useState<string[]>([]);
  const [reorderFlow, setReorderFlow] = useState<string[]>([]);

  const [customBookingStep, setCustomBookingStep] = useState("");
  const [customReorderStep, setCustomReorderStep] = useState("");

  const [selectedBookingOption, setSelectedBookingOption] = useState("");
  const [selectedReorderOption, setSelectedReorderOption] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // ---------- NEW: medicines + linking rows ----------
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicinesLoading, setMedicinesLoading] = useState(false);
  const [linkRows, setLinkRows] = useState<ServiceMedicineRow[]>([
    { medicine_id: "", min_qty: "1", max_qty: "1", sort_order: "1", active: true },
  ]);

  useEffect(() => {
    const loadMeds = async () => {
      try {
        setMedicinesLoading(true);
        const res = await getMedicinesApi();
        setMedicines(res?.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load medicines for linking");
      } finally {
        setMedicinesLoading(false);
      }
    };
    loadMeds();
  }, []);

  const updateLinkRow = (index: number, field: keyof ServiceMedicineRow, value: any) => {
    setLinkRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    );
  };

  const addLinkRow = () => {
    setLinkRows((prev) => [
      ...prev,
      {
        medicine_id: "",
        min_qty: "1",
        max_qty: "1",
        sort_order: String(prev.length + 1),
        active: true,
      },
    ]);
  };

  const removeLinkRow = (index: number) => {
    setLinkRows((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------- submit ----------
  const submitForm = async () => {
    setSubmitting(true);
    try {
      const makeFlow = (arr: string[]) =>
        Object.fromEntries(
          Array.from({ length: 6 }).map((_, i) => [
            `step${i + 1}`,
            arr[i] ?? null,
          ])
        );

      const booking = makeFlow(bookingFlow);
      const reorder = makeFlow(reorderFlow);

      const formData = new FormData();

      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("description", description);
      formData.append("view_type", viewType);
      formData.append("cta_text", ctaText || "Book Now");
      formData.append("status", "published");

      formData.append("booking_flow", JSON.stringify(booking));
      formData.append("reorder_flow", JSON.stringify(reorder));
      formData.append("forms_assignment", JSON.stringify({}));

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const base = getBackendBase();
      const res = await fetch(`${base}/services`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Service create failed:", txt);
        toast.error("Error creating service");
        setSubmitting(false);
        return;
      }

      const json = await res.json().catch(() => null);

      // Try to extract the new service id from common shapes
      const serviceId: string | undefined =
        json?._id || json?.id || json?.data?._id || json?.data?.id;

      // If we have rows to link AND a service id, call /service-medicines one by one
      if (serviceId && linkRows.length > 0) {
        for (const row of linkRows) {
          if (!row.medicine_id) continue; // skip empty rows

          try {
            await createServiceMedicineApi({
              service_id: serviceId,
              medicine_id: row.medicine_id,
              min_qty: Number(row.min_qty || 0),
              max_qty: Number(row.max_qty || 0),
              sort_order: Number(row.sort_order || 0),
              active: row.active,
            });
          } catch (err) {
            console.error("Failed to link medicine:", err);
            toast.error("Failed to link one of the medicines");
          }
        }
      } else if (!serviceId && linkRows.some((r) => r.medicine_id)) {
        console.warn("Service created but could not determine service_id for linking");
        toast.warn("Service created, but couldn't link medicines (missing service id)");
      }

      toast.success("Service created successfully");
      router.push("/dashboard/services");
    } catch (err) {
      console.error(err);
      toast.error("Error creating service");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Toasts */}
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Link
            href="/dashboard/services"
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-neutral-100"
          >
            <ArrowLeft size={14} />
            Back to Services
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide text-neutral-50">
              Create New Service
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Configure how this service appears to patients and how the booking
              journey flows.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/services")}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs sm:text-sm font-medium text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submitForm}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            <Save size={16} />
            {submitting ? "Saving..." : "Save Service"}
          </button>
        </div>
      </div>

      {/* Layout grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Basic info */}
          <SectionCard
            title="Basic Information"
            subtitle="Give your service a clear name, description and call-to-action."
          >
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-neutral-300">
                    Service Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .trim()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9\-]/g, "")
                      );
                    }}
                    placeholder="e.g. HIV Vaccination"
                    className="mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300">
                    Slug
                  </label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="hiv-vaccination"
                    className="mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this service offers and any important notes for patients."
                  className="mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  CTA Button Text
                </label>
                <input
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="Book vaccine / Schedule visit / etc."
                  className="mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
          </SectionCard>

          {/* Booking flow */}
          <FlowEditor
            title="Booking Flow"
            list={bookingFlow}
            setList={setBookingFlow}
            customStep={customBookingStep}
            setCustomStep={setCustomBookingStep}
            selectedOption={selectedBookingOption}
            setSelectedOption={setSelectedBookingOption}
          />

          {/* Reorder flow */}
          <FlowEditor
            title="Reorder Flow"
            list={reorderFlow}
            setList={setReorderFlow}
            customStep={customReorderStep}
            setCustomStep={setCustomReorderStep}
            selectedOption={selectedReorderOption}
            setSelectedOption={setSelectedReorderOption}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Image */}
          <SectionCard
            title="Service Image"
            subtitle="Optional, but helps patients recognise the service quickly."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div
                className="relative h-44 w-full max-w-[11rem] cursor-pointer overflow-hidden rounded-xl border border-dashed border-neutral-700 bg-neutral-900/80 shadow-inner hover:border-blue-500/70 hover:bg-neutral-800/80 transition-colors"
                onClick={() =>
                  !imagePreview && document.getElementById("upload-img")?.click()
                }
              >
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      className="h-full w-full object-cover"
                      alt="Service"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2 py-1.5 text-[11px] text-neutral-100">
                      Service thumbnail
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview(null);
                        setImageFile(null);
                      }}
                      className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-600/90 text-white shadow hover:bg-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center px-3">
                    <Upload size={26} className="text-neutral-400" />
                    <p className="text-xs font-medium text-neutral-200">
                      Upload image
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      JPG or PNG, up to a few MB.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs text-neutral-400">
                <p>
                  This image is shown wherever this service appears in cards or
                  lists.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("upload-img")?.click()
                  }
                  className="inline-flex items-center rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800 transition-colors"
                >
                  Choose file
                </button>
              </div>

              <input
                id="upload-img"
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
          </SectionCard>

          {/* View type */}
          <SectionCard
            title="View Type"
            subtitle="How this service should be displayed in listings."
          >
            <div className="flex flex-col gap-3">
              <select
                value={viewType}
                onChange={(e) => setViewType(e.target.value)}
                className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="card">Card layout</option>
                <option value="list">List layout</option>
              </select>
              <p className="text-[11px] text-neutral-500">
                You can switch layouts later without affecting existing
                bookings.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ---------------- LINK MEDICINES SECTION (below form) ---------------- */}
      <SectionCard
        title="Link Medicines"
        subtitle="Attach default medicines to this service along with quantities and order."
      >
        <div className="space-y-4">
          {medicinesLoading && (
            <p className="text-xs text-neutral-500">
              Loading medicines list…
            </p>
          )}

          {!medicinesLoading && medicines.length === 0 && (
            <p className="text-xs text-neutral-500">
              No medicines found. Create medicines first to link them here.
            </p>
          )}

          {linkRows.map((row, index) => (
            <div
              key={index}
              className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-neutral-300">
                  Medicine #{index + 1}
                </p>
                {linkRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLinkRow(index)}
                    className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {/* Medicine select */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    Medicine
                  </label>
                  <select
                    value={row.medicine_id}
                    onChange={(e) =>
                      updateLinkRow(index, "medicine_id", e.target.value)
                    }
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">Select medicine...</option>
                    {medicines.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}
                        {m.strength ? ` ${m.strength}` : ""}{" "}
                        {m.sku ? `(${m.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* min_qty */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    Min qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={row.min_qty}
                    onChange={(e) =>
                      updateLinkRow(index, "min_qty", e.target.value)
                    }
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                {/* max_qty */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    Max qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={row.max_qty}
                    onChange={(e) =>
                      updateLinkRow(index, "max_qty", e.target.value)
                    }
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4 items-center">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    Sort order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={row.sort_order}
                    onChange={(e) =>
                      updateLinkRow(index, "sort_order", e.target.value)
                    }
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div className="flex items-center gap-2 md:col-span-2">
                  <label className="text-[11px] font-medium text-neutral-300">
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateLinkRow(index, "active", !row.active)
                    }
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                      row.active
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                        : "bg-neutral-800 text-neutral-300 border border-neutral-600"
                    }`}
                  >
                    <span
                      className={`mr-1 inline-block h-[10px] w-[10px] rounded-full ${
                        row.active ? "bg-emerald-400" : "bg-neutral-500"
                      }`}
                    />
                    {row.active ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addLinkRow}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-neutral-700 bg-neutral-900/80 px-3 py-2 text-xs font-medium text-neutral-200 hover:border-blue-500 hover:text-blue-300 transition-colors"
          >
            <Plus size={14} />
            Add another medicine
          </button>

          <p className="text-[11px] text-neutral-500">
            These medicines will be linked to the service after it is created.
            Each combination is sent individually to the server.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
