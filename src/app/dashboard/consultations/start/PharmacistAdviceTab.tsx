"use client";

import React, { useEffect, useState } from "react";
import {
  getClinicFormsApi,
  getOrderByIdApi,
  type ClinicForm,
  type OrderDto,
} from "../../../../api";
import { Loader2 } from "lucide-react";

type AdviceState = {
  [fieldKey: string]: string[]; // selected answers (help text) per field
};

interface Props {
  orderId: string;
  serviceId: string;
}

type OrderNotes = {
  admin: string[];
  consultation: string[];
};

/** 👉 Helper to derive the "answer" string for an option.
 * Priority: option.help → field.help → option.label → option.value
 */
function getOptionAnswer(
  field: any,
  opt: any,
  index: number
): string {
  const optHelp = opt?.help;
  const fieldHelp = field?.data?.help;
  const label = opt?.label;
  const value = opt?.value;

  const base =
    (optHelp && String(optHelp).trim()) ||
    (fieldHelp && String(fieldHelp).trim()) ||
    (label && String(label).trim()) ||
    (value && String(value).trim()) ||
    `Option ${index + 1}`;

  return base;
}

export default function PharmacistAdviceTab({ orderId, serviceId }: Props) {
  const [form, setForm] = useState<ClinicForm | null>(null);
  const [adviceState, setAdviceState] = useState<AdviceState>({});
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderNotes, setOrderNotes] = useState<OrderNotes>({
    admin: [],
    consultation: [],
  });
  const [orderNotesLoading, setOrderNotesLoading] = useState(true);

  const storageKey = `consultation_${orderId}_advice`;

  /* ------------ Load Pharmacist Advice form + LS ------------ */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!serviceId) {
        setError("Missing service id for advice form");
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

        // Handle service_id being either a string or an object (ObjectId-like)
        const adviceForm =
          forms.find((f: any) => {
            const sid =
              typeof f.service_id === "object" && f.service_id
                ? f.service_id._id || f.service_id.$oid || ""
                : f.service_id;

            const type = (f.form_type || "").toLowerCase();

            return (
              sid === serviceId &&
              (type === "advice" || type === "pharmacist_advice")
            );
          }) || null;

        if (!adviceForm) {
          if (!cancelled) {
            setError(
              "No Pharmacist Advice form is configured for this service."
            );
          }
          return;
        }

        // LocalStorage
        let initialState: AdviceState = {};
        let initialSelectAll = false;

        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                initialState = parsed.adviceState || {};
                initialSelectAll = !!parsed.selectAll;
              }
            } catch {
              // ignore parse error
            }
          }
        }

        // If no saved state, init with empty arrays for each checkbox field
        if (!Object.keys(initialState).length) {
          const fields = (adviceForm.schema || []).filter(
            (f: any) => f.type === "checkbox"
          );
          fields.forEach((field: any) => {
            const key = field.data?.key || field.data?.label;
            if (!key) return;
            initialState[key] = [];
          });
        }

        if (!cancelled) {
          setForm(adviceForm);
          setAdviceState(initialState);
          setSelectAll(initialSelectAll);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load advice form");
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

  /* ------------ Load order notes (admin / consultant) ------------ */
  useEffect(() => {
    let cancelled = false;

    async function loadOrderNotes() {
      if (!orderId) {
        setOrderNotesLoading(false);
        return;
      }

      setOrderNotesLoading(true);
      try {
        const order: OrderDto = await getOrderByIdApi(orderId);
        const meta: any = order.meta || {};

        const normalize = (raw: any): string[] => {
          const arr = Array.isArray(raw)
            ? raw
            : raw == null
            ? []
            : [raw];
          return arr
            .map((n) => String(n).trim())
            .filter((n) => n.length > 0);
        };

        const adminRaw =
          (order as any).admin_notes ??
          meta.admin_notes ??
          meta.adminNotes ??
          [];
        const consultationRaw =
          (order as any).consultation_notes ??
          (order as any).consultant_notes ??
          meta.consultation_notes ??
          meta.consultationNotes ??
          meta.consultant_notes ??
          meta.consultantNotes ??
          [];

        if (!cancelled) {
          setOrderNotes({
            admin: normalize(adminRaw),
            consultation: normalize(consultationRaw),
          });
        }
      } catch (e) {
        if (!cancelled) {
          // Fail silently – just no notes
          setOrderNotes({ admin: [], consultation: [] });
        }
      } finally {
        if (!cancelled) setOrderNotesLoading(false);
      }
    }

    loadOrderNotes();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Persist advice selections (answers) to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = { selectAll, adviceState };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [adviceState, selectAll, storageKey]);

  /** 🔁 Toggle a single option: store its help text as the answer */
  function toggleOption(fieldKey: string, answer: string) {
    setAdviceState((prev) => {
      const current = prev[fieldKey] || [];
      const exists = current.includes(answer);
      const next = exists
        ? current.filter((v) => v !== answer)
        : [...current, answer];
      return { ...prev, [fieldKey]: next };
    });
  }

  /** 🔁 Select / clear all options: store their help texts as answers */
  function handleSelectAllChange(checked: boolean) {
    setSelectAll(checked);
    if (!form) return;

    const fields = (form.schema || []).filter(
      (f: any) => f.type === "checkbox"
    );

    setAdviceState((prev) => {
      const next: AdviceState = { ...prev };
      fields.forEach((field: any) => {
        const key = field.data?.key || field.data?.label;
        if (!key) return;
        const options = field.data?.options || [];
        if (checked) {
          next[key] = options.map((o: any, idx: number) =>
            getOptionAnswer(field, o, idx)
          );
        } else {
          next[key] = [];
        }
      });
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-neutral-300 text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading advice form…
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
        {error || "Advice form not available for this service."}
      </div>
    );
  }

  const allFields = form.schema || [];

  const textBlocks = allFields.filter(
    (f: any) => f.type === "text_block" || f.type === "textBlock"
  );

  const checkboxFields = allFields.filter((f: any) => f.type === "checkbox");

  if (!checkboxFields.length) {
    return (
      <div className="space-y-3 text-xs text-neutral-400">
        {/* Notes at top even if no checkbox fields */}
        {(orderNotes.admin.length > 0 ||
          orderNotes.consultation.length > 0 ||
          orderNotesLoading) && (
          <OrderNotesBanner
            notes={orderNotes}
            loading={orderNotesLoading}
          />
        )}

        {textBlocks.length > 0 && (
          <div className="space-y-2">
            {textBlocks.map((field: any, idx: number) => (
              <div
                key={field.data?.key || `text_${idx}`}
                className="border border-neutral-800 rounded-lg bg-neutral-900/80 px-3 py-2"
              >
                {field.data?.label && (
                  <p className="text-xs font-semibold text-neutral-100 mb-1">
                    {field.data.label}
                  </p>
                )}
                {field.data?.content && (
                  <p className="text-[11px] text-neutral-300 whitespace-pre-line">
                    {field.data.content}
                  </p>
                )}
                {field.data?.help && (
                  <p className="mt-1 text-[11px] text-neutral-400 whitespace-pre-line">
                    {field.data.help}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <p>No checkbox fields found in this Pharmacist Advice form.</p>
      </div>
    );
  }

  const hasAnyNotes =
    orderNotes.admin.length > 0 || orderNotes.consultation.length > 0;

  return (
    <div className="space-y-4">
      {/* 🔹 Admin / Consultant notes banner at the top (if present) */}
      {(hasAnyNotes || orderNotesLoading) && (
        <OrderNotesBanner notes={orderNotes} loading={orderNotesLoading} />
      )}

      {/* Header + Select all */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-500">
            Form:{" "}
            <span className="font-medium text-neutral-200">{form.name}</span>
          </p>
          {form.description && (
            <p className="text-[11px] text-neutral-500">
              {form.description}
            </p>
          )}
          <p className="text-[11px] text-neutral-500">
            Tick the options that apply. Use “Select all” for a quick blanket
            selection. Help text is stored as the answer for each ticked option.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-neutral-100">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-neutral-500 bg-neutral-900"
            checked={selectAll}
            onChange={(e) => handleSelectAllChange(e.target.checked)}
          />
          Select all
        </label>
      </div>

      {/* Static text blocks (if any) */}
      {textBlocks.length > 0 && (
        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
          {textBlocks.map((field: any, idx: number) => (
            <div
              key={field.data?.key || `text_${idx}`}
              className="border border-neutral-800 rounded-lg bg-neutral-900/80 px-3 py-2"
            >
              {field.data?.label && (
                <p className="text-xs font-semibold text-neutral-100 mb-1">
                  {field.data.label}
                </p>
              )}
              {field.data?.content && (
                <p className="text-[11px] text-neutral-300 whitespace-pre-line">
                  {field.data.content}
                </p>
              )}
              {field.data?.help && (
                <p className="mt-1 text-[11px] text-neutral-400 whitespace-pre-line">
                  {field.data.help}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Checkbox fields with help */}
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {checkboxFields.map((field: any, idx: number) => {
          const key = field.data?.key || field.data?.label || `field_${idx}`;
          const label = field.data?.label || `Question ${idx + 1}`;
          const options: any[] = field.data?.options || [];
          const selectedAnswers = adviceState[key] || [];

          return (
            <div
              key={key}
              className="border border-neutral-800 rounded-lg bg-neutral-900/80 px-3 py-2"
            >
              <p className="text-xs font-medium text-neutral-200 mb-1">
                {label}
              </p>

              {field.data?.help && (
                <p className="mb-2 text-[11px] text-neutral-400 whitespace-pre-line">
                  {field.data.help}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {options.map((opt, i) => {
                  const answer = getOptionAnswer(field, opt, i);
                  const checked = selectedAnswers.includes(answer);
                  return (
                    <label
                      key={`${key}_${i}`}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-100 bg-neutral-950/40 border border-neutral-700 rounded-full px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-neutral-500 bg-neutral-900"
                        checked={checked}
                        onChange={() => toggleOption(key, answer)}
                      />
                      {opt.label ?? String(opt.value ?? `Option ${i + 1}`)}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------- Small sub-component for notes banner ----------------- */

function OrderNotesBanner({
  notes,
  loading,
}: {
  notes: OrderNotes;
  loading: boolean;
}) {
  const hasAdmin = notes.admin.length > 0;
  const hasConsult = notes.consultation.length > 0;

  if (!loading && !hasAdmin && !hasConsult) return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-neutral-200">
          Order notes
        </p>
        {loading && (
          <span className="flex items-center gap-1 text-[10px] text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </span>
        )}
      </div>

      {!loading && (
        <div className="grid gap-3 md:grid-cols-2 text-[11px]">
          <div>
            <p className="font-semibold text-neutral-400 mb-1">Admin notes</p>
            {hasAdmin ? (
              <ul className="space-y-1">
                {notes.admin.map((n, i) => (
                  <li
                    key={i}
                    className="text-neutral-200 leading-snug"
                  >
                    • {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-neutral-500">No admin notes.</p>
            )}
          </div>

          <div>
            <p className="font-semibold text-neutral-400 mb-1">
              Consultation notes
            </p>
            {hasConsult ? (
              <ul className="space-y-1">
                {notes.consultation.map((n, i) => (
                  <li
                    key={i}
                    className="text-neutral-200 leading-snug"
                  >
                    • {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-neutral-500">No consultation notes.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
