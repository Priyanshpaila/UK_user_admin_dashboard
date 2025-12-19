"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  getClinicFormsApi,
  getServiceApi,
  type ClinicForm,
} from "../../../../api";

type FieldsState = {
  [fieldKey: string]: string;
};

interface Props {
  orderId: string;
  serviceId: string;
}

/* ----------------- helpers ----------------- */

function extractId(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v._id || v.$oid || v.id || "");
}

function parseMaybeJsonObject(val: any): Record<string, any> | null {
  if (!val) return null;

  if (typeof val === "object" && !Array.isArray(val)) return val as any;

  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return null;
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as any;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Record of Supply tab in your project uses the "clinical_notes" assigned form.
 * (Service example has: clinical_notes: "<formId>")
 *
 * We also fallback to record_of_supply in case you introduce that key later.
 */
function pickRecordOfSupplyFormIdFromService(service: any): string | null {
  if (!service) return null;

  const candidates = [
    service.forms_assignment,
    service.formsAssignment,
    service.forms_assignments,
    service.formsAssignments,
    service.form_assignment,
    service.form_assignments,
    service?.meta?.forms_assignment,
    service?.meta?.formsAssignment,
  ];

  for (const c of candidates) {
    const m = parseMaybeJsonObject(c);
    if (!m) continue;

    const keysToTry = [
      "clinical_notes",
      "clinicalNotes",
      "record_of_supply",
      "recordOfSupply",
    ];

    for (const k of keysToTry) {
      const id = extractId((m as any)[k]);
      if (id) return id;
    }
  }

  return null;
}

export default function RecordOfSupplyTab({ orderId, serviceId }: Props) {
  const [form, setForm] = useState<ClinicForm | null>(null);
  const [fields, setFields] = useState<FieldsState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const storageKey = useMemo(
    () => `consultation_${orderId}_record`,
    [orderId]
  );

  // Load assigned form + LS
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!serviceId) {
        setError("Missing service id for Record of Supply form");
        setLoading(false);
        setHydrated(true);
        return;
      }

      setLoading(true);
      setError(null);
      setHydrated(false);

      try {
        // 1) Fetch service
        const sRes: any = await getServiceApi(serviceId);
        const service = sRes?.data ?? sRes;

        // 2) Read assigned form id (from forms_assignment JSON string)
        const assignedFormId = pickRecordOfSupplyFormIdFromService(service);

        if (!assignedFormId) {
          if (!cancelled) {
            setForm(null);
            setError(
              "No Record of Supply / Clinic Notes form is assigned to this service (via Form Assignments)."
            );
          }
          return;
        }

        // 3) Fetch forms and pick assigned
        const res = await getClinicFormsApi();
        const forms: ClinicForm[] = Array.isArray(res)
          ? res
          : (res?.data as ClinicForm[]) || [];

        const assignedForm =
          forms.find((f: any) => extractId(f?._id) === assignedFormId) || null;

        if (!assignedForm) {
          if (!cancelled) {
            setForm(null);
            setError(
              "Assigned Record of Supply / Clinic Notes form not found (or deleted)."
            );
          }
          return;
        }

        // 4) Restore LocalStorage (stored as { label: value })
        let initialFields: FieldsState = {};
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                initialFields = parsed.fields || {};
              }
            } catch {
              // ignore
            }
          }
        }

        // 5) Normalize fields to current schema keys (label-first)
        const editableTypes = ["text", "textarea", "date", "number"];
        const fieldsToRender =
          (assignedForm.schema || []).filter((f: any) =>
            editableTypes.includes(f.type)
          ) || [];

        const allowedKeys = new Set(
          fieldsToRender.map(
            (f: any, idx: number) =>
              f?.data?.label || f?.data?.key || `field_${idx}`
          )
        );

        const normalized: FieldsState = {};
        for (const k of Object.keys(initialFields || {})) {
          if (allowedKeys.has(k)) normalized[k] = String(initialFields[k] ?? "");
        }

        if (!cancelled) {
          setForm(assignedForm);
          setFields(normalized);
        }
      } catch (e: any) {
        if (!cancelled) {
          setForm(null);
          setError(e?.message || "Failed to load Record of Supply form");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHydrated(true);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [serviceId, storageKey]);

  // Persist to LS as { label: value } pairs
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    const payload = { fields };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [fields, storageKey, hydrated]);

  function handleFieldChange(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-neutral-300 text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading clinic notes form…
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
        {error || "Clinic notes form not available for this service."}
      </div>
    );
  }

  const editableTypes = ["text", "textarea", "date", "number"];
  const fieldsToRender =
    (form.schema || []).filter((f: any) => editableTypes.includes(f.type)) || [];

  if (!fieldsToRender.length) {
    return (
      <div className="text-xs text-neutral-400">
        No editable fields found in this Record of Supply / Clinic Notes form.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
      <p className="text-xs text-neutral-500">
        Form:{" "}
        <span className="font-medium text-neutral-200">{form.name}</span> – use
        this to record supply details and clinical notes.
      </p>

      {fieldsToRender.map((field: any, idx: number) => {
        // React key
        const reactKey = field.data?.key || field.data?.label || `field_${idx}`;

        // Storage key: prefer LABEL so localStorage is { label: value }
        const storageFieldKey =
          field.data?.label || field.data?.key || `field_${idx}`;

        const label = field.data?.label || `Field ${idx + 1}`;
        const value = fields[storageFieldKey] || "";

        const commonProps = {
          value,
          onChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
          ) => handleFieldChange(storageFieldKey, e.target.value),
          className:
            "w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500",
          placeholder: label,
        };

        return (
          <div key={reactKey} className="space-y-1">
            <p className="text-xs font-medium text-neutral-200">{label}</p>

            {field.type === "textarea" ? (
              <textarea
                {...(commonProps as any)}
                className={commonProps.className + " min-h-[60px] resize-y"}
              />
            ) : (
              <input
                {...(commonProps as any)}
                type={field.type === "number" ? "number" : field.type}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
