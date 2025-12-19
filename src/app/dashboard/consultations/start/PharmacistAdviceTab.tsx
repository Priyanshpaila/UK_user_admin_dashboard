"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getClinicFormsApi,
  getOrderByIdApi,
  getServiceApi,
  getBackendBase,
  type ClinicForm,
  type OrderDto,
} from "../../../../api";
import { Loader2 } from "lucide-react";

type AdviceState = {
  [fieldKey: string]: string[]; // selected answers (help text) per field
};

interface Props {
  orderId: string;
  serviceId?: string; // can be optional now (we can resolve via order)
}

type OrderNotes = {
  admin: string[];
  consultation: string[];
};

/* ----------------- helpers ----------------- */

function extractId(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v._id || v.$oid || v.id || "");
}

function normalizeType(v: any): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

function parseMaybeJsonObject(val: any): Record<string, any> | null {
  if (!val) return null;

  // already an object map
  if (typeof val === "object" && !Array.isArray(val)) return val as any;

  // JSON string
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
 * Find Pharmacist Advice form id from a Service document's form assignments.
 *
 * Your DB example:
 *  forms_assignment: "{\"raf\":\"...\",\"advice\":\"...\",\"pharmacist_declaration\":\"...\"}"
 *
 * So we:
 *  1) parse forms_assignment if it's JSON string
 *  2) read advice key from that map
 *  3) fallback to other shapes (arrays / other maps)
 */
function pickAdviceFormIdFromService(service: any): string | null {
  if (!service) return null;

  // ✅ 0) Your actual field: forms_assignment (often JSON string)
  const directMapsToTry = [
    service.forms_assignment,
    service.formsAssignment,
    service.forms_assignments,
    service.formsAssignments,
    service.form_assignment, // just in case
    service.form_assignments,
    service?.meta?.forms_assignment,
    service?.meta?.formsAssignment,
    service?.meta?.forms_assignments,
    service?.meta?.formsAssignments,
  ];

  for (const candidate of directMapsToTry) {
    const m = parseMaybeJsonObject(candidate);
    if (!m) continue;

    // keys your system uses
    const keysToTry = [
      "advice",
      "pharmacist_advice",
      "pharmacistAdvice",
      "advice_form",
      "adviceForm",
      "pharmacist_advice_form",
      "pharmacistAdviceForm",
    ];

    for (const k of keysToTry) {
      const id = extractId((m as any)[k]);
      if (id) return id;
    }
  }

  // ✅ 1) Array-based assignment shapes (if you ever store as arrays)
  const want = new Set([
    "advice",
    "pharmacist_advice",
    "pharmacistadvice",
  ]);

  const readRowId = (row: any) =>
    extractId(
      row?.form_id ??
        row?.formId ??
        row?.clinic_form_id ??
        row?.clinicFormId ??
        row?.form ??
        row?.clinic_form ??
        row?.clinicForm ??
        row?._id
    );

  const readRowType = (row: any) =>
    normalizeType(
      row?.form_type ??
        row?.formType ??
        row?.type ??
        row?.key ??
        row?.slug ??
        row?.name ??
        row?.step
    );

  const arrayCandidates = [
    service.form_assignment,
    service.formAssignments,
    service.forms_assignment,
    service.formsAssignments,
    service.form_assignments,
    service.forms_assignments,
    service.assigned_forms,
    service.assignedForms,
    service.clinic_forms,
    service.clinicForms,
    service?.meta?.form_assignments,
    service?.meta?.formAssignments,
    service?.meta?.assigned_forms,
    service?.meta?.assignedForms,
  ];

  for (const arr of arrayCandidates) {
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      const t = readRowType(row);
      const tCompact = t.replace(/_/g, "");
      const isWanted = want.has(t) || want.has(tCompact);
      if (!isWanted) continue;

      const id = readRowId(row);
      if (id) return id;
    }
  }

  // ✅ 2) Other map containers (rare, but keep)
  const mapCandidates = [
    service.forms,
    service.form_map,
    service.formMap,
    service.assigned_forms_map,
    service.assignedFormsMap,
    service?.meta?.forms,
    service?.meta?.form_map,
    service?.meta?.formMap,
  ];

  for (const m of mapCandidates) {
    const mm = parseMaybeJsonObject(m);
    if (!mm) continue;

    const keysToTry = [
      "advice",
      "pharmacist_advice",
      "pharmacistAdvice",
      "advice_form",
      "adviceForm",
      "pharmacist_advice_form",
      "pharmacistAdviceForm",
    ];

    for (const k of keysToTry) {
      const id = extractId((mm as any)[k]);
      if (id) return id;
    }
  }

  return null;
}

