"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Save,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getBackendBase, updateClinicFormApi } from "../../../../api";

/* ---------- Types aligned with backend ---------- */

type FieldType =
  | "section"
  | "text"
  | "email"
  | "number"
  | "textarea"
  | "date"
  | "select"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "file"
  | "signature"
  | "textBlock"
  | "divider"
  | "image"
  | "pageBreak";

type Option = {
  id: string;
  label: string;
  value: string;
};

type ShowIf = {
  enabled: boolean;
  field: string | null;
  equals: string | null;
  in: string[];
  inRaw?: string; // UI-only raw comma-separated string
  truthy: boolean;
  notEquals: string | null;
};

type BaseField = {
  id: string;
  type: FieldType;
  label: string;
  key: string;
  required?: boolean;
  helpText?: string;
  showIf?: ShowIf;
};

type FormField = BaseField & {
  placeholder?: string;
  options?: Option[];
  content?: string;
  imageUrl?: string;
  multiple?: boolean; // for select / dropdown / checkbox
  hidden?: boolean;
  disabled?: boolean;
  fileMultiple?: boolean; // for file upload
};

type ServiceLite = {
  _id: string;
  name: string;
  slug: string;
};

/* ---------- Palette ---------- */

const FIELD_PALETTE: { type: FieldType; label: string }[] = [
  { type: "section", label: "Section" },
  { type: "text", label: "Text Input" },
  { type: "email", label: "Email" },
  { type: "number", label: "Number" },
  { type: "textarea", label: "Textarea" },
  { type: "date", label: "Date" },
  { type: "select", label: "Multi Select" },
  { type: "dropdown", label: "Dropdown (Single Select)" },
  { type: "radio", label: "Radio Buttons" },
  { type: "checkbox", label: "Checkbox Group" },
  { type: "file", label: "File Upload" },
  { type: "signature", label: "Signature" },
  { type: "textBlock", label: "Text Block" },
  { type: "divider", label: "Divider" },
  { type: "image", label: "Image" },
  { type: "pageBreak", label: "Page Break" },
];

/* ---------- Helpers ---------- */

function createId() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultShowIf(): ShowIf {
  return {
    enabled: false,
    field: null,
    equals: null,
    in: [],
    inRaw: "",
    truthy: false,
    notEquals: null,
  };
}

