"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Save,
  Upload,
  X,
  Plus,
  ArrowLeft,
  GripVertical,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  getServiceApi,
  getBackendBase,
  getMedicinesApi,
  createServiceMedicineApi,
  deleteServiceMedicineApi, // unlink by service_medicine_id
} from "../../../../api";

const DEFAULT_FLOW_OPTIONS = [
  "Treatments",
  "Login",
  "RAF",
  "Calendar",
  "Payment",
];

/* ---------- Shared medicine types ---------- */
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
  status: string;
  max_bookable_quantity?: number;
  allow_reorder?: string;
  is_virtual?: boolean;
  variations: Variation[];
  image?: string;
  strength?: string | null;
};

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

/* ------------------- Forms assignment helpers/types ------------------- */
type ClinicFormLite = {
  _id: string;
  name?: string;
  description?: string;
  form_type?: string;
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

function normalizeFormType(v: any) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseFormIds(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = String(v).trim();
  if (!s) return [];
  // supports "id1,id2"
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

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

function unwrapArray<T = any>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;

  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.data)) return res.data.data;
  if (Array.isArray(res.data?.docs)) return res.data.docs;
  if (Array.isArray(res.docs)) return res.docs;
  if (Array.isArray(res.items)) return res.items;

  return [];
}

function baseForImagesFromApiBase(apiBase: string) {
  // if api base is .../api, convert to origin root
  return apiBase.replace(/\/api\/?$/, "");
}

function getTokenSafe() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("session_token");
}

