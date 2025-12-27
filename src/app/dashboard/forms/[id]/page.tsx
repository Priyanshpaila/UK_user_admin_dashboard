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

  // ✅ UI-only: once user edits value manually, we stop auto-syncing label -> value
  valueTouched?: boolean;
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

// ✅ Label -> value helper (preserves casing as typed; only sanitizes separators)
function optionLabelToValue(label: string) {
  return label
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
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

  // ✅ Insert-between state
  const [openInsertMenuAt, setOpenInsertMenuAt] = useState<number | null>(null);

  // ✅ Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ✅ Import payload JSON (UI-only)
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");

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

    const rawIn = data.showIf?.in;

    let inArr: string[] = [];
    if (Array.isArray(rawIn)) {
      inArr = rawIn
        .filter((v: any) => typeof v === "string")
        .map((v: string) => v.trim())
        .filter(Boolean);
    } else if (typeof rawIn === "string") {
      inArr = rawIn
        .split(",")
        .map((v: string) => v.trim())
        .filter(Boolean);
    }

    const showIf: ShowIf = {
      enabled: !!data.showIf?.enabled,
      field: data.showIf?.field ?? null,
      equals: data.showIf?.equals ?? null,
      in: inArr,
      inRaw: inArr.join(", "),
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
      const optsArray: Option[] =
        data.options?.map((o: any) => {
          const label = String(o.label ?? "");
          const value = String(o.value ?? "");

          // ✅ For edit page: if backend value doesn't match derived value,
          // treat it as "custom" and lock auto-sync by setting valueTouched = true.
          const derived = optionLabelToValue(label);
          const valueTouched = value !== derived;

          return {
            id: createId(),
            label,
            value,
            valueTouched,
          };
        }) || [];

      const multiple = !!data.multiple;
      return {
        ...base,
        type: multiple ? "select" : "dropdown",
        multiple,
        options: optsArray,
      };
    }

    if (type === "radio") {
      const optsArray: Option[] =
        data.options?.map((o: any) => {
          const label = String(o.label ?? "");
          const value = String(o.value ?? "");
          const derived = optionLabelToValue(label);
          const valueTouched = value !== derived;

          return {
            id: createId(),
            label,
            value,
            valueTouched,
          };
        }) || [];
      return {
        ...base,
        type: "radio",
        options: optsArray,
      };
    }

    if (type === "checkbox") {
      const optsArray: Option[] =
        data.options?.map((o: any) => {
          const label = String(o.label ?? "");
          const value = String(o.value ?? "");
          const derived = optionLabelToValue(label);
          const valueTouched = value !== derived;

          return {
            id: createId(),
            label,
            value,
            valueTouched,
          };
        }) || [];
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

        const label = `Option ${nextIndex}`;
        const newOption: Option = {
          id: createId(),
          label,
          value: optionLabelToValue(label), // ✅ auto-fill from label
          valueTouched: false,
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
          options: opts.map((o) => {
            if (o.id !== optionId) return o;

            // ✅ Requirement: when label changes, auto-fill value (same casing),
            // unless the user manually edited value (valueTouched === true),
            // or caller explicitly sets patch.value.
            if (typeof patch.label === "string") {
              const nextLabel = patch.label;
              const explicitValueProvided = patch.value != null;
              const shouldAutoSync = !o.valueTouched && !explicitValueProvided;

              if (shouldAutoSync) {
                return {
                  ...o,
                  ...patch,
                  value: optionLabelToValue(nextLabel),
                };
              }
            }

            return { ...o, ...patch };
          }),
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

  // ✅ Create a new field using your EXISTING palette-add logic (kept same defaults)
  const buildNewFieldFromPalette = (
    type: FieldType,
    label: string
  ): FormField => {
    const base: BaseField = {
      id: createId(),
      type,
      label,
      key: `${type}_${createId()}`,
      required: false,
      showIf: defaultShowIf(),
    };

    if (
      type === "select" ||
      type === "dropdown" ||
      type === "radio" ||
      type === "checkbox"
    ) {
      const l1 = "Option 1";
      const l2 = "Option 2";

      return {
        ...base,
        options: [
          {
            id: createId(),
            label: l1,
            value: optionLabelToValue(l1),
            valueTouched: false,
          },
          {
            id: createId(),
            label: l2,
            value: optionLabelToValue(l2),
            valueTouched: false,
          },
        ],
        multiple: type === "select",
      };
    }

    if (type === "textBlock") {
      return {
        ...base,
        type: "textBlock",
        content: "This is a static text block. You can edit this content.",
      };
    }

    if (type === "image") {
      return {
        ...base,
        type: "image",
        imageUrl: "",
        helpText: "Paste image URL or configure later.",
      };
    }

    if (type === "file") {
      return {
        ...base,
        type: "file",
        fileMultiple: true,
        helpText: "Max 10MB. PDF or image.",
      };
    }

    if (type === "divider" || type === "pageBreak" || type === "section") {
      return { ...base, type };
    }

    return {
      ...base,
      placeholder: "",
    };
  };

  // ✅ Add field at any index (defaults bottom)
  const handleAddField = (
    type: FieldType,
    label: string,
    insertIndex?: number
  ) => {
    const newField = buildNewFieldFromPalette(type, label);

    setFields((prev) => {
      if (insertIndex == null || insertIndex < 0 || insertIndex > prev.length) {
        return [...prev, newField];
      }
      const arr = [...prev];
      arr.splice(insertIndex, 0, newField);
      return arr;
    });

    setSelectedFieldId(newField.id);
    setOpenInsertMenuAt(null);
  };

  /* ---------- Drag & drop reorder ---------- */

  const reorderByDropIndex = (fieldId: string, dropIndex: number) => {
    setFields((prev) => {
      const fromIndex = prev.findIndex((f) => f.id === fieldId);
      if (fromIndex === -1) return prev;

      const next = [...prev];
      const [moving] = next.splice(fromIndex, 1);

      let targetIndex = dropIndex;
      if (fromIndex < dropIndex) targetIndex = dropIndex - 1;

      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex > next.length) targetIndex = next.length;

      next.splice(targetIndex, 0, moving);
      return next;
    });
  };

  const onDragStartField = (e: React.DragEvent, fid: string) => {
    e.dataTransfer.setData("text/plain", fid);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(fid);
  };

  const onDragEndField = () => {
    setDraggingId(null);
    setDragOverIndex(null);
  };

  const onDragOverInsert = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const onDropInsert = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const fid = e.dataTransfer.getData("text/plain");
    if (!fid) return;
    reorderByDropIndex(fid, index);
    setDragOverIndex(null);
    setDraggingId(null);
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

  // ✅ Import payload JSON (replaces current editor state; does NOT save to backend)
  const handleImportPayload = () => {
    try {
      const parsed = JSON.parse(importJson);

      // Allow importing either:
      // 1) Full payload: { name, description, schema: [...] , ... }
      // 2) Schema-only array: [ ...schemaItems ]
      const schemaArr = Array.isArray(parsed) ? parsed : parsed?.schema;

      if (!Array.isArray(schemaArr)) {
        toast.error(
          'Invalid JSON. Provide either an array schema or a payload with "schema: []".'
        );
        return;
      }

      // If full payload object, import metadata too
      if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
        if (typeof parsed.name === "string") setFormName(parsed.name);
        if (typeof parsed.description === "string")
          setDescription(parsed.description);

        if (typeof parsed.service_id === "string") setServiceId(parsed.service_id);
        if (typeof parsed.service_slug === "string") setServiceSlug(parsed.service_slug);
        if (typeof parsed.treatment_slug === "string")
          setTreatmentSlug(parsed.treatment_slug);

        if (typeof parsed.is_active === "boolean") setIsActive(parsed.is_active);

        if (parsed.raf_status === "draft" || parsed.raf_status === "published") {
          setRafStatus(parsed.raf_status);
        }

        if (typeof parsed.form_type === "string" && parsed.form_type.trim()) {
          const ft = parsed.form_type.trim();
          setFormType(ft);
          setFormTypeOptions((prev) => (prev.includes(ft) ? prev : [...prev, ft]));
        }
      }

      // Replace fields using your existing parser
      const parsedFields: FormField[] = schemaArr.map(parseBackendFieldToFormField);

      setFields(parsedFields);
      setSelectedFieldId(parsedFields[0]?.id ?? null);

      setImportOpen(false);
      setImportJson("");
      toast.success("Payload imported into editor");
    } catch (e) {
      console.error(e);
      toast.error("Invalid JSON format");
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

  /* ---------- Insert row UI ---------- */

  const InsertRow = ({ index }: { index: number }) => {
    const menuOpen = openInsertMenuAt === index;
    const isDropTarget = dragOverIndex === index && draggingId;

    return (
      <div
        className="relative py-2"
        onDragOver={(e) => onDragOverInsert(e, index)}
        onDrop={(e) => onDropInsert(e, index)}
      >
        <div className="flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-neutral-800" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenInsertMenuAt((prev) => (prev === index ? null : index));
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
              isDropTarget
                ? "border-blue-500 bg-blue-500/10 text-blue-200"
                : "border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
            title="Add field here"
          >
            <Plus className="h-3 w-3" />
            Add field here
          </button>
          <div className="h-px flex-1 bg-neutral-800" />
        </div>

        {menuOpen && (
          <div
            className="absolute left-1/2 top-full z-30 mt-2 w-[280px] -translate-x-1/2 rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-neutral-800">
              <p className="text-xs font-semibold text-neutral-200">
                Insert field at position {index + 1}
              </p>
              <p className="text-[11px] text-neutral-500">
                Choose a field type to insert here.
              </p>
            </div>

            <div className="max-h-72 overflow-auto p-2">
              <div className="space-y-1">
                {FIELD_PALETTE.map((item) => (
                  <button
                    key={`${index}-${item.type}`}
                    type="button"
                    onClick={() => handleAddField(item.type, item.label, index)}
                    className="w-full text-left text-sm px-3 py-2 rounded-md bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800/80 hover:border-blue-500/60 text-neutral-100 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setOpenInsertMenuAt(null)}
                className="mt-2 w-full rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-[11px] text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
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

      {/* ✅ Import Modal */}
      {importOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setImportOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-100">
                  Import payload JSON
                </h3>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Paste the JSON you copied from “Copy payload JSON”. This will
                  replace the current editor state (nothing is saved until you
                  click “Save changes”).
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setImportJson("");
                }}
                className="rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                Close
              </button>
            </div>

            <textarea
              rows={10}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder={`{ "name": "My Form", "description": "", "schema": [ ... ] }`}
              className="mt-3 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-[11px] text-neutral-100 font-mono"
            />

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setImportJson("");
                }}
                className="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleImportPayload}
                className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

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

          {/* ✅ Import button */}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs sm:text-sm font-medium text-neutral-100 border border-neutral-700 hover:bg-neutral-800"
          >
            Import payload JSON
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
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1.6fr)_minmax(0,1.1fr)] gap-5 lg:items-start">
        {/* ✅ Sticky Palette */}
        <aside className="self-start lg:sticky lg:top-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-3 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-[0.12em] mb-3">
              Field types
            </h2>
            <p className="mb-3 text-[11px] text-neutral-500">
              Tip: Use “Add field here” in the middle panel to insert between
              fields.
            </p>

            <div className="space-y-1">
              {FIELD_PALETTE.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddField(item.type, item.label)}
                  className="w-full text-left text-sm px-3 py-1.5 rounded-md bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800/80 hover:border-blue-500/60 text-neutral-100 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Canvas / Form preview */}
        <main className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-sm font-semibold text-neutral-200">
                Form layout
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Use “Add field here” to insert between fields.
              </p>
            </div>
            <span className="text-[11px] text-neutral-500">
              Click a field to edit its properties
            </span>
          </div>

          {fields.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-6 text-center text-sm text-neutral-400">
              No fields yet. Use the field types on the left to add fields.
            </div>
          ) : (
            <div className="space-y-1">
              {/* ✅ Insert before first */}
              <InsertRow index={0} />

              {fields.map((field, index) => (
                <React.Fragment key={field.id}>
                  <div
                    draggable
                    onDragStart={(e) => onDragStartField(e, field.id)}
                    onDragEnd={onDragEndField}
                    className={`group rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5 bg-neutral-900/80 flex items-start gap-3 cursor-pointer ${
                      selectedFieldId === field.id
                        ? "border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.4)]"
                        : "border-neutral-800 hover:border-neutral-600"
                    } ${draggingId === field.id ? "opacity-70" : ""}`}
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
                        title="Move up"
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
                        title="Move down"
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
                          title="Delete field"
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

                  {/* ✅ Insert between this and next */}
                  <InsertRow index={index + 1} />
                </React.Fragment>
              ))}
            </div>
          )}
        </main>

        {/* ✅ Sticky Inspector + JSON */}
        <aside className="self-start lg:sticky lg:top-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-4 space-y-4 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
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
                {[
                  "section",
                  "divider",
                  "textBlock",
                  "image",
                  "pageBreak",
                ].includes(selectedField.type) === false && (
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
                              // ✅ label change auto-fills value unless valueTouched
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
                              // ✅ manual value edit => lock auto-sync
                              updateOption(selectedField.id, opt.id, {
                                value: e.target.value,
                                valueTouched: true,
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

                      <div>
                        <label className="text-xs font-medium text-neutral-300">
                          Equals any of these (comma-separated)
                        </label>
                        <input
                          value={
                            selectedField.showIf?.inRaw ??
                            (selectedField.showIf?.in || []).join(", ")
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            const values = raw
                              .split(",")
                              .map((v) => v.trim())
                              .filter(Boolean);

                            updateShowIf(selectedField.id, {
                              inRaw: raw,
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
          </div>
        </aside>
      </div>
    </div>
  );
}
