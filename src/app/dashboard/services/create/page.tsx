"use client";

import React, { useState, memo, useCallback, useEffect, useMemo } from "react";
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
  allow_reorder?: string;
  is_virtual?: boolean;
  variations: Variation[];
  image?: string;
  strength?: string | null;
};

type ServiceMedicineRow = {
  medicine_id: string;
  min_qty: string;
  max_qty: string;
  sort_order: string;
  active: boolean;
};

/* ------- Local types for inline Medicine modal ------- */

type MedVariationForm = {
  title: string;
  price: string;
  stock: string;
  max_qty: string;
  sort_order: string;
  status: string;
};

type MedFormState = {
  sku: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  variations: MedVariationForm[];
};

const MED_EMPTY_VARIATION: MedVariationForm = {
  title: "",
  price: "",
  stock: "",
  max_qty: "",
  sort_order: "0",
  status: "published",
};

const MED_EMPTY_FORM: MedFormState = {
  sku: "",
  name: "",
  slug: "",
  description: "",
  status: "draft",
  variations: [MED_EMPTY_VARIATION],
};

function slugifyMed(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/* ------------------- NEW: Forms assignment helpers/types ------------------- */

type ClinicFormLite = {
  _id: string;
  name?: string;
  description?: string;
  form_type?: string; // "raf" | "advice" | ...
  service_slug?: string;
  service_id?: string;
  treatment_slug?: string;
  is_active?: boolean;
  raf_status?: string; // "draft" | "published"
  createdAt?: string;
  updatedAt?: string;
};

type FormAssignmentRow = {
  id: string;
  form_type: string;
  form_id: string;
};

function createId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function humanizeType(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ----------------------------------------------------------------------- */

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
  const [serviceType, setServiceType] = useState<"private" | "nhs">("private");

  // ✅ NEW: appointment_medium toggle state (default "offline")
  const [appointmentMedium, setAppointmentMedium] = useState<
    "offline" | "online"
  >("offline");
    const [showInHomePage, setShowInHomePage] = useState<
      "false" | "true"
    >("false");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [bookingFlow, setBookingFlow] = useState<string[]>([]);
  const [reorderFlow, setReorderFlow] = useState<string[]>([]);

  const [customBookingStep, setCustomBookingStep] = useState("");
  const [customReorderStep, setCustomReorderStep] = useState("");

  const [selectedBookingOption, setSelectedBookingOption] = useState("");
  const [selectedReorderOption, setSelectedReorderOption] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // ---------- medicines + linking rows ----------
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicinesLoading, setMedicinesLoading] = useState(false);
  const [linkRows, setLinkRows] = useState<ServiceMedicineRow[]>([
    {
      medicine_id: "",
      min_qty: "1",
      max_qty: "1",
      sort_order: "1",
      active: true,
    },
  ]);

  // ------------------- NEW: Clinic forms + assignment state -------------------
  const [clinicForms, setClinicForms] = useState<ClinicFormLite[]>([]);
  const [clinicFormsLoading, setClinicFormsLoading] = useState(false);
  const [onlyActiveForms, setOnlyActiveForms] = useState(true);
  const [assignmentRows, setAssignmentRows] = useState<FormAssignmentRow[]>([]);

  const reloadClinicForms = useCallback(async () => {
    try {
      setClinicFormsLoading(true);
      const base = getBackendBase();

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("session_token")
          : null;

      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch(`${base}/clinic-forms`, { headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to load clinic forms");
      }

      const json = await res.json().catch(() => null);
      const listRaw = Array.isArray(json) ? json : json?.data || [];

      const list: ClinicFormLite[] = (listRaw || []).map((f: any) => ({
        _id: f._id,
        name: f.name,
        description: f.description,
        form_type: f.form_type,
        service_slug: f.service_slug,
        service_id: f.service_id,
        treatment_slug: f.treatment_slug,
        is_active: f.is_active,
        raf_status: f.raf_status,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      }));

      setClinicForms(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load clinic forms");
    } finally {
      setClinicFormsLoading(false);
    }
  }, []);

  const clinicFormsFiltered = useMemo(() => {
    const list = clinicForms || [];
    if (!onlyActiveForms) return list;
    return list.filter((f) => f.is_active !== false);
  }, [clinicForms, onlyActiveForms]);

  const formTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of clinicFormsFiltered) {
      const t = (f.form_type || "").trim();
      if (t) set.add(t);
    }
    // sensible defaults if backend returned empty form_type
    if (set.size === 0) {
      [
        "raf",
        "advice",
        "reorder",
        "clinical_notes",
        "pharmacist_declaration",
      ].forEach((t) => set.add(t));
    }
    return Array.from(set);
  }, [clinicFormsFiltered]);

  const formsByType = useMemo(() => {
    const map: Record<string, ClinicFormLite[]> = {};
    for (const f of clinicFormsFiltered) {
      const t = (f.form_type || "").trim() || "unknown";
      if (!map[t]) map[t] = [];
      map[t].push(f);
    }
    // stable sort by name
    Object.keys(map).forEach((k) => {
      map[k] = map[k]
        .slice()
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );
    });
    return map;
  }, [clinicFormsFiltered]);

  const addAssignmentRow = () => {
    const firstType = formTypeOptions[0] || "raf";
    setAssignmentRows((prev) => [
      ...prev,
      { id: createId("fa"), form_type: firstType, form_id: "" },
    ]);
  };

  const removeAssignmentRow = (rowId: string) => {
    setAssignmentRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const updateAssignmentRow = (
    rowId: string,
    patch: Partial<FormAssignmentRow>
  ) => {
    setAssignmentRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
    );
  };

  const formsAssignmentObject = useMemo(() => {
    const out: Record<string, string> = {};
    for (const row of assignmentRows) {
      const t = (row.form_type || "").trim();
      const fid = (row.form_id || "").trim();
      if (!t || !fid) continue;
      out[t] = fid; // one form per type
    }
    return out;
  }, [assignmentRows]);

  // Load medicines + forms
  const reloadMedicines = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    reloadMedicines();
    reloadClinicForms();
  }, [reloadMedicines, reloadClinicForms]);

  const updateLinkRow = (
    index: number,
    field: keyof ServiceMedicineRow,
    value: any
  ) => {
    setLinkRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
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

  // ---------- Inline Medicine Modal state (create + edit) ----------
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [medForm, setMedForm] = useState<MedFormState>(MED_EMPTY_FORM);
  const [medImageFile, setMedImageFile] = useState<File | null>(null);
  const [medImagePreview, setMedImagePreview] = useState<string | null>(null);
  const [medExistingImagePath, setMedExistingImagePath] = useState<
    string | null
  >(null);
  const [medSkuManuallyEdited, setMedSkuManuallyEdited] = useState(false);
  const [medSlugManuallyEdited, setMedSlugManuallyEdited] = useState(false);
  const [medSubmitting, setMedSubmitting] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);
  const [medAllowReorder, setMedAllowReorder] = useState<
      "false" | "true"
    >("false");

  const openMedCreate = () => {
    setEditingMed(null);
    setMedForm({
      ...MED_EMPTY_FORM,
      variations: [MED_EMPTY_VARIATION],
    });
    setMedImageFile(null);
    setMedImagePreview(null);
    setMedExistingImagePath(null);
    setMedSkuManuallyEdited(false);
    setMedSlugManuallyEdited(false);
    setMedError(null);
    setMedAllowReorder("false");
    setIsMedModalOpen(true);
  };

  const openMedEdit = (med: Medicine) => {
    setEditingMed(med);

    const mappedVariations: MedVariationForm[] =
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
        : [MED_EMPTY_VARIATION];

    setMedForm({
      sku: med.sku || "",
      name: med.name || "",
      slug: med.slug || slugifyMed(med.name || ""),
      description: med.description || "",
      status: med.status || "draft",
      variations: mappedVariations,
    });

 setMedAllowReorder(med.allow_reorder === "true" ? "true" : "false");

    setMedImageFile(null);
    setMedExistingImagePath(med.image || null);

    if (med.image) {
      const baseForImage = getBackendBase().replace(/\/api\/?$/, "");
      const fullUrl = med.image.startsWith("http")
        ? med.image
        : `${baseForImage}/${med.image.replace(/^\/+/, "")}`;
      setMedImagePreview(fullUrl);
    } else {
      setMedImagePreview(null);
    }

    setMedSkuManuallyEdited(true);
    setMedSlugManuallyEdited(true);
    setMedError(null);
    setIsMedModalOpen(true);
  };

  const closeMedModal = () => {
    if (medSubmitting) return;
    setIsMedModalOpen(false);
    setEditingMed(null);
  };

  const handleMedChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    if (name === "name") {
      setMedForm((prev) => {
        const updated: MedFormState = { ...prev, name: value };
        const autoSlug = slugifyMed(value);

        if (!medSlugManuallyEdited) {
          updated.slug = autoSlug;
        }
        if (!medSkuManuallyEdited) {
          updated.sku = autoSlug;
        }

        return updated;
      });
      return;
    }

    if (name === "slug") {
      setMedSlugManuallyEdited(true);
    }

    if (name === "sku") {
      setMedSkuManuallyEdited(true);
    }

    setMedForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMedVariationChange = (
    index: number,
    field: keyof MedVariationForm,
    value: string
  ) => {
    setMedForm((prev) => {
      const updated = [...prev.variations];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variations: updated };
    });
  };

  const addMedVariation = () => {
    setMedForm((prev) => ({
      ...prev,
      variations: [
        ...prev.variations,
        {
          ...MED_EMPTY_VARIATION,
          sort_order: String(prev.variations.length),
        },
      ],
    }));
  };

  const removeMedVariation = (index: number) => {
    setMedForm((prev) => {
      if (prev.variations.length <= 1) return prev;
      const updated = prev.variations.filter((_, i) => i !== index);
      return { ...prev, variations: updated };
    });
  };

  const handleMedRemoveImage = () => {
    setMedImageFile(null);
    setMedImagePreview(null);
    setMedExistingImagePath(null);
  };

  const handleMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMedSubmitting(true);
    setMedError(null);

    try {
      if (!medForm.name.trim()) {
        throw new Error("Name is required.");
      }
      if (!medForm.sku.trim()) {
        throw new Error("SKU is required.");
      }

      const variationsPayload = medForm.variations
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
        sku: medForm.sku.trim(),
        name: medForm.name.trim(),
        slug: (medForm.slug || slugifyMed(medForm.name)).trim(),
        description: medForm.description.trim(),
        status: medForm.status || "draft",
        max_bookable_quantity: 2,
        allow_reorder: medAllowReorder,
        is_virtual: false,
        variations: variationsPayload,
      };

      const base = getBackendBase();
      const url = editingMed?._id
        ? `${base}/medicines/${editingMed._id}`
        : `${base}/medicines`;
      const method = editingMed?._id ? "PUT" : "POST";

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("session_token")
          : null;

      if (!token) {
        throw new Error("No authentication token found.");
      }

      const fd = new FormData();
      fd.append("sku", payload.sku);
      fd.append("name", payload.name);
      fd.append("slug", payload.slug);
      fd.append("description", payload.description);
      fd.append("status", payload.status);
      fd.append("max_bookable_quantity", String(payload.max_bookable_quantity));
      fd.append("allow_reorder", payload.allow_reorder);
      fd.append("is_virtual", String(payload.is_virtual));
      fd.append("variations", JSON.stringify(payload.variations));

      if (medImageFile) {
        fd.append("image", medImageFile);
      } else if (medExistingImagePath) {
        fd.append("image", medExistingImagePath);
      }

      const res = await fetch(url, {
        method,
        body: fd,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to save medicine");
      }

      await reloadMedicines();
      toast.success(editingMed ? "Medicine updated" : "Medicine created");
      closeMedModal();
    } catch (err: any) {
      console.error(err);
      setMedError(err?.message || "Failed to save medicine");
    } finally {
      setMedSubmitting(false);
    }
  };

  // ---------- submit service ----------
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
      formData.append("service_type", serviceType);

      formData.append("showInHomePage", JSON.stringify(showInHomePage));
      formData.append("appointment_medium", appointmentMedium);

      formData.append("booking_flow", JSON.stringify(booking));
      formData.append("reorder_flow", JSON.stringify(reorder));

      formData.append(
        "forms_assignment",
        JSON.stringify(formsAssignmentObject)
      );

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const base = getBackendBase();
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("session_token")
          : null;

      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch(`${base}/services`, {
        method: "POST",
        body: formData,
        headers,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Service create failed:", txt);
        toast.error("Error creating service");
        setSubmitting(false);
        return;
      }

      const json = await res.json().catch(() => null);

      const serviceId: string | undefined =
        json?._id || json?.id || json?.data?._id || json?.data?.id;

      if (serviceId && linkRows.length > 0) {
        for (const row of linkRows) {
          if (!row.medicine_id) continue;

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
        console.warn(
          "Service created but could not determine service_id for linking"
        );
        toast.warn(
          "Service created, but couldn't link medicines (missing service id)"
        );
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
              {/* Service Type */}
              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Service Type
                </label>
                <select
                  value={serviceType}
                  onChange={(e) =>
                    setServiceType(e.target.value as "private" | "nhs")
                  }
                  className="mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="private">Private</option>
                  <option value="nhs">NHS</option>
                </select>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Choose whether this is an NHS or private service.
                </p>
              </div>
              {/* ✅ NEW: Appointment medium toggle */}
              <div>
                <label className="text-xs font-medium mr-5 text-neutral-300">
                  Appointment medium
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setAppointmentMedium((prev) =>
                      prev === "offline" ? "online" : "offline"
                    )
                  }
                  className={`mt-1 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
                    appointmentMedium === "offline"
                      ? "bg-emerald-500/15 text-neutral-300 border-neutral-600"
                      : "bg-neutral-800 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  <span
                    className={`inline-block h-[10px] w-[10px] rounded-full ${
                      appointmentMedium === "offline"
                        ? "bg-neutral-500"
                        : "bg-emerald-400"
                    }`}
                  />
                  {appointmentMedium === "offline" ? "Offline" : "Online"}
                </button>
              </div>
              // Add toggle button UI for showInHomePage
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-neutral-300">
                  Show in Home Page
                </label>
<button
  type="button"
  onClick={() => setShowInHomePage((prev) => (prev === "true" ? "false" : "true"))}
  className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
    showInHomePage === "true"
      ? "bg-emerald-500/15 text-neutral-300 border-neutral-600"
      : "bg-neutral-800 text-neutral-300 border border-neutral-600"
  }`}
>
  <span
    className={`inline-block h-[10px] w-[10px] rounded-full ${
      showInHomePage === "true" ? "bg-emerald-400" : "bg-neutral-500"
    }`}
  />
  {showInHomePage === "true" ? "Visible" : "Hidden"}
</button>

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

          {/* ---------------- NEW: ASSIGN FORMS SECTION ---------------- */}
          <SectionCard
            title="Assign Forms"
            subtitle="Choose which clinic forms this service should use (saved into forms_assignment)."
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={reloadClinicForms}
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition-colors"
                  >
                    Reload forms
                  </button>

                  <label className="inline-flex items-center gap-2 text-xs text-neutral-300">
                    <input
                      type="checkbox"
                      checked={onlyActiveForms}
                      onChange={(e) => setOnlyActiveForms(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-900"
                    />
                    Only active forms
                  </label>
                </div>

                <button
                  type="button"
                  onClick={addAssignmentRow}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                  <Plus size={14} />
                  Add assignment
                </button>
              </div>

              {clinicFormsLoading && (
                <p className="text-xs text-neutral-500">
                  Loading clinic forms…
                </p>
              )}

              {!clinicFormsLoading && clinicFormsFiltered.length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-500">
                  No clinic forms found. Create forms first, then come back here
                  to assign them.
                </div>
              )}

              {assignmentRows.length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-500">
                  No assignments yet. Click “Add assignment” to map a form type
                  to a clinic form.
                </div>
              )}

              {assignmentRows.map((row) => {
                const usedTypes = new Set(
                  assignmentRows
                    .filter((r) => r.id !== row.id)
                    .map((r) => (r.form_type || "").trim())
                    .filter(Boolean)
                );

                const availableTypes = formTypeOptions;

                const list = formsByType[row.form_type] || [];

                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-neutral-300">
                        Form assignment
                      </p>
                      <button
                        type="button"
                        onClick={() => removeAssignmentRow(row.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                          Form type
                        </label>
                        <select
                          value={row.form_type}
                          onChange={(e) => {
                            const nextType = e.target.value;

                            if (usedTypes.has(nextType)) {
                              toast.error(
                                "This form type is already assigned. Use a different type."
                              );
                              return;
                            }

                            // reset selected form when type changes
                            updateAssignmentRow(row.id, {
                              form_type: nextType,
                              form_id: "",
                            });
                          }}
                          className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        >
                          {availableTypes.map((t) => (
                            <option key={t} value={t}>
                              {humanizeType(t)}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-neutral-500">
                          Stored as key in <code>forms_assignment</code>
                        </p>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                          Clinic form
                        </label>
                        <select
                          value={row.form_id}
                          onChange={(e) =>
                            updateAssignmentRow(row.id, {
                              form_id: e.target.value,
                            })
                          }
                          className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        >
                          <option value="">Select form…</option>
                          {list.map((f) => {
                            const metaBits: string[] = [];
                            if (f.raf_status) metaBits.push(f.raf_status);
                            if (f.service_slug)
                              metaBits.push(`svc:${f.service_slug}`);
                            if (f.treatment_slug)
                              metaBits.push(`trt:${f.treatment_slug}`);
                            const meta = metaBits.length
                              ? ` • ${metaBits.join(" • ")}`
                              : "";

                            return (
                              <option key={f._id} value={f._id}>
                                {(f.name || "Unnamed form") + meta}
                              </option>
                            );
                          })}
                        </select>

                        <p className="mt-1 text-[11px] text-neutral-500">
                          Stored as value (clinic_form_id) for this type.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-neutral-800">
                <p className="text-[11px] text-neutral-500 mb-2">
                  Preview (will be saved into <code>forms_assignment</code>):
                </p>
                <pre className="max-h-44 overflow-auto rounded-lg bg-neutral-950 border border-neutral-800 p-3 text-[11px] leading-relaxed text-neutral-300">
                  {JSON.stringify(formsAssignmentObject, null, 2)}
                </pre>
              </div>
            </div>
          </SectionCard>
          {/* ---------------- END: ASSIGN FORMS SECTION ---------------- */}
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
                  !imagePreview &&
                  document.getElementById("upload-img")?.click()
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
                  onClick={() => document.getElementById("upload-img")?.click()}
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

      {/* ---------------- LINK MEDICINES SECTION ---------------- */}
      <SectionCard
        title="Link Products"
        subtitle="Attach default products to this service along with quantities and order."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-400">
              Choose existing products to link, or create a new one.
            </p>
            <button
              type="button"
              onClick={openMedCreate}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              <Plus size={14} />
              Create product
            </button>
          </div>

          {medicinesLoading && (
            <p className="text-xs text-neutral-500">Loading products list…</p>
          )}

          {!medicinesLoading && medicines.length === 0 && (
            <p className="text-xs text-neutral-500">
              No products found. Create products first to link them here.
            </p>
          )}

          {linkRows.map((row, index) => (
            <div
              key={index}
              className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-neutral-300">
                  Product #{index + 1}
                </p>
                <div className="flex items-center gap-2">
                  {row.medicine_id && (
                    <button
                      type="button"
                      onClick={() => {
                        const med = medicines.find(
                          (m) => m._id === row.medicine_id
                        );
                        if (!med) {
                          toast.error("Selected medicine not found in list");
                          return;
                        }
                        openMedEdit(med);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-600 bg-neutral-800/60 px-2.5 py-1 text-[11px] font-medium text-neutral-100 hover:bg-neutral-700"
                    >
                      Edit product
                    </button>
                  )}
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
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {/* Medicine select */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    Product
                  </label>
                  <select
                    value={row.medicine_id}
                    onChange={(e) =>
                      updateLinkRow(index, "medicine_id", e.target.value)
                    }
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">Select product...</option>
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
                    onClick={() => updateLinkRow(index, "active", !row.active)}
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
            Add another products
          </button>

          <p className="text-[11px] text-neutral-500">
            These products will be linked to the service after it is created.
            Each combination is sent individually to the server.
          </p>
        </div>
      </SectionCard>

      {/* --------- Inline Medicine Modal --------- */}
      {isMedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800/80 shadow-[0_18px_60px_rgba(0,0,0,0.85)] transform transition-all duration-200 scale-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  {editingMed ? "Update existing product" : "Add new product"}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-neutral-50 flex items-center gap-2">
                  {editingMed ? "Edit Product" : "Create Product"}
                  <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-[2px] text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                    Inventory
                  </span>
                </h2>
              </div>

              <button
                type="button"
                onClick={closeMedModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700/70 bg-neutral-900/80 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/90 hover:border-neutral-600 transition-colors"
              >
                <span className="sr-only">Close</span>✕
              </button>
            </div>

            <form
              onSubmit={handleMedSubmit}
              className="flex flex-col max-h-[78vh]"
            >
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 pr-3">
                {medError && (
                  <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {medError}
                  </div>
                )}

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
                        value={medForm.name}
                        onChange={handleMedChange}
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
                        value={medForm.slug}
                        onChange={handleMedChange}
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
                        value={medForm.sku}
                        onChange={handleMedChange}
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
                        value={medForm.status}
                        onChange={handleMedChange}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Allow re-order
                      </label>
<button
  type="button"
  onClick={() => setMedAllowReorder((prev) => (prev === "true" ? "false" : "true"))}
  className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
    medAllowReorder === "true"
      ? "bg-emerald-500/15 text-neutral-300 border-neutral-600"
      : "bg-neutral-800 text-neutral-300 border border-neutral-600"
  }`}
>
  <span
    className={`inline-block h-[10px] w-[10px] rounded-full ${
      medAllowReorder === "true" ? "bg-emerald-400" : "bg-neutral-500"
    }`}
  />
  {medAllowReorder === "true" ? "Re-order allowed" : "Re-order not allowed"}
</button>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Toggle to control whether this product can be ordered
                        again by patients.
                      </p>
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
                    {medForm.variations.map((variation, index) => (
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
                            onClick={() => removeMedVariation(index)}
                            disabled={medForm.variations.length <= 1}
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
                                handleMedVariationChange(
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
                                £
                              </span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={variation.price}
                                onChange={(e) =>
                                  handleMedVariationChange(
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
                                handleMedVariationChange(
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
                                handleMedVariationChange(
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
                                handleMedVariationChange(
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
                                handleMedVariationChange(
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
                      onClick={addMedVariation}
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
                        Optional details to make this product easy to recognise.
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
                            document.getElementById("med-image-input")?.click()
                          }
                        >
                          {medImagePreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={medImagePreview}
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
                                  .getElementById("med-image-input")
                                  ?.click()
                              }
                              className="inline-flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800 transition-colors"
                            >
                              Choose file
                            </button>

                            {(medImagePreview || medExistingImagePath) && (
                              <button
                                type="button"
                                onClick={handleMedRemoveImage}
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
                        id="med-image-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setMedImageFile(file);
                          setMedImagePreview(URL.createObjectURL(file));
                          setMedExistingImagePath(null);
                        }}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-neutral-300">
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={medForm.description}
                        onChange={handleMedChange}
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
                  onClick={closeMedModal}
                  disabled={medSubmitting}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={medSubmitting}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-70 transition-colors"
                >
                  {medSubmitting
                    ? editingMed
                      ? "Saving..."
                      : "Creating..."
                    : editingMed
                    ? "Save changes"
                    : "Create product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