/* --------------------- Shared UI components ---------------------- */
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
            {subtitle ? (
              <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

type FlowEditorProps = {
  title: string;
  list: string[];
  setList: React.Dispatch<React.SetStateAction<string[]>>;
  customStep: string;
  setCustomStep: React.Dispatch<React.SetStateAction<string>>;
  selectedOption: string;
  setSelectedOption: React.Dispatch<React.SetStateAction<string>>;
};

function FlowEditor({
  title,
  list,
  setList,
  customStep,
  setCustomStep,
  selectedOption,
  setSelectedOption,
}: FlowEditorProps) {
  const reorderList = (result: any) => {
    if (!result.destination) return;

    const updated = [...list];
    const [removed] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, removed);
    setList(updated);
  };

  const removeStep = (i: number) => {
    const updated = list.filter((_, idx) => idx !== i);
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
                {list.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-3 text-xs text-neutral-500">
                    No steps added yet. Choose from the dropdown above or add a
                    custom step to begin.
                  </div>
                ) : null}

                {list.map((step, idx) => (
                  <Draggable
                    key={`${title}-${idx}`}
                    draggableId={`${title}-${idx}`}
                    index={idx}
                  >
                    {(provided2, snapshot) => (
                      <div
                        ref={provided2.innerRef}
                        {...provided2.draggableProps}
                        {...provided2.dragHandleProps}
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

/* ---- Types for service-medicine mapping UI ---- */
type MedicineOption = {
  _id: string;
  sku: string;
  name: string;
  strength?: string | null;
};

type ServiceMedicineRow = {
  key: string;
  medicineId: string;
  minQty: string;
  maxQty: string;
  sortOrder: string;
  active: boolean;
};

type LinkedServiceMedicine = {
  medicineId: string;
  linkId: string; // service_medicine_id
  name?: string;
  sku?: string;
  strength?: string | null;
};

function normalizeLinkedServiceMedicines(input: any): LinkedServiceMedicine[] {
  const arr = Array.isArray(input) ? input : input?.data || [];
  if (!Array.isArray(arr)) return [];

  const out: LinkedServiceMedicine[] = [];

  for (const item of arr) {
    const serviceMedicineId =
      typeof item?.service_medicine_id === "string"
        ? item.service_medicine_id
        : typeof item?.serviceMedicineId === "string"
          ? item.serviceMedicineId
          : "";

    const medicineIdFromExplicit =
      typeof item?.medicine_id === "string"
        ? item.medicine_id
        : typeof item?.medicineId === "string"
          ? item.medicineId
          : "";

    const medicineIdFromNested =
      typeof item?.medicine?._id === "string" ? item.medicine._id : "";

    const rawId = typeof item?._id === "string" ? item._id : "";

    let medicineId = "";
    let linkId = "";

    if (serviceMedicineId) {
      linkId = serviceMedicineId;
      medicineId = medicineIdFromExplicit || rawId || medicineIdFromNested;
    } else if (medicineIdFromExplicit) {
      medicineId = medicineIdFromExplicit;
      linkId = rawId;
    } else if (medicineIdFromNested) {
      medicineId = medicineIdFromNested;
      linkId = rawId;
    } else {
      medicineId = rawId;
      linkId = "";
    }

    const name =
      (typeof item?.name === "string" && item.name) ||
      (typeof item?.medicine?.name === "string" && item.medicine.name) ||
      undefined;

    const sku =
      (typeof item?.sku === "string" && item.sku) ||
      (typeof item?.medicine?.sku === "string" && item.medicine.sku) ||
      undefined;

    const strength =
      typeof item?.strength === "string"
        ? item.strength
        : typeof item?.medicine?.strength === "string"
          ? item.medicine.strength
          : null;

    if (medicineId) {
      out.push({ medicineId, linkId, name, sku, strength });
    }
  }

  // de-dupe by medicineId (prefer the one with linkId)
  const map = new Map<string, LinkedServiceMedicine>();
  for (const row of out) {
    const prev = map.get(row.medicineId);
    if (!prev) map.set(row.medicineId, row);
    else if (!prev.linkId && row.linkId) map.set(row.medicineId, row);
  }
  return Array.from(map.values());
}

/* -------------------- Custom Dropdown (supports Unlink button) -------------------- */
function MedicineDropdown({
  value,
  onChange,
  allMedicines,
  linkedByMedicineId,
  linkedIdsNoLinkId,
  selectedIds,
  onRequestUnlink,
  unlinkingMedicineId,
}: {
  value: string;
  onChange: (medicineId: string) => void;
  allMedicines: Medicine[];
  linkedByMedicineId: Map<string, string>;
  linkedIdsNoLinkId: Set<string>;
  selectedIds: Set<string>;
  onRequestUnlink: (medicineId: string) => void;
  unlinkingMedicineId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => allMedicines.find((m) => m._id === value) || null,
    [allMedicines, value],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const renderLabel = (m: Medicine) =>
    `${m.name}${m.strength ? ` (${m.strength})` : ""} – ${m.sku}`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-neutral-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 flex items-center justify-between gap-2"
      >
        <span
          className={`truncate ${
            selected ? "text-neutral-100" : "text-neutral-500"
          }`}
        >
          {selected ? renderLabel(selected) : "Select product…"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-neutral-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute z-[55] mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-950 shadow-[0_18px_55px_rgba(0,0,0,0.9)] overflow-hidden">
          <div className="max-h-64 overflow-auto py-1">
            {allMedicines.length === 0 ? (
              <div className="px-3 py-2 text-xs text-neutral-500">
                No products found.
              </div>
            ) : (
              allMedicines.map((m) => {
                const isLinked =
                  linkedByMedicineId.has(m._id) || linkedIdsNoLinkId.has(m._id);

                const isSelectedElsewhere =
                  selectedIds.has(m._id) && m._id !== value;

                const disabledSelect =
                  (isLinked && m._id !== value) || isSelectedElsewhere;

                const canUnlink = linkedByMedicineId.has(m._id);
                const unlinkBusy = unlinkingMedicineId === m._id;

                return (
                  <div
                    key={m._id}
                    className={`px-3 py-2 flex items-center justify-between gap-3 border-b border-neutral-900 last:border-b-0 ${
                      disabledSelect ? "opacity-70" : ""
                    } hover:bg-neutral-900/70`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (disabledSelect) return;
                        onChange(m._id);
                        setOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="text-sm text-neutral-100 truncate">
                        {m.name}
                        {m.strength ? (
                          <span className="text-neutral-400">
                            {" "}
                            · {m.strength}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {m.sku}
                        {isLinked ? " · already linked" : ""}
                        {isSelectedElsewhere ? " · selected above" : ""}
                      </div>
                    </button>

                    {isLinked ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          onRequestUnlink(m._id);
                        }}
                        disabled={unlinkBusy || !canUnlink}
                        className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                          canUnlink
                            ? "border-red-500/50 bg-red-500/15 text-red-200 hover:bg-red-500/25"
                            : "border-neutral-700 bg-neutral-900 text-neutral-500"
                        } ${unlinkBusy ? "opacity-70" : ""}`}
                        title={
                          canUnlink
                            ? "Unlink this product from service"
                            : "Linked mapping missing (needs backend link id). Refresh after save."
                        }
                      >
                        {unlinkBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Unlink
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const rawId = (params as any)?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("");

  const [viewType, setViewType] = useState<"card" | "list">("card");

  const [serviceType, setServiceType] = useState<"private" | "nhs">("private");

  // image preview + file + original path
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(
    null,
  );
  const serviceImageObjectUrlRef = useRef<string | null>(null);

  const [bookingFlow, setBookingFlow] = useState<string[]>([]);
  const [reorderFlow, setReorderFlow] = useState<string[]>([]);

  const [selectedBookingOption, setSelectedBookingOption] = useState("");
  const [selectedReorderOption, setSelectedReorderOption] = useState("");

  const [customBookingStep, setCustomBookingStep] = useState("");
  const [customReorderStep, setCustomReorderStep] = useState("");

  // ---- Medicines for this service ----
  const [allMedicines, setAllMedicines] = useState<Medicine[]>([]);
  const [linkedMedicines, setLinkedMedicines] = useState<MedicineOption[]>([]);
  const [linkedServiceMedicines, setLinkedServiceMedicines] = useState<
    LinkedServiceMedicine[]
  >([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [savingMeds, setSavingMeds] = useState(false);
  const [serviceMedicineRows, setServiceMedicineRows] = useState<
    ServiceMedicineRow[]
  >([]);
  const [medsLoadError, setMedsLoadError] = useState<string | null>(null);

  // appointment_medium (offline / online)
  const [appointmentMedium, setAppointmentMedium] = useState<
    "offline" | "online"
  >("offline");

  const [showInHomePage, setShowInHomePage] = useState<"false" | "true">(
    "false",
  );

  // ------------------- Clinic forms + assignment state -------------------
  const [clinicForms, setClinicForms] = useState<ClinicFormLite[]>([]);
  const [clinicFormsLoading, setClinicFormsLoading] = useState(false);
  const [onlyActiveForms, setOnlyActiveForms] = useState(true);
  const [assignmentRows, setAssignmentRows] = useState<FormAssignmentRow[]>([]);

  // ---- stable refs to avoid dependency loops & abort in-flight medicines fetch ----
  const allMedsRef = useRef<Medicine[]>([]);
  useEffect(() => {
    allMedsRef.current = allMedicines;
  }, [allMedicines]);

  const medsAbortRef = useRef<AbortController | null>(null);
  const medsReqSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      medsAbortRef.current?.abort();
      if (serviceImageObjectUrlRef.current) {
        URL.revokeObjectURL(serviceImageObjectUrlRef.current);
        serviceImageObjectUrlRef.current = null;
      }
    };
  }, []);

  // ---------- Clinic forms ----------
  const reloadClinicForms = useCallback(async () => {
    try {
      setClinicFormsLoading(true);
      const base = getBackendBase();
      const token = getTokenSafe();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch(`${base}/clinic-forms`, {
        headers,
      });
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
        form_type: normalizeFormType(f.form_type),
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

  useEffect(() => {
    reloadClinicForms();
  }, [reloadClinicForms]);

  const clinicFormsFiltered = useMemo(() => {
    const list = clinicForms || [];
    if (!onlyActiveForms) return list;
    return list.filter((f) => f.is_active !== false);
  }, [clinicForms, onlyActiveForms]);

  const formTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of clinicFormsFiltered) {
      const t = normalizeFormType(f.form_type || "");
      if (t) set.add(t);
    }
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
      const t = normalizeFormType(f.form_type || "") || "unknown";
      if (!map[t]) map[t] = [];
      map[t].push(f);
    }
    Object.keys(map).forEach((k) => {
      map[k] = map[k]
        .slice()
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || "")),
        );
    });
    return map;
  }, [clinicFormsFiltered]);

  const addAssignmentRow = () => {
    const firstType = normalizeFormType(formTypeOptions[0] || "raf");
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
    patch: Partial<FormAssignmentRow>,
  ) => {
    setAssignmentRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
    );
  };

  const formsAssignmentObject = useMemo(() => {
    const bucket: Record<string, string[]> = {};

    for (const row of assignmentRows) {
      const t = normalizeFormType(row.form_type);
      const fid = String(row.form_id || "").trim();
      if (!t || !fid) continue;
      if (!bucket[t]) bucket[t] = [];
      bucket[t].push(fid);
    }

    const out: Record<string, string> = {};
    for (const [t, ids] of Object.entries(bucket)) {
      const uniq = Array.from(new Set(ids));
      out[t] = uniq.length <= 1 ? uniq[0] || "" : uniq.join(",");
    }
    return out;
  }, [assignmentRows]);

  // ---------- Inline Medicine Modal state (create + edit) ----------
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [medForm, setMedForm] = useState<MedFormState>(MED_EMPTY_FORM);
  const [medImageFile, setMedImageFile] = useState<File | null>(null);
  const [medImagePreview, setMedImagePreview] = useState<string | null>(null);
  const [medExistingImagePath, setMedExistingImagePath] = useState<
    string | null
  >(null);
  const medImageObjectUrlRef = useRef<string | null>(null);

  const [medSkuManuallyEdited, setMedSkuManuallyEdited] = useState(false);
  const [medSlugManuallyEdited, setMedSlugManuallyEdited] = useState(false);
  const [medSubmitting, setMedSubmitting] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);
  const [medAllowReorder, setMedAllowReorder] = useState<"false" | "true">(
    "false",
  );

  // unlink popup state
  const [unlinkingMedicineId, setUnlinkingMedicineId] = useState<string | null>(
    null,
  );
  const [unlinkConfirm, setUnlinkConfirm] = useState<{
    open: boolean;
    medicineId: string;
    medicineName: string;
  }>({ open: false, medicineId: "", medicineName: "" });

  const openUnlinkConfirm = useCallback(
    (medicineId: string) => {
      const med = allMedicines.find((m) => m._id === medicineId);
      setUnlinkConfirm({
        open: true,
        medicineId,
        medicineName: med?.name || "this product",
      });
    },
    [allMedicines],
  );

  const closeUnlinkConfirm = useCallback(() => {
    setUnlinkConfirm({ open: false, medicineId: "", medicineName: "" });
  }, []);

  // ---------- Load service core data ----------
  useEffect(() => {
    if (!id) return;

    const loadService = async () => {
      try {
        const data = await getServiceApi(id);

        setName(data.name || "");
        setSlug(data.slug || "");
        setSlugManuallyEdited(true);

        setDescription(data.description || "");
        setCtaText(data.cta_text || "");
        setViewType(
          (data.view_type === "list" ? "list" : "card") as "card" | "list",
        );

        const st = (data.service_type || data.serviceType || "private") as
          | "private"
          | "nhs";
        setServiceType(st === "nhs" ? "nhs" : "private");

        const am = String(
          data.appointment_medium || data.appointmentMedium || "offline",
        );
        setAppointmentMedium(am === "online" ? "online" : "offline");

        const sh = String(
          data.show_in_home_page || data.showInHomePage || "false",
        );
        setShowInHomePage(sh === "true" ? "true" : "false");

        // IMAGE HANDLING
        if (data.image) {
          setExistingImagePath(String(data.image));
          const imgBase = baseForImagesFromApiBase(getBackendBase());
          const fullUrl =
            typeof data.image === "string" && data.image.startsWith("http")
              ? data.image
              : `${imgBase}/${String(data.image).replace(/^\/+/, "")}`;
          setImagePreview(fullUrl);
        } else {
          setExistingImagePath(null);
          setImagePreview(null);
        }

        // BOOKING FLOW
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
          ].filter(Boolean),
        );

        // REORDER FLOW
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
          ].filter(Boolean),
        );

        // FORMS ASSIGNMENT (load existing)
        let formsObj: any = {};
        try {
          const raw =
            (data as any).forms_assignment ??
            (data as any).formsAssignment ??
            (data as any).forms_assignment_json;

          if (typeof raw === "string") {
            formsObj = raw ? JSON.parse(raw) : {};
          } else if (raw && typeof raw === "object") {
            formsObj = raw;
          } else {
            formsObj = {};
          }
        } catch (e) {
          console.warn("Failed to parse forms_assignment:", e);
          formsObj = {};
        }

        const rowsFromObj: FormAssignmentRow[] = [];
        for (const [k, v] of Object.entries(formsObj || {})) {
          const type = normalizeFormType(k);
          const ids = parseFormIds(v);
          for (const fid of ids) {
            rowsFromObj.push({
              id: createId("fa"),
              form_type: type,
              form_id: fid,
            });
          }
        }
        setAssignmentRows(rowsFromObj);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load service");
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [id]);

  /**
   * Load medicines + service medicines (no infinite loops)
   */
  const loadMeds = useCallback(
    async (opts?: { forceLinked?: boolean }) => {
      if (!id)
        return { all: [] as Medicine[], linked: [] as LinkedServiceMedicine[] };

      medsAbortRef.current?.abort();
      const ac = new AbortController();
      medsAbortRef.current = ac;
      const mySeq = ++medsReqSeqRef.current;

      setLoadingMeds(true);
      setMedsLoadError(null);

      try {
        // 1) all medicines
        let allList: Medicine[] = [];
        try {
          const medsRes = await getMedicinesApi();
          if (mySeq !== medsReqSeqRef.current) return { all: [], linked: [] };
          allList = unwrapArray<Medicine>(medsRes);
          setAllMedicines(allList);
        } catch (e) {
          console.error("getMedicinesApi failed:", e);
          setMedsLoadError("Failed to load products. Please refresh.");
          allList = allMedsRef.current || [];
        }

        // 2) linked medicines
        let normalized: LinkedServiceMedicine[] = [];
        try {
          const base = getBackendBase();
          const token = getTokenSafe();
          const headers: HeadersInit = token
            ? { Authorization: `Bearer ${token}` }
            : {};
          const url = `${base}/service-medicines/service/${id}`;

          const res = await fetch(url, {
            method: "GET",
            headers,
            signal: ac.signal,
            credentials: "include",
          });

          if (mySeq !== medsReqSeqRef.current) return { all: [], linked: [] };

          if (res.status === 404) {
            // treat as "no links" (some backends use 404 for empty)
            normalized = [];
            setMedsLoadError(
              (prev) => prev ?? "No product is linked to this service.",
            );
          } else if (!res.ok) {
            const txt = await res.text().catch(() => "");
            console.error("Linked products fetch failed:", res.status, txt);
            normalized = [];
            setMedsLoadError(
              (prev) => prev ?? "Product links could not be loaded.",
            );
          } else {
            const json = await res.json().catch(() => null);
            normalized = normalizeLinkedServiceMedicines(json);
          }
        } catch (e: any) {
          if (e?.name !== "AbortError") {
            console.error("Linked products fetch error:", e);
            setMedsLoadError(
              (prev) => prev ?? "Product links could not be loaded.",
            );
          }
          normalized = [];
        }

        setLinkedServiceMedicines(normalized);

        const source = allList.length ? allList : allMedsRef.current || [];
        setLinkedMedicines(
          normalized.map((x) => ({
            _id: x.medicineId,
            name:
              x.name ||
              source.find((m) => m._id === x.medicineId)?.name ||
              "Unknown",
            sku: x.sku || source.find((m) => m._id === x.medicineId)?.sku || "",
            strength:
              x.strength ??
              source.find((m) => m._id === x.medicineId)?.strength ??
              null,
          })),
        );

        return { all: source, linked: normalized };
      } finally {
        if (mySeq === medsReqSeqRef.current) setLoadingMeds(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!id) return;
    void loadMeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- Save service (core details) ----------
  const saveService = async () => {
    if (!id) return;
    setSaving(true);

    try {
      const formatFlow = (arr: string[]) =>
        Object.fromEntries(
          Array.from({ length: 6 }).map((_, i) => [
            `step${i + 1}`,
            arr[i] ?? null,
          ]),
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
      formData.append("service_type", serviceType);
      formData.append("appointment_medium", appointmentMedium);
      formData.append("booking_flow", JSON.stringify(booking));
      formData.append("reorder_flow", JSON.stringify(reorder));

      // ✅ be defensive: support either key
      formData.append("showInHomePage", showInHomePage);
      formData.append("show_in_home_page", showInHomePage);

      formData.append(
        "forms_assignment",
        JSON.stringify(formsAssignmentObject),
      );

      if (imageFile) {
        formData.append("image", imageFile);
      } else if (existingImagePath) {
        formData.append("existingImage", existingImagePath);
      }

      const base = getBackendBase();
      const token = getTokenSafe();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch(`${base}/services/${id}`, {
        method: "PUT",
        body: formData,
        headers,
        credentials: "include",
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
    patch: Partial<ServiceMedicineRow>,
  ) => {
    setServiceMedicineRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
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

      toast.success("Products linked to service successfully");
      setServiceMedicineRows([]);
      await loadMeds({ forceLinked: true });
    } catch (err) {
      console.error(err);
      toast.error("Failed to link products to this service");
    } finally {
      setSavingMeds(false);
    }
  };

  // medicineId -> service_medicine_id
  const linkedByMedicineId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of linkedServiceMedicines) {
      if (row.medicineId && row.linkId) map.set(row.medicineId, row.linkId);
    }
    return map;
  }, [linkedServiceMedicines]);

  // linked but missing linkId (rare)
  const linkedIdsNoLinkId = useMemo(() => {
    const set = new Set<string>();
    for (const row of linkedServiceMedicines) {
      if (row.medicineId && !row.linkId) set.add(row.medicineId);
    }
    return set;
  }, [linkedServiceMedicines]);

  const selectedIds = useMemo(() => {
    return new Set(
      serviceMedicineRows.map((r) => r.medicineId).filter(Boolean),
    );
  }, [serviceMedicineRows]);

  // Confirm unlink
  const confirmUnlinkMedicine = useCallback(async () => {
    const medicineId = unlinkConfirm.medicineId;
    if (!medicineId) return;

    let linkId = linkedByMedicineId.get(medicineId);

    if (!linkId) {
      toast.info("Refreshing product links…");
      const refreshed = await loadMeds({ forceLinked: true });
      linkId =
        refreshed.linked.find((x) => x.medicineId === medicineId)?.linkId || "";
    }

    if (!linkId) {
      toast.error(
        "Unable to unlink: service_medicine_id not available from backend. Please refresh and try again.",
      );
      closeUnlinkConfirm();
      return;
    }

    try {
      setUnlinkingMedicineId(medicineId);
      await deleteServiceMedicineApi(linkId);
      toast.success("Product unlinked successfully");
      closeUnlinkConfirm();
      await loadMeds({ forceLinked: true });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to unlink product");
    } finally {
      setUnlinkingMedicineId(null);
    }
  }, [
    unlinkConfirm.medicineId,
    linkedByMedicineId,
    loadMeds,
    closeUnlinkConfirm,
  ]);

  useEffect(() => {
    if (!unlinkConfirm.open) return;
    const stillLinked =
      linkedByMedicineId.has(unlinkConfirm.medicineId) ||
      linkedIdsNoLinkId.has(unlinkConfirm.medicineId);
    if (!stillLinked) closeUnlinkConfirm();
  }, [
    unlinkConfirm.open,
    unlinkConfirm.medicineId,
    linkedByMedicineId,
    linkedIdsNoLinkId,
    closeUnlinkConfirm,
  ]);

  // ---------- Inline Medicine Modal handlers ----------
  const openMedCreate = () => {
    setEditingMed(null);
    setMedForm({ ...MED_EMPTY_FORM, variations: [MED_EMPTY_VARIATION] });

    if (medImageObjectUrlRef.current) {
      URL.revokeObjectURL(medImageObjectUrlRef.current);
      medImageObjectUrlRef.current = null;
    }

    setMedImageFile(null);
    setMedImagePreview(null);
    setMedExistingImagePath(null);

    setMedSkuManuallyEdited(false);
    setMedSlugManuallyEdited(false);
    setMedError(null);
    setMedAllowReorder("true");
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

    if (medImageObjectUrlRef.current) {
      URL.revokeObjectURL(medImageObjectUrlRef.current);
      medImageObjectUrlRef.current = null;
    }

    setMedImageFile(null);
    setMedExistingImagePath(med.image || null);

    if (med.image) {
      const imgBase = baseForImagesFromApiBase(getBackendBase());
      const fullUrl = med.image.startsWith("http")
        ? med.image
        : `${imgBase}/${med.image.replace(/^\/+/, "")}`;
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
    >,
  ) => {
    const { name, value } = e.target;

    if (name === "name") {
      setMedForm((prev) => {
        const updated: MedFormState = { ...prev, name: value };
        const autoSlug = slugifyMed(value);

        if (!medSlugManuallyEdited) updated.slug = autoSlug;
        if (!medSkuManuallyEdited) updated.sku = autoSlug;

        return updated;
      });
      return;
    }

    if (name === "slug") setMedSlugManuallyEdited(true);
    if (name === "sku") setMedSkuManuallyEdited(true);

    setMedForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMedVariationChange = (
    index: number,
    field: keyof MedVariationForm,
    value: string,
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
        { ...MED_EMPTY_VARIATION, sort_order: String(prev.variations.length) },
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
    if (medImageObjectUrlRef.current) {
      URL.revokeObjectURL(medImageObjectUrlRef.current);
      medImageObjectUrlRef.current = null;
    }
    setMedImageFile(null);
    setMedImagePreview(null);
    setMedExistingImagePath(null);
  };

  const handleMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMedSubmitting(true);
    setMedError(null);

    try {
      if (!medForm.name.trim()) throw new Error("Name is required.");
      if (!medForm.sku.trim()) throw new Error("SKU is required.");

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

      const token = getTokenSafe();
      if (!token) throw new Error("No authentication token found.");

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

      // ✅ important fix: don't send existing path in "image" (file field). Use existingImage.
      if (medImageFile) {
        fd.append("image", medImageFile);
      } else if (medExistingImagePath) {
        fd.append("existingImage", medExistingImagePath);
      }

      const res = await fetch(url, {
        method,
        body: fd,
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to save product");
      }

      await loadMeds({ forceLinked: true });
      toast.success(editingMed ? "Product updated" : "Product created");
      closeMedModal();
    } catch (err: any) {
      console.error(err);
      setMedError(err?.message || "Failed to save product");
    } finally {
      setMedSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
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
              journey & linked products.
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

      {/* Layout grid */}
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
                      const v = e.target.value;
                      setName(v);
                      if (!slugManuallyEdited) {
                        setSlug(
                          v
                            .toLowerCase()
                            .trim()
                            .replace(/\s+/g, "-")
                            .replace(/[^a-z0-9\-]/g, ""),
                        );
                      }
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
                    onChange={(e) => {
                      setSlugManuallyEdited(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="hiv-vaccination"
                    className="mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Tip: if you want auto-slug from name again, clear the slug
                    and refresh this page.
                  </p>
                </div>

                {/* Service Type */}
                <div>
                  <label className="text-xs font-medium text-neutral-300">
                    Service Type
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) =>
                      setServiceType(
                        e.target.value === "nhs" ? "nhs" : "private",
                      )
                    }
                    className="mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="private">Private</option>
                    <option value="nhs">NHS</option>
                  </select>
                </div>

                {/* Appointment medium */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-neutral-300 mr-5">
                    Appointment medium
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setAppointmentMedium((prev) =>
                        prev === "offline" ? "online" : "offline",
                      )
                    }
                    className={`mt-1 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      appointmentMedium === "offline"
                        ? "bg-neutral-800 text-neutral-300 border border-neutral-600"
                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
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

                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-neutral-300">
                    Show on Home Page
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setShowInHomePage((prev) =>
                        prev === "true" ? "false" : "true",
                      )
                    }
                    className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
                      showInHomePage === "true"
                        ? "bg-emerald-500/15 text-neutral-300 border-neutral-600"
                        : "bg-neutral-800 text-neutral-300 border border-neutral-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-[10px] w-[10px] rounded-full ${
                        showInHomePage === "true"
                          ? "bg-emerald-400"
                          : "bg-neutral-500"
                      }`}
                    />
                    {showInHomePage === "true" ? "Visible" : "Hidden"}
                  </button>
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

          {/* Assign Forms */}
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

              {clinicFormsLoading ? (
                <p className="text-xs text-neutral-500">
                  Loading clinic forms…
                </p>
              ) : null}

              {!clinicFormsLoading && clinicFormsFiltered.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-500">
                  No clinic forms found. Create forms first, then come back here
                  to assign them.
                </div>
              ) : null}

              {assignmentRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-500">
                  No assignments yet. Click “Add assignment” to map a form type
                  to a clinic form.
                </div>
              ) : null}

              {assignmentRows.map((row) => {
                const currentType = normalizeFormType(row.form_type);
                const availableTypes = Array.from(
                  new Set(
                    [...(formTypeOptions || []), currentType]
                      .map((t) => normalizeFormType(t))
                      .filter(Boolean),
                  ),
                );

                const list = formsByType[currentType] || [];

                // prevent selecting SAME form twice for the same type
                const usedFormIdsForThisType = new Set(
                  assignmentRows
                    .filter(
                      (r) =>
                        r.id !== row.id &&
                        normalizeFormType(r.form_type) === currentType,
                    )
                    .map((r) => String(r.form_id || "").trim())
                    .filter(Boolean),
                );

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
                          value={currentType}
                          onChange={(e) => {
                            const nextType = normalizeFormType(e.target.value);
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
                              <option
                                key={f._id}
                                value={f._id}
                                disabled={usedFormIdsForThisType.has(f._id)}
                              >
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

          {/* Service Products */}
          <SectionCard title="Service Products">
            <div className="space-y-5">
              {/* Already linked */}
              <div className="space-y-2">
                {loadingMeds ? (
                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : linkedMedicines.length === 0 ? (
                  <div className="text-xs text-neutral-500">
                    No products linked to this service yet.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {linkedMedicines.map((m) => (
                      <span
                        key={m._id}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-xs text-neutral-100 border border-neutral-700 shadow-sm"
                      >
                        {m.name}
                        {m.strength ? (
                          <span className="text-neutral-400">
                            · {m.strength}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-neutral-800" />

              {medsLoadError ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {medsLoadError}
                </div>
              ) : null}

              {/* New mapping rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[11px] text-blue-400 border border-blue-500/40">
                      +
                    </div>
                    <p className="text-xs font-semibold text-neutral-400">
                      Add / link products
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openMedCreate}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-600 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800"
                    >
                      <Plus size={14} />
                      Create product
                    </button>
                    <button
                      type="button"
                      onClick={addMedicineRow}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500"
                    >
                      <Plus size={14} />
                      Add product row
                    </button>
                  </div>
                </div>

                {serviceMedicineRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-3 text-xs text-neutral-500">
                    No pending product mappings. Click{" "}
                    <span className="font-semibold text-neutral-300">
                      “Create product”
                    </span>{" "}
                    or{" "}
                    <span className="font-semibold text-neutral-300">
                      “Add product row”
                    </span>{" "}
                    to start linking products to this service.
                  </div>
                ) : null}

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
                            New product link
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {row.medicineId ? (
                            <button
                              type="button"
                              onClick={() => {
                                const med = allMedicines.find(
                                  (m) => m._id === row.medicineId,
                                );
                                if (!med) {
                                  toast.error(
                                    "Selected product not found. Try refreshing.",
                                  );
                                  return;
                                }
                                openMedEdit(med);
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-neutral-800/70 px-2.5 py-1 text-[11px] font-medium text-neutral-100 hover:bg-neutral-700"
                            >
                              Edit product
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => removeMedicineRow(row.key)}
                            className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                          >
                            <X size={12} />
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))_auto] items-end">
                        {/* Product dropdown */}
                        <div className="sm:col-span-1">
                          <label className="mb-1 block text-xs font-medium text-neutral-300">
                            Product
                          </label>

                          {loadingMeds ? (
                            <div className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-sm text-neutral-400 flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading products…
                            </div>
                          ) : (
                            <MedicineDropdown
                              value={row.medicineId}
                              onChange={(medicineId) =>
                                updateMedicineRow(row.key, { medicineId })
                              }
                              allMedicines={allMedicines}
                              linkedByMedicineId={linkedByMedicineId}
                              linkedIdsNoLinkId={linkedIdsNoLinkId}
                              selectedIds={selectedIds}
                              onRequestUnlink={openUnlinkConfirm}
                              unlinkingMedicineId={unlinkingMedicineId}
                            />
                          )}
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

                {serviceMedicineRows.length > 0 ? (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveMedicines}
                      disabled={savingMeds}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-blue-500 disabled:opacity-60"
                    >
                      {savingMeds ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {savingMeds ? "Saving products..." : "Save products"}
                    </button>
                  </div>
                ) : null}
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
                onClick={() => document.getElementById("edit-img")?.click()}
                title="Click to change image"
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
                      Click to change
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (serviceImageObjectUrlRef.current) {
                          URL.revokeObjectURL(serviceImageObjectUrlRef.current);
                          serviceImageObjectUrlRef.current = null;
                        }
                        setImagePreview(null);
                        setImageFile(null);
                        setExistingImagePath(null);
                      }}
                      className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-600/90 text-white shadow hover:bg-red-500 transition-colors"
                      title="Remove image"
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

                  // cleanup previous object url
                  if (serviceImageObjectUrlRef.current) {
                    URL.revokeObjectURL(serviceImageObjectUrlRef.current);
                    serviceImageObjectUrlRef.current = null;
                  }

                  const url = URL.createObjectURL(file);
                  serviceImageObjectUrlRef.current = url;

                  setImageFile(file);
                  setExistingImagePath(null);
                  setImagePreview(url);
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
                onChange={(e) =>
                  setViewType(e.target.value === "list" ? "list" : "card")
                }
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

      {/* Confirm Popup for Unlink */}
      {unlinkConfirm.open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800/80 bg-gradient-to-b from-neutral-900 to-neutral-950 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  Confirm action
                </p>
                <h3 className="mt-1 text-base font-semibold text-neutral-50">
                  Unlink product?
                </h3>
              </div>

              <button
                type="button"
                onClick={closeUnlinkConfirm}
                disabled={!!unlinkingMedicineId}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700/70 bg-neutral-900/80 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/90 hover:border-neutral-600 transition-colors disabled:opacity-60"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-neutral-300">
                This will remove{" "}
                <span className="font-semibold text-neutral-100">
                  {unlinkConfirm.medicineName}
                </span>{" "}
                from this service.
              </p>
              <p className="text-xs text-neutral-500">
                You can link it again later if needed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-800 bg-neutral-900/70 px-5 py-4 rounded-b-2xl">
              <button
                type="button"
                onClick={closeUnlinkConfirm}
                disabled={!!unlinkingMedicineId}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmUnlinkMedicine}
                disabled={!!unlinkingMedicineId}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/25 transition-colors disabled:opacity-60"
              >
                {unlinkingMedicineId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {unlinkingMedicineId ? "Unlinking..." : "Unlink"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Inline Medicine Modal (create + edit) */}
      {isMedModalOpen ? (
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
                {medError ? (
                  <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {medError}
                  </div>
                ) : null}

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
                        Name, slug and SKU for this product.
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
                        onClick={() =>
                          setMedAllowReorder((prev) =>
                            prev === "true" ? "false" : "true",
                          )
                        }
                        className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
                          medAllowReorder === "true"
                            ? "bg-emerald-500/15 text-neutral-300 border-neutral-600"
                            : "bg-neutral-800 text-neutral-300 border border-neutral-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-[10px] w-[10px] rounded-full ${
                            medAllowReorder === "true"
                              ? "bg-emerald-400"
                              : "bg-neutral-500"
                          }`}
                        />
                        {medAllowReorder === "true"
                          ? "Re-order allowed"
                          : "Re-order not allowed"}
                      </button>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Toggle to control whether this product can be ordered
                        again.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section: Variations */}
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
                            {variation.title ? (
                              <span className="text-xs text-neutral-300">
                                ({variation.title})
                              </span>
                            ) : null}
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
                                  e.target.value,
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
                                    e.target.value,
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
                                  e.target.value,
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
                                  e.target.value,
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
                                  e.target.value,
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
                                  e.target.value,
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

                            {medImagePreview || medExistingImagePath ? (
                              <button
                                type="button"
                                onClick={handleMedRemoveImage}
                                className="inline-flex items-center justify-center rounded-md border border-red-500/60 bg-red-600/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-600/20 transition-colors"
                              >
                                Remove
                              </button>
                            ) : null}
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

                          if (medImageObjectUrlRef.current) {
                            URL.revokeObjectURL(medImageObjectUrlRef.current);
                            medImageObjectUrlRef.current = null;
                          }

                          const url = URL.createObjectURL(file);
                          medImageObjectUrlRef.current = url;

                          setMedImageFile(file);
                          setMedImagePreview(url);
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
      ) : null}
    </div>
  );
}