// humanize snake_case → "Title Case"
function humanizeType(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// "Advice notes" → "advice_notes"
function labelToTypeValue(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/* ---------- Edit Page ---------- */

export default function EditClinicFormPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);

  // top-level loading
  const [pageLoading, setPageLoading] = useState(true);

  // ----- Meta / header fields -----
  const [formName, setFormName] = useState("");
  const [description, setDescription] = useState("");

  // Service selection
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceSlug, setServiceSlug] = useState("");
  const [serviceId, setServiceId] = useState("");

  const [treatmentSlug, setTreatmentSlug] = useState("");

  // Form type with dynamic options
  const [formTypeOptions, setFormTypeOptions] = useState<string[]>([
    "pharmacist_declaration",
    "clinical_notes",
    "advice",
    "raf",
    "reorder",
  ]);
  const [formType, setFormType] = useState("raf");
  const [newFormTypeLabel, setNewFormTypeLabel] = useState("");

  const [rafStatus, setRafStatus] = useState<"draft" | "published">("draft");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // ----- Builder state -----
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const selectedField = useMemo(
    () => fields.find((f) => f.id === selectedFieldId) || null,
    [fields, selectedFieldId]
  );

  /* ---------- load services ---------- */

  useEffect(() => {
    const loadServices = async () => {
      try {
        setServicesLoading(true);
        const base = getBackendBase();
        const res = await fetch(`${base}/services`);
        if (!res.ok) throw new Error("Failed to fetch services");
        const json = await res.json();
        const list: ServiceLite[] = (json.data || json || []).map((s: any) => ({
          _id: s._id,
          name: s.name,
          slug: s.slug,
        }));
        setServices(list);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load services for dropdown");
      } finally {
        setServicesLoading(false);
      }
    };
    loadServices();
  }, []);

  const handleServiceChange = (value: string) => {
    if (value === "global") {
      setServiceId("");
      setServiceSlug("");
      return;
    }
    const svc = services.find((s) => s._id === value);
    if (!svc) return;
    setServiceId(svc._id);
    setServiceSlug(svc.slug);
  };

  /* ---------- parse backend schema -> FormField[] ---------- */

  function parseBackendFieldToFormField(f: any): FormField {
    const type: string = f.type;
    const data = f.data || {};

    const rawShowIf = data.showIf || {};
    const rawIn = rawShowIf.in;

    const inArray: string[] = Array.isArray(data.showIf?.in)
      ? data.showIf.in
      : [];

    let inArr: string[] = [];

    if (Array.isArray(rawIn)) {
      inArr = rawIn
        .filter((v: any) => typeof v === "string")
        .map((v: string) => v.trim())
        .filter(Boolean);
    } else if (typeof rawIn === "string") {
      inArr = rawIn
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }

    const showIf: ShowIf = {
      enabled: !!data.showIf?.enabled,
      field: data.showIf?.field ?? null,
      equals: data.showIf?.equals ?? null,
      in: inArray,
      inRaw: inArray.join(", "),
      truthy: !!data.showIf?.truthy,
      notEquals: data.showIf?.notEquals ?? null,
    };

    const base: BaseField = {
      id: createId(),
      type: "text",
      label: data.label ?? "",
      key: data.key ?? createId(),
      required: !!data.required,
      helpText: data.help ?? null,
      showIf,
    };

    // map types
    if (type === "section") {
      return {
        ...base,
        type: "section",
      };
    }

    if (type === "textarea") {
      return {
        ...base,
        type: "textarea",
        placeholder: data.placeholder ?? "",
        hidden: !!data.hidden,
        disabled: !!data.disabled,
      };
    }

    if (type === "date") {
      return {
        ...base,
        type: "date",
        placeholder: "",
      };
    }

    if (type === "select") {
      const optsArray =
        data.options?.map((o: any) => ({
          id: createId(),
          label: o.label,
          value: o.value,
        })) || [];
      const multiple = !!data.multiple;
      return {
        ...base,
        type: multiple ? "select" : "dropdown",
        multiple,
        options: optsArray,
      };
    }

    if (type === "radio") {
      const optsArray =
        data.options?.map((o: any) => ({
          id: createId(),
          label: o.label,
          value: o.value,
        })) || [];
      return {
        ...base,
        type: "radio",
        options: optsArray,
      };
    }

    if (type === "checkbox") {
      const optsArray =
        data.options?.map((o: any) => ({
          id: createId(),
          label: o.label,
          value: o.value,
        })) || [];
      return {
        ...base,
        type: "checkbox",
        options: optsArray,
        multiple: true,
      };
    }

    if (type === "file_upload") {
      return {
        ...base,
        type: "file",
        fileMultiple: !!data.multiple,
      };
    }

    if (type === "text_block") {
      return {
        ...base,
        type: "textBlock",
        content: data.content ?? "",
      };
    }

    if (type === "image") {
      return {
        ...base,
        type: "image",
        imageUrl: data.url ?? "",
      };
    }

    if (type === "signature") {
      return {
        ...base,
        type: "signature",
      };
    }

    if (type === "divider") {
      return {
        ...base,
        type: "divider",
      };
    }

    if (type === "page_break") {
      return {
        ...base,
        type: "pageBreak",
      };
    }

    // default: text input with inputType
    const inputType = data.inputType as
      | "text"
      | "email"
      | "number"
      | "date"
      | undefined;

    const mappedType: FieldType =
      inputType === "email"
        ? "email"
        : inputType === "number"
        ? "number"
        : inputType === "date"
        ? "date"
        : "text";

    return {
      ...base,
      type: mappedType,
      placeholder: data.placeholder ?? "",
      hidden: !!data.hidden,
      disabled: !!data.disabled,
    };
  }

  /* ---------- load existing form ---------- */

  useEffect(() => {
    if (!id) return;

    const loadForm = async () => {
      try {
        setPageLoading(true);
        const base = getBackendBase();
        const res = await fetch(`${base}/clinic-forms/${id}`);
        if (!res.ok) throw new Error("Failed to fetch form");
        const form = await res.json();

        // meta
        setFormName(form.name || "");
        setDescription(form.description || "");
        setServiceId(form.service_id || "");
        setServiceSlug(form.service_slug || "");
        setTreatmentSlug(form.treatment_slug || "");
        setIsActive(form.is_active ?? true);
        setRafStatus(form.raf_status ?? "draft");
        setFormType(form.form_type || "raf");

        // ensure current form_type is in options
        if (form.form_type && !formTypeOptions.includes(form.form_type)) {
          setFormTypeOptions((prev) => [...prev, form.form_type]);
        }

        // schema
        const incomingSchema = form.schema || [];
        const parsedFields: FormField[] = incomingSchema.map(
          parseBackendFieldToFormField
        );
        setFields(parsedFields);
        if (parsedFields.length) setSelectedFieldId(parsedFields[0].id);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load form");
      } finally {
        setPageLoading(false);
      }
    };

    loadForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ---------- form type adding ---------- */

  const handleAddFormType = () => {
    const slug = labelToTypeValue(newFormTypeLabel);
    if (!slug) {
      toast.error("Please enter a valid form type label");
      return;
    }
    if (formTypeOptions.includes(slug)) {
      toast.info("This form type already exists");
      setFormType(slug);
      setNewFormTypeLabel("");
      return;
    }
    setFormTypeOptions((prev) => [...prev, slug]);
    setFormType(slug);
    setNewFormTypeLabel("");
    toast.success(`Added new form type: ${slug}`);
  };

  /* ---------- Builder handlers ---------- */

  const updateField = (fid: string, patch: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fid ? { ...f, ...patch } : f))
    );
  };

  const updateShowIf = (fid: string, patch: Partial<ShowIf>) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fid) return f;
        const current = f.showIf || defaultShowIf();
        return { ...f, showIf: { ...current, ...patch } };
      })
    );
  };

  const deleteField = (fid: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fid));
    if (selectedFieldId === fid) setSelectedFieldId(null);
  };

  const moveField = (fid: string, direction: "up" | "down") => {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === fid);
      if (index === -1) return prev;
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const arr = [...prev];
      const [removed] = arr.splice(index, 1);
      arr.splice(newIndex, 0, removed);
      return arr;
    });
  };

  const addOption = (fieldId: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const opts = f.options || [];
        const nextIndex = opts.length + 1;
        const newOption: Option = {
          id: createId(),
          label: `Option ${nextIndex}`,
          value: `option_${nextIndex}`,
        };
        return { ...f, options: [...opts, newOption] };
      })
    );
  };

  const updateOption = (
    fieldId: string,
    optionId: string,
    patch: Partial<Option>
  ) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const opts = f.options || [];
        return {
          ...f,
          options: opts.map((o) =>
            o.id === optionId ? { ...o, ...patch } : o
          ),
        };
      })
    );
  };

  const deleteOption = (fieldId: string, optionId: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const opts = f.options || [];
        return { ...f, options: opts.filter((o) => o.id !== optionId) };
      })
    );
  };

  /* ---------- build backend schema from fields ---------- */

  const apiSchema = useMemo(
    () =>
      fields.map((f) => {
        const showIf: ShowIf = f.showIf || defaultShowIf();

        const baseShowIf = {
          enabled: showIf.enabled,
          field: showIf.field,
          equals: showIf.equals,
          in: showIf.in || [],
          truthy: showIf.truthy,
          notEquals: showIf.notEquals,
        };

        const optionsForApi =
          f.options?.map((o) => ({
            label: o.label,
            value: o.value,
          })) || [];

        switch (f.type) {
          case "section":
            return {
              type: "section",
              data: {
                label: f.label,
                summary: null,
                key: f.key || null,
                showIf: baseShowIf,
              },
            };

          case "textarea":
            return {
              type: "textarea",
              data: {
                label: f.label,
                placeholder: f.placeholder || null,
                required: !!f.required,
                help: f.helpText || null,
                hidden: !!f.hidden,
                disabled: !!f.disabled,
                showIf: baseShowIf,
                key: f.key || null,
              },
            };

          case "date":
            return {
              type: "date",
              data: {
                label: f.label,
                required: !!f.required,
                help: f.helpText || null,
                date: null,
                showIf: baseShowIf,
                key: f.key || null,
              },
            };

          case "select":
          case "dropdown":
            return {
              type: "select",
              data: {
                label: f.label,
                options: optionsForApi,
                multiple: f.type === "select" ? !!f.multiple : false,
                required: !!f.required,
                help: f.helpText || null,
                showIf: baseShowIf,
                key: f.key || null,
              },
            };

          case "radio":
            return {
              type: "radio",
              data: {
                label: f.label,
                options: optionsForApi,
                required: !!f.required,
                help: f.helpText || null,
                showIf: baseShowIf,
                key: f.key || null,
              },
            };

          case "checkbox":
            return {
              type: "checkbox",
              data: {
                label: f.label,
                options: optionsForApi,
                required: !!f.required,
                help: f.helpText || null,
                showIf: baseShowIf,
                key: f.key || null,
              },
            };

          case "file":
            return {
              type: "file_upload",
              data: {
                label: f.label,
                multiple: !!f.fileMultiple,
                required: !!f.required,
                help: f.helpText || null,
                showIf: baseShowIf,
                key: f.key || null,
                accept: null,
              },
            };

          case "textBlock":
            return {
              type: "text_block",
              data: {
                label: f.label,
                content: f.content || "",
                help: f.helpText || null,
                showIf: baseShowIf,
                key: f.key || null,
              },
            };

          case "image":
            return {
              type: "image",
              data: {
                label: f.label,
                url: f.imageUrl || "",
                help: f.helpText || null,
                showIf: baseShowIf,
                key: f.key || null,
              },
            };

          case "signature":
            return {
              type: "signature",
              data: {
                label: f.label,
                required: !!f.required,
                help: f.helpText || null,
                showIf: baseShowIf,
                key: f.key || null,
              },
            };

          case "divider":
            return {
              type: "divider",
              data: {
                key: f.key || null,
                showIf: baseShowIf,
              },
            };

          case "pageBreak":
            return {
              type: "page_break",
              data: {
                key: f.key || null,
                showIf: baseShowIf,
              },
            };

          default:
            // text/email/number/date (text-based)
            return {
              type: "text",
              data: {
                label: f.label,
                inputType: f.type,
                placeholder: f.placeholder || null,
                required: !!f.required,
                help: f.helpText || null,
                hidden: !!f.hidden,
                disabled: !!f.disabled,
                showIf: baseShowIf,
                key: f.key || null,
              },
            };
        }
      }),
    [fields]
  );

  const formPayload = useMemo(
    () => ({
      name: formName || "Untitled form",
      description: description || "",
      schema: apiSchema,
      service_id: serviceId || undefined,
      service_slug: serviceSlug || "",
      treatment_slug: treatmentSlug || "",
      version: 1,
      is_active: isActive,
      raf_schema: [],
      raf_version: 1,
      raf_status: rafStatus,
      form_type: formType,
    }),
    [
      formName,
      description,
      apiSchema,
      serviceId,
      serviceSlug,
      treatmentSlug,
      isActive,
      rafStatus,
      formType,
    ]
  );

  const copySchema = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(formPayload, null, 2));
      toast.success("Form payload copied to clipboard");
    } catch (e) {
      console.error(e);
      toast.error("Failed to copy payload");
    }
  };

  const handleSave = async () => {
    if (!id) return;
    if (!formName.trim()) {
      toast.error("Please enter a form name");
      return;
    }
    if (fields.length === 0) {
      toast.error("Please add at least one field to the form");
      return;
    }

    try {
      setSaving(true);
      await updateClinicFormApi(id, formPayload);
      toast.success("Form updated successfully");
      router.push("/dashboard/forms");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update form");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- UI ---------- */

  if (!id) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-neutral-100">
        <p>Invalid form id</p>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-neutral-400">
        <ToastContainer position="top-right" autoClose={3000} />
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-neutral-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading form...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-neutral-100">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Top header + actions */}
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Link
            href="/dashboard/forms"
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to forms
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">
              Edit Clinic Form
            </h1>
            <p className="text-sm text-neutral-400">
              Update fields and metadata. Changes will be saved to{" "}
              <span className="font-semibold text-neutral-100">
                /clinic-forms/{id}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copySchema}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs sm:text-sm font-medium text-neutral-100 border border-neutral-700 hover:bg-neutral-800"
          >
            <Copy className="h-4 w-4" />
            Copy payload JSON
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 shadow-lg"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {/* Meta card */}
      <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 sm:p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-neutral-300">
              Form name
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Travel Clinic - RAF"
              className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-300">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Risk Assessment for Travel Clinic"
              className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100"
            />
          </div>
        </div>

        <div className="space-y-4">
          {/* Service selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">
              Service (optional)
            </label>
            <select
              value={serviceId ? serviceId : serviceSlug === "" ? "global" : ""}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-100"
            >
              <option value="global">🌐 Global (no specific service)</option>
              {servicesLoading && (
                <option value="" disabled>
                  Loading services...
                </option>
              )}
              {!servicesLoading &&
                services.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.slug})
                  </option>
                ))}
            </select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[11px] font-medium text-neutral-400">
                  Service slug
                </label>
                <input
                  value={serviceSlug}
                  onChange={(e) => setServiceSlug(e.target.value)}
                  placeholder="travel-clinic"
                  className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-400">
                  Service ID
                </label>
                <input
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  placeholder="691d55e233f9d5d1a248163b"
                  className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-100"
                />
              </div>
            </div>
          </div>

          {/* Treatment + Form type */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-neutral-300">
                Treatment slug (optional)
              </label>
              <input
                value={treatmentSlug}
                onChange={(e) => setTreatmentSlug(e.target.value)}
                placeholder=""
                className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-100"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300">
                Form type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-100"
              >
                {formTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {humanizeType(type)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-neutral-500">
                Saved as snake_case, e.g. <code>advice_notes</code>.
              </p>

              <div className="mt-2 flex items-center gap-2">
                <input
                  value={newFormTypeLabel}
                  onChange={(e) => setNewFormTypeLabel(e.target.value)}
                  placeholder="Add new type, e.g. Advice Notes"
                  className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-100"
                />
                <button
                  type="button"
                  onClick={handleAddFormType}
                  className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-3 py-1.5 text-[11px] text-neutral-100 border border-neutral-700 hover:bg-neutral-700"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Active + RAF status */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                id="active-toggle"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-900"
              />
              <label
                htmlFor="active-toggle"
                className="text-xs text-neutral-300"
              >
                Active form
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-300">RAF status</span>
              <select
                value={rafStatus}
                onChange={(e) =>
                  setRafStatus(e.target.value as "draft" | "published")
                }
                className="rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-[11px] text-neutral-100"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1.6fr)_minmax(0,1.1fr)] gap-5">
        {/* Palette */}
        <aside className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-3">
          <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-[0.12em] mb-3">
            Field types
          </h2>
          <div className="space-y-1">
            {FIELD_PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => {
                  const newField: FormField = (() => {
                    const base: BaseField = {
                      id: createId(),
                      type: item.type,
                      label: item.label,
                      key: `${item.type}_${createId()}`,
                      required: false,
                      showIf: defaultShowIf(),
                    };

                    if (
                      item.type === "select" ||
                      item.type === "dropdown" ||
                      item.type === "radio" ||
                      item.type === "checkbox"
                    ) {
                      return {
                        ...base,
                        options: [
                          {
                            id: createId(),
                            label: "Option 1",
                            value: "option_1",
                          },
                          {
                            id: createId(),
                            label: "Option 2",
                            value: "option_2",
                          },
                        ],
                        multiple: item.type === "select",
                      };
                    }

                    if (item.type === "textBlock") {
                      return {
                        ...base,
                        type: "textBlock",
                        content:
                          "This is a static text block. You can edit this content.",
                      };
                    }

                    if (item.type === "image") {
                      return {
                        ...base,
                        type: "image",
                        imageUrl: "",
                        helpText: "Paste image URL or configure later.",
                      };
                    }

                    if (item.type === "file") {
                      return {
                        ...base,
                        type: "file",
                        fileMultiple: true,
                        helpText: "Max 10MB. PDF or image.",
                      };
                    }

                    if (
                      item.type === "divider" ||
                      item.type === "pageBreak" ||
                      item.type === "section"
                    ) {
                      return { ...base, type: item.type };
                    }

                    return {
                      ...base,
                      placeholder: "",
                    };
                  })();

                  setFields((prev) => [...prev, newField]);
                  setSelectedFieldId(newField.id);
                }}
                className="w-full text-left text-sm px-3 py-1.5 rounded-md bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800/80 hover:border-blue-500/60 text-neutral-100 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Canvas / Form preview */}
        <main className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-neutral-200">
              Form layout
            </h2>
            <span className="text-[11px] text-neutral-500">
              Click a field to edit its properties
            </span>
          </div>

          {fields.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-6 text-center text-sm text-neutral-400">
              No fields yet. Use the field types on the left to add fields.
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`group rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5 bg-neutral-900/80 flex items-start gap-3 ${
                    selectedFieldId === field.id
                      ? "border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.4)]"
                      : "border-neutral-800 hover:border-neutral-600"
                  }`}
                  onClick={() => setSelectedFieldId(field.id)}
                >
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveField(field.id, "up");
                      }}
                      className="p-0.5 rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="text-[10px] text-neutral-500">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveField(field.id, "down");
                      }}
                      className="p-0.5 rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-100">
                          {field.label || "(no label)"}
                        </span>
                        <span className="text-[11px] px-1.5 py-[1px] rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                          {field.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteField(field.id);
                        }}
                        className="inline-flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Quick preview */}
                    <div className="pt-1">
                      {field.type === "section" && (
                        <div className="border-b border-neutral-700 pb-1">
                          <span className="text-xs font-semibold text-neutral-300 uppercase tracking-[0.12em]">
                            {field.label || "Section"}
                          </span>
                        </div>
                      )}

                      {["text", "email", "number", "date"].includes(
                        field.type
                      ) && (
                        <input
                          disabled
                          className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400"
                          placeholder={field.placeholder || "Input preview"}
                        />
                      )}

                      {field.type === "textarea" && (
                        <textarea
                          disabled
                          className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400"
                          rows={2}
                          placeholder={field.placeholder || "Textarea preview"}
                        />
                      )}

                      {["select", "dropdown"].includes(field.type) && (
                        <select
                          disabled
                          className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400"
                        >
                          <option>— select —</option>
                          {field.options?.map((o) => (
                            <option key={o.id}>{o.label}</option>
                          ))}
                        </select>
                      )}

                      {field.type === "radio" && (
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-300">
                          {field.options?.map((o) => (
                            <label
                              key={o.id}
                              className="inline-flex items-center gap-1"
                            >
                              <input
                                type="radio"
                                disabled
                                className="h-3 w-3"
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                      )}

                      {field.type === "checkbox" && (
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-300">
                          {field.options?.map((o) => (
                            <label
                              key={o.id}
                              className="inline-flex items-center gap-1"
                            >
                              <input
                                type="checkbox"
                                disabled
                                className="h-3 w-3"
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                      )}

                      {field.type === "file" && (
                        <div className="mt-1">
                          <div className="inline-flex items-center rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[11px] text-neutral-400">
                            File upload preview
                          </div>
                        </div>
                      )}

                      {field.type === "signature" && (
                        <div className="mt-1 border border-dashed border-neutral-700 rounded-md h-16 flex items-center justify-center text-[11px] text-neutral-500">
                          Signature box preview
                        </div>
                      )}

                      {field.type === "textBlock" && (
                        <p className="mt-1 text-xs text-neutral-300 whitespace-pre-line">
                          {field.content}
                        </p>
                      )}

                      {field.type === "divider" && (
                        <div className="mt-2 border-t border-neutral-700" />
                      )}

                      {field.type === "image" && (
                        <div className="mt-1 h-20 border border-dashed border-neutral-700 rounded-md flex items-center justify-center text-[11px] text-neutral-500">
                          Image placeholder
                        </div>
                      )}

                      {field.type === "pageBreak" && (
                        <div className="mt-2 text-[11px] text-neutral-500 italic">
                          --- Page Break ---
                        </div>
                      )}

                      {field.helpText && (
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {field.helpText}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Inspector + JSON */}
        <aside className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-200">
            Field settings
          </h2>

          {!selectedField && (
            <p className="text-xs text-neutral-500">
              Select a field from the middle panel to configure its properties.
            </p>
          )}

          {selectedField && (
            <div className="space-y-4 text-sm">
              {/* Label */}
              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Label
                </label>
                <input
                  value={selectedField.label}
                  onChange={(e) =>
                    updateField(selectedField.id, { label: e.target.value })
                  }
                  className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-100"
                />
              </div>

              {/* Key */}
              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Field key (for backend)
                </label>
                <input
                  value={selectedField.key}
                  onChange={(e) =>
                    updateField(selectedField.id, { key: e.target.value })
                  }
                  className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                />
                <p className="mt-1 text-[11px] text-neutral-500">
                  This will be used as <code>data.key</code> in your schema.
                </p>
              </div>

              {/* Required */}
              {![
                "section",
                "divider",
                "textBlock",
                "image",
                "pageBreak",
              ].includes(selectedField.type) && (
                <div className="flex items-center gap-2">
                  <input
                    id="required-toggle"
                    type="checkbox"
                    checked={!!selectedField.required}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        required: e.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-900"
                  />
                  <label
                    htmlFor="required-toggle"
                    className="text-xs text-neutral-300"
                  >
                    Required field
                  </label>
                </div>
              )}

              {/* Placeholder */}
              {["text", "email", "number", "textarea", "date"].includes(
                selectedField.type
              ) && (
                <div>
                  <label className="text-xs font-medium text-neutral-300">
                    Placeholder
                  </label>
                  <input
                    value={selectedField.placeholder || ""}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        placeholder: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                  />
                </div>
              )}

              {/* Help text */}
              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Help text
                </label>
                <textarea
                  rows={2}
                  value={selectedField.helpText || ""}
                  onChange={(e) =>
                    updateField(selectedField.id, {
                      helpText: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                />
              </div>

              {/* Multiple for select/dropdown/checkbox */}
              {["select", "dropdown", "checkbox"].includes(
                selectedField.type
              ) && (
                <div className="flex items-center gap-2">
                  <input
                    id="multiple-toggle"
                    type="checkbox"
                    checked={!!selectedField.multiple}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        multiple: e.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-900"
                  />
                  <label
                    htmlFor="multiple-toggle"
                    className="text-xs text-neutral-300"
                  >
                    Allow multiple values (<code>data.multiple</code>)
                  </label>
                </div>
              )}

              {/* File multiple */}
              {selectedField.type === "file" && (
                <div className="flex items-center gap-2">
                  <input
                    id="file-multiple-toggle"
                    type="checkbox"
                    checked={!!selectedField.fileMultiple}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        fileMultiple: e.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-900"
                  />
                  <label
                    htmlFor="file-multiple-toggle"
                    className="text-xs text-neutral-300"
                  >
                    Allow multiple files
                  </label>
                </div>
              )}

              {/* Options */}
              {["select", "dropdown", "radio", "checkbox"].includes(
                selectedField.type
              ) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-300">
                      Options
                    </span>
                    <button
                      type="button"
                      onClick={() => addOption(selectedField.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-neutral-100 border border-neutral-700 hover:bg-neutral-700"
                    >
                      <Plus className="h-3 w-3" />
                      Add option
                    </button>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {selectedField.options?.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <input
                          value={opt.label}
                          onChange={(e) =>
                            updateOption(selectedField.id, opt.id, {
                              label: e.target.value,
                            })
                          }
                          placeholder="Label"
                          className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-xs text-neutral-100"
                        />
                        <input
                          value={opt.value}
                          onChange={(e) =>
                            updateOption(selectedField.id, opt.id, {
                              value: e.target.value,
                            })
                          }
                          placeholder="value_key"
                          className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-xs text-neutral-100"
                        />
                        <button
                          type="button"
                          onClick={() => deleteOption(selectedField.id, opt.id)}
                          className="p-1 rounded-md text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {(!selectedField.options ||
                      selectedField.options.length === 0) && (
                      <p className="text-[11px] text-neutral-500">
                        No options yet. Click “Add option” to create choices.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Text block content */}
              {selectedField.type === "textBlock" && (
                <div>
                  <label className="text-xs font-medium text-neutral-300">
                    Text content
                  </label>
                  <textarea
                    rows={4}
                    value={selectedField.content || ""}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        content: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                  />
                </div>
              )}

              {/* Image URL */}
              {selectedField.type === "image" && (
                <div>
                  <label className="text-xs font-medium text-neutral-300">
                    Image URL
                  </label>
                  <input
                    value={selectedField.imageUrl || ""}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        imageUrl: e.target.value,
                      })
                    }
                    placeholder="https://example.com/image.png"
                    className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                  />
                </div>
              )}

              {/* ShowIf configuration with equals + in (multiple) */}
              <div className="border-t border-neutral-800 pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    id="showif-toggle"
                    type="checkbox"
                    checked={!!selectedField.showIf?.enabled}
                    onChange={(e) =>
                      updateShowIf(selectedField.id, {
                        enabled: e.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-900"
                  />
                  <label
                    htmlFor="showif-toggle"
                    className="text-xs text-neutral-300"
                  >
                    Enable conditional visibility (showIf)
                  </label>
                </div>

                {selectedField.showIf?.enabled && (
                  <div className="space-y-2 pl-1">
                    {/* Source field key */}
                    <div>
                      <label className="text-xs font-medium text-neutral-300">
                        Source field key
                      </label>
                      <input
                        value={selectedField.showIf.field || ""}
                        onChange={(e) =>
                          updateShowIf(selectedField.id, {
                            field: e.target.value || null,
                          })
                        }
                        placeholder="e.g. meds_current"
                        className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>

                    {/* equals (single) */}
                    <div>
                      <label className="text-xs font-medium text-neutral-300">
                        Equals value (single)
                      </label>
                      <input
                        value={selectedField.showIf.equals || ""}
                        onChange={(e) =>
                          updateShowIf(selectedField.id, {
                            equals: e.target.value || null,
                          })
                        }
                        placeholder='e.g. "yes"'
                        className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Basic equality check:{" "}
                        <code>value === showIf.equals</code>.
                      </p>
                    </div>

                    {/* in (multiple) */}
                    <div>
                      <label className="text-xs font-medium text-neutral-300">
                        Equals any of these (comma-separated)
                      </label>
                      <input
                        value={(selectedField.showIf.in || []).join(", ")}
                        onChange={(e) => {
                          const values = e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean);
                          updateShowIf(selectedField.id, {
                            in: values,
                          });
                        }}
                        placeholder='e.g. "yes,no,maybe"'
                        className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                      <p className="mt-1 text-[11px] text-neutral-500">
                        This fills <code>showIf.in</code> as an array, e.g.{" "}
                        <code>["yes","no","maybe"]</code>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* JSON preview */}
          <div className="pt-4 border-t border-neutral-800 mt-4">
            <p className="text-xs font-semibold text-neutral-300 mb-2">
              Payload preview (what will be sent to{" "}
              <code>/clinic-forms/{id}</code>)
            </p>
            <pre className="max-h-60 overflow-auto rounded-md bg-neutral-950 border border-neutral-800 p-2 text-[10px] leading-relaxed text-neutral-300">
              {JSON.stringify(formPayload, null, 2)}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
