"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  type OrderDto,
  type ClinicForm,
  getClinicFormByIdApi,
} from "../../../../api";
import { Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "radio"
  | "date"
  | "file"
  | "static-text"
  | "divider"
  | "image"
  | "page-break";

type VisibilityCond = {
  field: string;
  equals?: any;
  in?: any[];
  notEquals?: any;
  truthy?: boolean;
};

type Question = {
  id: string;
  key?: string;

  label: string;
  helpText?: string;
  type: QuestionType;

  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  multiple?: boolean;
  htmlInputType?: string;

  isLayoutOnly?: boolean;
  contentHtml?: string;
  imageUrl?: string;

  sectionKey?: string;
  sectionTitle?: string;
  showIf?: VisibilityCond;
};

type RiskAnswer = {
  key: string;
  question: string;
  value: any;
};

interface Props {
  order: OrderDto;
}

/* ------------------------------------------------------------------ */
/* Helpers (adapted from RafStep)                                     */
/* ------------------------------------------------------------------ */

const slugify = (s: string) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function extractShowIf(input: any): VisibilityCond | undefined {
  const cand =
    input?.showIf ??
    input?.visibleIf ??
    input?.when ??
    input?.condition ??
    input?.dependency ??
    input?.dependsOn ??
    input?.data?.showIf ??
    input?.data?.visibleIf ??
    input?.data?.when ??
    input?.data?.condition;

  if (!cand || typeof cand !== "object") return undefined;

  if (
    cand.enabled === false ||
    cand.enabled === "false" ||
    cand.enabled === 0
  ) {
    return undefined;
  }

  const field =
    cand.field ??
    cand.id ??
    cand.key ??
    cand.question ??
    cand.source ??
    cand.on ??
    cand.dependsOn ??
    cand.dependency;

  if (!field || typeof field !== "string") return undefined;

  const equals = cand.equals ?? cand.equal ?? cand.value ?? cand.is;
  const inList = cand.in ?? cand.oneOf;
  const notEquals = cand.notEquals ?? cand.not;
  const truthy = cand.truthy ?? cand.whenTrue ?? undefined;

  const out: VisibilityCond = { field: String(field) };
  if (equals !== undefined) out.equals = equals;
  if (notEquals !== undefined) out.notEquals = notEquals;
  if (inList !== undefined)
    out.in = Array.isArray(inList) ? inList : [inList];
  if (truthy !== undefined) out.truthy = !!truthy;

  return out;
}

function mapFieldType(
  rawType: string,
  wantsMulti: boolean,
  input: any
): {
  mappedType: QuestionType;
  htmlInputType?: string;
  isLayoutOnly?: boolean;
  contentHtml?: string;
  imageUrl?: string;
} {
  const t = rawType.toLowerCase();
  let htmlInputType: string | undefined;
  let isLayoutOnly = false;
  let contentHtml: string | undefined;
  let imageUrl: string | undefined;

  let mapped: QuestionType;

  switch (t) {
    case "divider":
      mapped = "divider";
      isLayoutOnly = true;
      break;

    case "image":
      mapped = "image";
      isLayoutOnly = true;
      imageUrl =
        input?.data?.url ??
        input?.data?.src ??
        input?.data?.imageUrl ??
        input?.url ??
        "";
      break;

    case "text_block":
    case "text-block":
    case "content":
    case "html":
    case "richtext":
      mapped = "static-text";
      isLayoutOnly = true;
      contentHtml =
        input?.data?.content ??
        input?.data?.html ??
        input?.data?.text ??
        input?.content ??
        "";
      break;

    case "page_break":
    case "page-break":
    case "pagebreak":
      mapped = "page-break";
      isLayoutOnly = true;
      break;

    case "boolean":
    case "yesno":
      mapped = "boolean";
      break;

    case "textarea":
    case "text_area":
      mapped = "textarea";
      break;

    case "number":
    case "numeric":
      mapped = "number";
      htmlInputType = "number";
      break;

    case "date":
    case "datepicker":
      mapped = "date";
      htmlInputType = "date";
      break;

    case "multiselect":
    case "multi_select":
    case "checkboxes":
    case "checkbox_group":
    case "checkbox-group":
      mapped = "multiselect";
      break;

    case "select":
    case "dropdown":
      mapped = wantsMulti ? "multiselect" : "select";
      break;

    case "radio":
      mapped = wantsMulti ? "multiselect" : "radio";
      break;

    case "file":
    case "file_upload":
    case "file-upload":
      mapped = "file";
      break;

    case "email":
      mapped = "text";
      htmlInputType = "email";
      break;

    case "signature":
      mapped = "text";
      htmlInputType = "text";
      break;

    default:
      mapped = "text";
      break;
  }

  const dataInputType = input?.data?.inputType;
  if (
    mapped === "text" &&
    !htmlInputType &&
    typeof dataInputType === "string"
  ) {
    if (dataInputType === "email") htmlInputType = "email";
    else if (dataInputType === "number") htmlInputType = "number";
    else htmlInputType = dataInputType;
  }

  return {
    mappedType: mapped,
    htmlInputType,
    isLayoutOnly,
    contentHtml,
    imageUrl,
  };
}

function toQuestionArray(input: any): Question[] {
  if (!input) return [];

  if (typeof input === "string") {
    try {
      return toQuestionArray(JSON.parse(input));
    } catch {
      return [];
    }
  }

  // wrapper object { schema: [...] } etc.
  if (!Array.isArray(input) && typeof input === "object") {
    const maybe =
      (input as any).schema ??
      (input as any).raf_schema ??
      (input as any).questions ??
      (input as any).fields ??
      (input as any).form?.schema;
    return toQuestionArray(maybe);
  }

  if (Array.isArray(input)) {
    const items: Question[] = [];
    let curSectionKey: string | undefined;
    let curSectionTitle: string | undefined;

    input.forEach((x: any, i: number) => {
      if (!x || typeof x !== "object") return;

      const t = String(x.type ?? x.data?.type ?? "").toLowerCase();

      // Section
      if (t === "section") {
        const title = String(
          x.label ?? x.data?.label ?? x.title ?? "Section"
        );
        curSectionTitle = title;
        curSectionKey = String(
          x.key ?? x.data?.key ?? slugify(title)
        );
        return;
      }

      const rawType = String(x.type ?? x.data?.type ?? "").toLowerCase();
      const wantsMulti = Boolean(x.multiple ?? x.data?.multiple);

      const { mappedType, htmlInputType, isLayoutOnly, contentHtml, imageUrl } =
        mapFieldType(rawType, wantsMulti, x);

      const options = Array.isArray(x.options)
        ? x.options.map((o: any) =>
            typeof o === "string"
              ? { value: o, label: o }
              : {
                  value: String(o.value ?? o.id ?? o),
                  label: String(o.label ?? o.name ?? o),
                }
          )
        : Array.isArray(x.data?.options)
        ? x.data.options.map((o: any) =>
            typeof o === "string"
              ? { value: o, label: o }
              : {
                  value: String(o.value ?? o.id ?? o),
                  label: String(o.label ?? o.name ?? o),
                }
          )
        : undefined;

      const label =
        x.label ??
        x.title ??
        x.name ??
        x.data?.label ??
        (mappedType === "static-text" ? "" : `Question ${i + 1}`);

      const keyFromData =
        (x.data?.key ??
        x.key ??
        x.id ??
        slugify(label)) ||
        `q_${i}`;

      const id = String(keyFromData);

      const sKey = String(x.section ?? x.data?.section ?? curSectionKey ?? "");
      const sTitle = String(
        x.sectionTitle ??
          x.data?.sectionTitle ??
          curSectionTitle ??
          (sKey ? "Section" : "")
      );

      items.push({
        id,
        key: id,
        label: String(label),
        helpText: x.helpText ?? x.help ?? x.data?.help ?? undefined,
        type: mappedType,
        required: isLayoutOnly
          ? false
          : Boolean(x.required ?? x.data?.required),
        placeholder: x.placeholder ?? x.data?.placeholder ?? undefined,
        min: typeof x.min === "number" ? x.min : undefined,
        max: typeof x.max === "number" ? x.max : undefined,
        options,
        multiple: Boolean(x.multiple ?? x.data?.multiple),
        htmlInputType,
        isLayoutOnly,
        contentHtml,
        imageUrl,
        sectionKey: sKey || undefined,
        sectionTitle: sTitle || undefined,
        showIf: extractShowIf(x),
      });
    });

    return items;
  }

  return [];
}

function looseEqual(a: any, b: any): boolean {
  const norm = (v: any) => {
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["yes", "true", "y", "1"].includes(s)) return true;
      if (["no", "false", "n", "0"].includes(s)) return false;
      return s;
    }
    if (typeof v === "boolean") return v;
    return v;
  };

  const va = norm(a);
  const vb = norm(b);

  if (typeof va === "boolean" || typeof vb === "boolean") {
    return Boolean(va) === Boolean(vb);
  }

  return va === vb;
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function RiskAssessmentTab({ order }: Props) {
  const [form, setForm] = useState<ClinicForm | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qaList, setQaList] = useState<RiskAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const storageKey = `consultation_${order._id}_risk`;

  // Load RAF QA from order + localStorage overrides + schema
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const metaAny: any = order.meta || {};
        const rafBlock = metaAny.formsQA?.raf || {};
        const qaArray: any[] = Array.isArray(rafBlock.qa) ? rafBlock.qa : [];
        const formId =
          rafBlock.form_id || rafBlock.formId || rafBlock.formID || null;

        // 1) Base answers from order.meta.formsQA.raf.qa
        const baseAnswers: RiskAnswer[] = qaArray.map((qa: any) => {
          const key = qa.key || qa.field || qa.id;
          const question = qa.question || key || "";
          let value: any;
          if (Array.isArray(qa.raw)) value = qa.raw;
          else if (qa.raw !== undefined && qa.raw !== null) value = qa.raw;
          else value = qa.answer ?? "";

          return {
            key: String(key),
            question: String(question),
            value,
          };
        });

        // 2) Overrides from localStorage (pharmacist edits)
        let stored: RiskAnswer[] | null = null;
        if (typeof window !== "undefined") {
          const rawLs = window.localStorage.getItem(storageKey);
          if (rawLs) {
            try {
              const parsed = JSON.parse(rawLs);
              if (Array.isArray(parsed)) stored = parsed as RiskAnswer[];
            } catch {
              stored = null;
            }
          }
        }

        const mergedMap = new Map<string, RiskAnswer>();
        baseAnswers.forEach((r) => {
          if (!r.key) return;
          mergedMap.set(r.key, r);
        });
        if (stored) {
          stored.forEach((r) => {
            if (!r || !r.key) return;
            mergedMap.set(r.key, r);
          });
        }

        const mergedList = Array.from(mergedMap.values());

        if (!cancelled) {
          setQaList(mergedList);
        }

        // 3) Load schema (clinic form) if we have formId
        if (formId) {
          try {
            const f = await getClinicFormByIdApi(String(formId));
            if (cancelled) return;
            setForm(f);

            const schemaSource = (f as any).raf_schema ?? (f as any).schema;
            const qs = toQuestionArray(schemaSource);
            if (!cancelled) setQuestions(qs);
          } catch (err: any) {
            console.error("Failed to fetch RAF clinic form", err);
            if (!cancelled) {
              setError(
                err?.message || "Failed to load risk assessment form schema."
              );
            }
          }
        } else if (!qaArray.length) {
          if (!cancelled) {
            setError("No RAF form or answers found for this order.");
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load RAF data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [order._id, order.meta, storageKey]);

  // Persist qaList to localStorage for End Consultation
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(qaList));
  }, [qaList, storageKey]);

  function setValueForKey(key: string, questionLabel: string, value: any) {
    setQaList((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) {
        return [...prev, { key, question: questionLabel || key, value }];
      }
      const clone = [...prev];
      clone[idx] = { ...clone[idx], question: questionLabel || key, value };
      return clone;
    });
  }

  // Map: key -> RiskAnswer
  const qaByKey = useMemo(() => {
    const m = new Map<string, RiskAnswer>();
    qaList.forEach((r) => {
      if (r.key) m.set(r.key, r);
    });
    return m;
  }, [qaList]);

  // Determine if we have schema-driven questions
  const hasSchema = questions.length > 0;

  // Visible questions (only if schema exists)
  const visibleQuestions = useMemo(() => {
    if (!hasSchema) return [] as Question[];

    return questions.filter((q) => {
      const c = q.showIf;
      if (!c) return true;

      const ans = qaByKey.get(c.field);
      const rawVal = ans?.value;

      if (c.truthy) {
        if (Array.isArray(rawVal)) return rawVal.length > 0;
        return !!rawVal;
      }

      const values: any[] = Array.isArray(rawVal) ? rawVal : [rawVal];

      if (c.in && c.in.length > 0) {
        return values.some((v) =>
          c.in!.some((item) => looseEqual(v, item))
        );
      }

      if (c.equals !== undefined) {
        return values.some((v) => looseEqual(v, c.equals));
      }

      if (c.notEquals !== undefined) {
        return !values.some((v) => looseEqual(v, c.notEquals));
      }

      if (Array.isArray(rawVal)) return rawVal.length > 0;
      return !!rawVal;
    });
  }, [hasSchema, questions, qaByKey]);

  const hasSchemaRealQuestions = useMemo(
    () =>
      visibleQuestions.some(
        (q) =>
          !q.isLayoutOnly &&
          ["text", "textarea", "number", "boolean", "select", "multiselect", "radio", "date", "file"].includes(
            q.type
          )
      ),
    [visibleQuestions]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-neutral-300 text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading risk assessment…
      </div>
    );
  }

  // 1) Schema mode (full dynamic renderer)
  if (hasSchema && hasSchemaRealQuestions) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        {form && (
          <p className="text-xs text-neutral-500">
            Form:{" "}
            <span className="font-medium text-neutral-200">{form.name}</span>
            {form.description && (
              <>
                {" "}
                – <span className="text-neutral-400">{form.description}</span>
              </>
            )}
          </p>
        )}

        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {visibleQuestions.map((q, idx) => {
            const fieldKey = q.key || q.id;
            const ans = fieldKey ? qaByKey.get(fieldKey) : undefined;
            const existingVal = ans?.value;

            return (
              <QuestionRow
                key={fieldKey || idx}
                question={q}
                value={existingVal}
                onChange={(val) =>
                  setValueForKey(fieldKey || `q_${idx}`, q.label, val)
                }
              />
            );
          })}
        </div>
      </div>
    );
  }

  // 2) Fallback: no schema, but we DO have QA -> simple list with textareas
  if (qaList.length > 0) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        <p className="text-xs text-neutral-500">
          Showing saved RAF answers from this order. Schema for this form was
          not available, so questions are rendered in a simple list.
        </p>

        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {qaList.map((qa, idx) => {
            const displayValue = Array.isArray(qa.value)
              ? qa.value.join(", ")
              : qa.value ?? "";

            return (
              <div
                key={qa.key || idx}
                className="border border-neutral-800 rounded-lg bg-neutral-900/80 px-3 py-2"
              >
                <p className="text-xs font-medium text-neutral-200 mb-1">
                  {idx + 1}. {qa.question || qa.key}
                </p>
                <textarea
                  value={displayValue}
                  onChange={(e) =>
                    setValueForKey(
                      qa.key,
                      qa.question,
                      e.target.value
                    )
                  }
                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 resize-y min-h-[60px]"
                  placeholder="Answer…"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3) No schema and no QA at all
  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      )}
      <div className="text-xs text-neutral-400">
        No RAF questions/answers found for this order.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Question row renderer (dark UI, like RafStep but read/write)       */
/* ------------------------------------------------------------------ */

function QuestionRow({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (val: any) => void;
}) {
  const q = question;
  const baseInput =
    "w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500";

  // Layout-only
  if (q.type === "divider") {
    return (
      <div className="py-2">
        <div className="border-t border-dashed border-neutral-700" />
      </div>
    );
  }

  if (q.type === "static-text") {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2">
        {q.label && (
          <p className="mb-1 text-xs font-semibold text-neutral-100">
            {q.label}
          </p>
        )}
        {q.contentHtml ? (
          <div
            className="text-[11px] leading-relaxed text-neutral-200"
            dangerouslySetInnerHTML={{ __html: q.contentHtml }}
          />
        ) : q.helpText ? (
          <p className="text-[11px] text-neutral-400">{q.helpText}</p>
        ) : null}
      </div>
    );
  }

  if (q.type === "image") {
    const src = q.imageUrl || "";
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2">
        {q.label && (
          <p className="mb-2 text-xs font-semibold text-neutral-100">
            {q.label}
          </p>
        )}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={q.label || "Image"}
            className="max-h-64 w-auto rounded-md border border-neutral-800 object-contain"
          />
        ) : (
          <p className="text-[11px] text-neutral-500">
            No image configured for this block.
          </p>
        )}
        {q.helpText && (
          <p className="mt-1 text-[11px] text-neutral-400">{q.helpText}</p>
        )}
      </div>
    );
  }

  if (q.type === "page-break") {
    return (
      <div className="py-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          <span className="flex-1 border-t border-dashed border-neutral-700" />
          <span>Page break</span>
          <span className="flex-1 border-t border-dashed border-neutral-700" />
        </div>
      </div>
    );
  }

  const toBool = (v: any): boolean | null => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["yes", "true", "y", "1"].includes(s)) return true;
      if (["no", "false", "n", "0"].includes(s)) return false;
    }
    return null;
  };

  // Normalise for multi-select
  const toArray = (v: any): string[] => {
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (typeof v === "string") {
      return v
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [];
  };

  // Answerable
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2">
      <label className="mb-1 block text-xs font-medium text-neutral-100">
        {q.label}{" "}
        {q.required && <span className="text-rose-400 font-semibold">*</span>}
      </label>
      {q.helpText && (
        <p className="mb-2 text-[11px] text-neutral-400">{q.helpText}</p>
      )}

      {/* TEXT */}
      {q.type === "text" && (
        <input
          type={q.htmlInputType || "text"}
          className={baseInput}
          placeholder={q.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {/* TEXTAREA */}
      {q.type === "textarea" && (
        <textarea
          className={baseInput + " min-h-[60px] resize-y"}
          placeholder={q.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {/* NUMBER */}
      {q.type === "number" && (
        <input
          type="number"
          className={baseInput}
          placeholder={q.placeholder}
          min={q.min}
          max={q.max}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              e.target.value === "" ? "" : Number(e.target.value)
            )
          }
        />
      )}

      {/* BOOLEAN */}
      {q.type === "boolean" && (
        <div className="inline-flex gap-2 rounded-full bg-neutral-950/80 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`rounded-full px-3 py-1 font-medium ${
              toBool(value) === true
                ? "bg-emerald-500 text-black"
                : "text-neutral-200"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`rounded-full px-3 py-1 font-medium ${
              toBool(value) === false
                ? "bg-emerald-500 text-black"
                : "text-neutral-200"
            }`}
          >
            No
          </button>
        </div>
      )}

      {/* SELECT */}
      {q.type === "select" && (
        <select
          className={baseInput}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {q.placeholder || "Please select"}
          </option>
          {(q.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {/* RADIO */}
      {q.type === "radio" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.options || []).map((opt) => {
            const checked = String(value ?? "") === String(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  checked
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-neutral-700 bg-neutral-950/60"
                }`}
              >
                <input
                  type="radio"
                  className="h-3 w-3 border-neutral-500 text-emerald-500"
                  checked={checked}
                  onChange={() => onChange(opt.value)}
                />
                <span className="text-neutral-100">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* MULTISELECT */}
      {q.type === "multiselect" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.options || []).map((opt) => {
            const arr = toArray(value);
            const checked = arr.includes(String(opt.value));
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  checked
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-neutral-700 bg-neutral-950/60"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-neutral-500 text-emerald-500"
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(arr);
                    if (e.target.checked) next.add(String(opt.value));
                    else next.delete(String(opt.value));
                    onChange(Array.from(next));
                  }}
                />
                <span className="text-neutral-100">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* DATE */}
      {q.type === "date" && (
        <input
          type="date"
          className={baseInput}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {/* FILE (read-only) */}
      {q.type === "file" && (
        <div className="text-[11px] text-neutral-400">
          File uploads are not editable from this view. Existing answer:
          <pre className="mt-1 rounded bg-neutral-950/80 px-2 py-1 text-[10px] text-neutral-300 overflow-x-auto">
            {value
              ? JSON.stringify(value, null, 2)
              : "No file uploaded"}
          </pre>
        </div>
      )}
    </div>
  );
}
