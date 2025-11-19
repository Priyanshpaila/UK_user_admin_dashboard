"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Loader2,
  Save,
  Upload,
  X,
  Plus,
  ArrowLeft,
  GripVertical,
} from "lucide-react";
import {
  getServiceApi,
  getBackendBase,
  getMedicinesApi,
  createServiceMedicineApi,
  getServiceMedicinesByServiceApi,
} from "../../../../api";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
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

function SectionCard({
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
}

function FlowEditor({
  title,
  list,
  setList,
  customStep,
  setCustomStep,
  selectedOption,
  setSelectedOption,
}: any) {
  const reorderList = (result: any) => {
    if (!result.destination) return;

    const updated = [...list];
    const [removed] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, removed);

    setList(updated);
  };

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
}

// ---- Types for medicine mapping UI ----
type MedicineOption = {
  _id: string;
  sku: string;
  name: string;
  strength?: string | null;
  variations?: string;
  price?: number;
};

type ServiceMedicineRow = {
  key: string;
  medicineId: string;
  minQty: string;
  maxQty: string;
  sortOrder: string;
  active: boolean;
};

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("");

  const [viewType, setViewType] = useState("card");

  // image preview + file + original path
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(
    null
  );

  const [bookingFlow, setBookingFlow] = useState<string[]>([]);
  const [reorderFlow, setReorderFlow] = useState<string[]>([]);

  const [selectedBookingOption, setSelectedBookingOption] = useState("");
  const [selectedReorderOption, setSelectedReorderOption] = useState("");

  const [customBookingStep, setCustomBookingStep] = useState("");
  const [customReorderStep, setCustomReorderStep] = useState("");

  // ---- Medicines for this service ----
  const [allMedicines, setAllMedicines] = useState<MedicineOption[]>([]);
  const [linkedMedicines, setLinkedMedicines] = useState<MedicineOption[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [savingMeds, setSavingMeds] = useState(false);
  const [serviceMedicineRows, setServiceMedicineRows] = useState<
    ServiceMedicineRow[]
  >([]);

  // load service core data
  useEffect(() => {
    if (!id) return;

    const loadService = async () => {
      try {
        const data = await getServiceApi(id);

        setName(data.name);
        setSlug(data.slug);
        setDescription(data.description);
        setCtaText(data.cta_text || "");
        setViewType(data.view_type);

        // IMAGE HANDLING
        if (data.image) {
          setExistingImagePath(data.image);
          const baseForImage = getBackendBase().replace(/\/api\/?$/, ""); // strip /api
          const fullUrl =
            typeof data.image === "string" && data.image.startsWith("http")
              ? data.image
              : `${baseForImage}/${String(data.image).replace(/^\/+/, "")}`;
          setImagePreview(fullUrl);
        } else {
          setExistingImagePath(null);
          setImagePreview(null);
        }

        // BOOKING FLOW (stored as JSON string)
        let bookingObj: any = {};
        try {
          bookingObj = data.booking_flow ? JSON.parse(data.booking_flow) : {};
        } catch (e) {
          console.warn("Failed to parse booking_flow JSON:", e);
          bookingObj = {};
        }

        setBookingFlow(
          [
            bookingObj.step1,
            bookingObj.step2,
            bookingObj.step3,
            bookingObj.step4,
            bookingObj.step5,
            bookingObj.step6,
          ].filter(Boolean)
        );

        // REORDER FLOW (stored as JSON string)
        let reorderObj: any = {};
        try {
          reorderObj = data.reorder_flow ? JSON.parse(data.reorder_flow) : {};
        } catch (e) {
          console.warn("Failed to parse reorder_flow JSON:", e);
          reorderObj = {};
        }

        setReorderFlow(
          [
            reorderObj.step1,
            reorderObj.step2,
            reorderObj.step3,
            reorderObj.step4,
            reorderObj.step5,
            reorderObj.step6,
          ].filter(Boolean)
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load service");
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [id]);

  // load all medicines + already linked medicines for this service
  useEffect(() => {
    if (!id) return;

    const loadMeds = async () => {
      try {
        setLoadingMeds(true);

        const [medsRes, linkedRes] = await Promise.all([
          getMedicinesApi(),
          getServiceMedicinesByServiceApi(id),
        ]);

        const all = (medsRes as any)?.data || medsRes;
        setAllMedicines(all || []);
        setLinkedMedicines((linkedRes as any) || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load medicines for this service");
      } finally {
        setLoadingMeds(false);
      }
    };

    loadMeds();
  }, [id]);

  const saveService = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const formatFlow = (arr: string[]) =>
        Object.fromEntries(
          Array.from({ length: 6 }).map((_, i) => [
            `step${i + 1}`,
            arr[i] ?? null,
          ])
        );

      const booking = formatFlow(bookingFlow);
      const reorder = formatFlow(reorderFlow);

      const formData = new FormData();

      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("description", description);
      formData.append("cta_text", ctaText || "Book Now");
      formData.append("view_type", viewType);
      formData.append("status", "published");

      formData.append("booking_flow", JSON.stringify(booking));
      formData.append("reorder_flow", JSON.stringify(reorder));
      formData.append("forms_assignment", JSON.stringify({}));

      if (imageFile) {
        formData.append("image", imageFile);
      } else if (existingImagePath) {
        // let backend keep old image if supported
        formData.append("existingImage", existingImagePath);
      }

      const base = getBackendBase();
      const res = await fetch(`${base}/services/${id}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Update service failed:", txt);
        toast.error("Error while saving service");
        return;
      }

      toast.success("Service updated successfully");
      router.push("/dashboard/services");
    } catch (error) {
      console.error(error);
      toast.error("Error while saving service");
    } finally {
      setSaving(false);
    }
  };

  // ------- Service Medicines handlers -------

  const addMedicineRow = () => {
    setServiceMedicineRows((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        medicineId: "",
        minQty: "1",
        maxQty: "1",
        sortOrder: String(prev.length + linkedMedicines.length + 1),
        active: true,
      },
    ]);
  };

  const updateMedicineRow = (
    key: string,
    patch: Partial<ServiceMedicineRow>
  ) => {
    setServiceMedicineRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  };

  const removeMedicineRow = (key: string) => {
    setServiceMedicineRows((prev) => prev.filter((row) => row.key !== key));
  };

  const handleSaveMedicines = async () => {
    if (!id) return;
    if (!serviceMedicineRows.length) {
      toast.info("Add at least one medicine row before saving");
      return;
    }

    try {
      setSavingMeds(true);

      for (const row of serviceMedicineRows) {
        if (!row.medicineId) continue;

        const payload = {
          service_id: id,
          medicine_id: row.medicineId,
          min_qty: Number(row.minQty || 0),
          max_qty: Number(row.maxQty || 0),
          sort_order: Number(row.sortOrder || 0),
          active: row.active,
        };

        await createServiceMedicineApi(payload);
      }

      toast.success("Medicines linked to service successfully");

      // clear rows and refresh linked list
      setServiceMedicineRows([]);
      if (id) {
        const updatedLinked = await getServiceMedicinesByServiceApi(id);
        setLinkedMedicines((updatedLinked as any) || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to link medicines to this service");
    } finally {
      setSavingMeds(false);
    }
  };

  // Helpers for UI options
  const linkedIds = new Set(linkedMedicines.map((m) => m._id));
  const selectedIds = new Set(
    serviceMedicineRows.map((r) => r.medicineId).filter(Boolean)
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        {/* Toast container here so errors during load still show */}
        <ToastContainer position="top-right" autoClose={3000} />
        <Loader2 className="animate-spin text-neutral-400" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
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
              Edit Service
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Update how this service appears to patients and tune its booking
              journey & linked medicines.
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
            onClick={saveService}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Layout grid (same feel as create page) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Basic info */}
          <SectionCard
            title="Basic Information"
            subtitle="Edit the name, slug and patient-facing details for this service."
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

          {/* Service Medicines */}
          <SectionCard
            title="Service Medicines"
            subtitle="Pre-link medicines to this service so they appear as ready-made options during booking."
          >
            <div className="space-y-5">
              <p className="text-sm text-neutral-300">
                Attach medicines to this service to pre-fill treatment options
                during booking.
              </p>

              {/* Already linked medicines */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-400">
                  Already linked medicines
                </p>
                {loadingMeds ? (
                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : linkedMedicines.length === 0 ? (
                  <div className="text-xs text-neutral-500">
                    No medicines linked to this service yet.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {linkedMedicines.map((m) => (
                      <span
                        key={m._id}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-xs text-neutral-100 border border-neutral-700 shadow-sm"
                      >
                        {m.name}
                        {m.strength && (
                          <span className="text-neutral-400">
                            · {m.strength}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-neutral-800" />

              {/* New mapping rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[11px] text-blue-400 border border-blue-500/40">
                      +
                    </div>
                    <p className="text-xs font-semibold text-neutral-400">
                      Add / link medicines
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMedicineRow}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500"
                  >
                    <Plus size={14} />
                    Add medicine row
                  </button>
                </div>

                {serviceMedicineRows.length === 0 && (
                  <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-3 text-xs text-neutral-500">
                    No pending medicine mappings. Click{" "}
                    <span className="font-semibold text-neutral-300">
                      “Add medicine row”
                    </span>{" "}
                    to start linking medicines to this service.
                  </div>
                )}

                <div className="space-y-3">
                  {serviceMedicineRows.map((row, idx) => (
                    <div
                      key={row.key}
                      className="rounded-xl border border-neutral-800 bg-neutral-950/80 px-3 py-3 space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-[11px] text-emerald-400 border border-emerald-500/40">
                            {idx + 1}
                          </div>
                          <span className="text-xs text-neutral-400">
                            New medicine link
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMedicineRow(row.key)}
                          className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                        >
                          <X size={12} />
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))_auto] items-end">
                        {/* Medicine select */}
                        <div className="sm:col-span-1">
                          <label className="mb-1 block text-xs font-medium text-neutral-300">
                            Medicine
                          </label>
                          <select
                            className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-neutral-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                            value={row.medicineId}
                            onChange={(e) =>
                              updateMedicineRow(row.key, {
                                medicineId: e.target.value,
                              })
                            }
                          >
                            <option value="">Select medicine…</option>
                            {allMedicines.map((m) => {
                              const disabled =
                                linkedIds.has(m._id) &&
                                m._id !== row.medicineId; // allow keep if already selected in this row

                              const selectedElsewhere =
                                selectedIds.has(m._id) &&
                                m._id !== row.medicineId;

                              return (
                                <option
                                  key={m._id}
                                  value={m._id}
                                  disabled={disabled || selectedElsewhere}
                                >
                                  {m.name}{" "}
                                  {m.strength ? `(${m.strength})` : ""} –{" "}
                                  {m.sku}
                                  {disabled ? " (already linked)" : ""}
                                  {selectedElsewhere
                                    ? " (selected above)"
                                    : ""}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* min_qty */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-300">
                            Min qty
                          </label>
                          <input
                            type="number"
                            className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-neutral-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                            value={row.minQty}
                            onChange={(e) =>
                              updateMedicineRow(row.key, {
                                minQty: e.target.value,
                              })
                            }
                            min={0}
                          />
                        </div>

                        {/* max_qty */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-300">
                            Max qty
                          </label>
                          <input
                            type="number"
                            className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-neutral-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                            value={row.maxQty}
                            onChange={(e) =>
                              updateMedicineRow(row.key, {
                                maxQty: e.target.value,
                              })
                            }
                            min={0}
                          />
                        </div>

                        {/* sort_order */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-300">
                            Sort order
                          </label>
                          <input
                            type="number"
                            className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-neutral-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                            value={row.sortOrder}
                            onChange={(e) =>
                              updateMedicineRow(row.key, {
                                sortOrder: e.target.value,
                              })
                            }
                            min={0}
                          />
                        </div>

                        {/* active toggle */}
                        <div className="flex items-center gap-2 sm:justify-center sm:pl-2">
                          <input
                            id={`active-${row.key}`}
                            type="checkbox"
                            className="h-4 w-4 rounded border-neutral-600 bg-neutral-900"
                            checked={row.active}
                            onChange={(e) =>
                              updateMedicineRow(row.key, {
                                active: e.target.checked,
                              })
                            }
                          />
                          <label
                            htmlFor={`active-${row.key}`}
                            className="text-xs text-neutral-300"
                          >
                            Active
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {serviceMedicineRows.length > 0 && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveMedicines}
                      disabled={savingMeds}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-blue-500 disabled:opacity-60"
                    >
                      {savingMeds && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {savingMeds ? "Saving medicines..." : "Save medicines"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
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
                  !imagePreview && document.getElementById("edit-img")?.click()
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
                        setExistingImagePath(null);
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
                  onClick={() => document.getElementById("edit-img")?.click()}
                  className="inline-flex items-center rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800 transition-colors"
                >
                  Choose file
                </button>
              </div>

              <input
                id="edit-img"
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
    </div>
  );
}