/**
 * Fallback slug fetch if you do not have a dedicated api helper.
 * Tries a couple of common backend routes.
 */
async function fetchServiceBySlugFallback(slug: string) {
  const base = getBackendBase();
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("session_token")
      : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const candidates = [
    `${base}/services/slug/${encodeURIComponent(slug)}`,
    `${base}/services/by-slug/${encodeURIComponent(slug)}`,
  ];

  let lastErr: any = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        lastErr = new Error(`Failed (${res.status})`);
        continue;
      }
      const json = await res.json();
      return json?.data ?? json;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Unable to resolve service by slug");
}

/** 👉 Helper to derive the "answer" string for an option.
 * Priority: option.help → field.help → option.label → option.value
 */
function getOptionAnswer(field: any, opt: any, index: number): string {
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
  const [order, setOrder] = useState<OrderDto | null>(null);

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

  const [hydrated, setHydrated] = useState(false);

  const storageKey = useMemo(() => `consultation_${orderId}_advice`, [orderId]);

  /* ------------ Load order once (also sets notes) ------------ */
  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      if (!orderId) {
        if (!cancelled) {
          setOrder(null);
          setOrderNotes({ admin: [], consultation: [] });
          setOrderNotesLoading(false);
        }
        return;
      }

      setOrderNotesLoading(true);

      try {
        const o: OrderDto = await getOrderByIdApi(orderId);
        const meta: any = (o as any).meta || {};

        const normalize = (raw: any): string[] => {
          const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
          return arr
            .map((n) => String(n).trim())
            .filter((n) => n.length > 0);
        };

        const adminRaw =
          (o as any).admin_notes ?? meta.admin_notes ?? meta.adminNotes ?? [];
        const consultationRaw =
          (o as any).consultation_notes ??
          (o as any).consultant_notes ??
          meta.consultation_notes ??
          meta.consultationNotes ??
          meta.consultant_notes ??
          meta.consultantNotes ??
          [];

        if (!cancelled) {
          setOrder(o);
          setOrderNotes({
            admin: normalize(adminRaw),
            consultation: normalize(consultationRaw),
          });
        }
      } catch {
        if (!cancelled) {
          setOrder(null);
          setOrderNotes({ admin: [], consultation: [] });
        }
      } finally {
        if (!cancelled) setOrderNotesLoading(false);
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  /* ------------ Load service → read form assignment → fetch that form → hydrate LS ------------ */
  useEffect(() => {
    let cancelled = false;

    async function loadAssignedAdviceForm() {
      setLoading(true);
      setError(null);
      setHydrated(false);

      try {
        const effectiveServiceId =
          (serviceId && String(serviceId)) ||
          extractId((order as any)?.service_id) ||
          extractId((order as any)?.serviceId);

        const effectiveSlug =
          String((order as any)?.service_slug || "") ||
          String((order as any)?.meta?.service_slug || "");

        if (!effectiveServiceId && !effectiveSlug) {
          if (!cancelled) {
            setForm(null);
            setError("Missing service id/slug to resolve assigned Advice form.");
          }
          return;
        }

        // Fetch service
        let service: any = null;
        if (effectiveServiceId) {
          const sRes: any = await getServiceApi(effectiveServiceId);
          service = sRes?.data ?? sRes;
        } else {
          service = await fetchServiceBySlugFallback(effectiveSlug);
        }

        // ✅ assigned form id from service.forms_assignment JSON string
        let assignedAdviceFormId = pickAdviceFormIdFromService(service);

        // (optional safety fallback) if service has no assignment, fallback to old logic
        // to avoid blocking consultation UI completely
        const res = await getClinicFormsApi();
        const forms: ClinicForm[] = Array.isArray(res)
          ? res
          : (res?.data as ClinicForm[]) || [];

        if (!assignedAdviceFormId) {
          // fallback: match by service_id + form_type
          const fallback =
            forms.find((f: any) => {
              const sid =
                typeof f.service_id === "object" && f.service_id
                  ? f.service_id._id || f.service_id.$oid || ""
                  : f.service_id;

              const type = (f.form_type || "").toLowerCase();
              return (
                sid === effectiveServiceId &&
                (type === "advice" || type === "pharmacist_advice")
              );
            }) || null;

          if (!fallback) {
            if (!cancelled) {
              setForm(null);
              setError(
                "No Pharmacist Advice form is assigned to this service (via Form Assignments)."
              );
            }
            return;
          }

          // if fallback found, use it
          assignedAdviceFormId = extractId((fallback as any)._id);
        }

        const assignedForm =
          forms.find((f: any) => extractId(f?._id) === assignedAdviceFormId) ||
          null;

        if (!assignedForm) {
          if (!cancelled) {
            setForm(null);
            setError("Assigned Pharmacist Advice form not found (or deleted).");
          }
          return;
        }

        // LocalStorage restore
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
              // ignore
            }
          }
        }

        // Normalize state to assigned form's checkbox fields
        const checkboxFields = (assignedForm.schema || []).filter(
          (f: any) => f.type === "checkbox"
        );

        const normalized: AdviceState = {};
        checkboxFields.forEach((field: any, idx: number) => {
          const key = field.data?.key || field.data?.label || `field_${idx}`;
          const prev = (initialState as any)[key];
          normalized[key] = Array.isArray(prev)
            ? prev.filter((v) => typeof v === "string")
            : [];
        });

        if (!cancelled) {
          setForm(assignedForm);
          setAdviceState(normalized);
          setSelectAll(initialSelectAll);
        }
      } catch (e: any) {
        if (!cancelled) {
          setForm(null);
          setError(e?.message || "Failed to load assigned advice form");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHydrated(true);
        }
      }
    }

    loadAssignedAdviceForm();

    return () => {
      cancelled = true;
    };
  }, [order, serviceId, storageKey]);

  // Persist advice selections (answers) to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    const payload = { selectAll, adviceState };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [adviceState, selectAll, storageKey, hydrated]);

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

  function handleSelectAllChange(checked: boolean) {
    setSelectAll(checked);
    if (!form) return;

    const fields = (form.schema || []).filter((f: any) => f.type === "checkbox");

    setAdviceState((prev) => {
      const next: AdviceState = { ...prev };
      fields.forEach((field: any, idx: number) => {
        const key = field.data?.key || field.data?.label || `field_${idx}`;
        const options = field.data?.options || [];
        next[key] = checked
          ? options.map((o: any, i: number) => getOptionAnswer(field, o, i))
          : [];
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
        {(orderNotes.admin.length > 0 ||
          orderNotes.consultation.length > 0 ||
          orderNotesLoading) && (
          <OrderNotesBanner notes={orderNotes} loading={orderNotesLoading} />
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
            <p className="text-[11px] text-neutral-500">{form.description}</p>
          )}
          <p className="text-[11px] text-neutral-500">
            Tick the options that apply. Help text is stored as the answer for
            each ticked option.
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
        <p className="text-xs font-semibold text-neutral-200">Order notes</p>
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
                  <li key={i} className="text-neutral-200 leading-snug">
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
                  <li key={i} className="text-neutral-200 leading-snug">
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
