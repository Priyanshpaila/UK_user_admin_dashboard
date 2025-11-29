"use client";

import React, { useEffect, useState } from "react";
import {
  getClinicFormsApi,
  type ClinicForm,
} from "../../../../api"; // adjust path if needed
import { Loader2 } from "lucide-react";

type FieldsState = {
  [fieldKey: string]: string;
};

interface Props {
  orderId: string;
  serviceId: string;
}

export default function RecordOfSupplyTab({ orderId, serviceId }: Props) {
  const [form, setForm] = useState<ClinicForm | null>(null);
  const [fields, setFields] = useState<FieldsState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const storageKey = `consultation_${orderId}_record`;

  // Load form + LS
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!serviceId) {
        setError("Missing service id for clinic notes form");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await getClinicFormsApi();
        const forms: ClinicForm[] = Array.isArray(res)
          ? res
          : (res?.data as ClinicForm[]) || [];

        const recordForm =
          forms.find(
            (f) =>
              f.service_id === serviceId &&
              ["clinical_notes", "clinical-notes", "clinical notes"].includes(
                f.form_type || ""
              )
          ) || null;

        if (!recordForm) {
          if (!cancelled) {
            setError(
              "No Record of Supply / Clinic Notes form is configured for this service."
            );
          }
          return;
        }

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

        if (!cancelled) {
          setForm(recordForm);
          setFields(initialFields);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load clinic notes form");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [serviceId, storageKey]);

  // Persist to LS
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = { fields };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [fields, storageKey]);

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
    (form.schema || []).filter((f) =>
      editableTypes.includes(f.type)
    ) || [];

  if (!fieldsToRender.length) {
    return (
      <div className="text-xs text-neutral-400">
        No editable fields found in this Record of Supply / Clinic Notes
        form.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
      <p className="text-xs text-neutral-500">
        Form:{" "}
        <span className="font-medium text-neutral-200">
          {form.name}
        </span>{" "}
        – use this to record supply details and clinical notes.
      </p>

      {fieldsToRender.map((field: any, idx: number) => {
        const key =
          field.data?.key || field.data?.label || `field_${idx}`;
        const label = field.data?.label || `Field ${idx + 1}`;
        const value = fields[key] || "";

        const commonProps = {
          value,
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            handleFieldChange(key, e.target.value),
          className:
            "w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500",
          placeholder: label,
        };

        return (
          <div key={key} className="space-y-1">
            <p className="text-xs font-medium text-neutral-200">
              {label}
            </p>
            {field.type === "textarea" ? (
              <textarea
                {...(commonProps as any)}
                className={
                  commonProps.className +
                  " min-h-[60px] resize-y"
                }
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
