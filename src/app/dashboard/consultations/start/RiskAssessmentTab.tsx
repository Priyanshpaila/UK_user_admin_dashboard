"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  type OrderDto,
  type ClinicForm,
  getClinicFormByIdApi,
  getBackendBase,
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

  /**
   * IMPORTANT:
   * - For normal fields: value is raw/string/boolean/etc.
   * - For file fields: value MUST remain the structured raw (array/object with url)
   *   so we can render images/attachments reliably and avoid "[Object Object]".
   */
  value: any;
};

type NormalizedFile = {
  url: string;
  name: string;
  type?: string;
};

interface Props {
  order: OrderDto;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const slugify = (s: string) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * Prefer schema type, but keep this for fallback mode when schema isn't available.
 * RAF keys in DB look like: textarea_qo8bnjr, radio_0x7slnb, date_8kxlfwy, file_hhmtpex ...
 * We must read only before "_" to get the field type.
 */
function getFieldTypeFromRafKey(key: string): QuestionType {
  const raw = String(key || "").trim().toLowerCase();
  const i = raw.indexOf("_");
  const prefix = (i === -1 ? raw : raw.slice(0, i)).trim();

  switch (prefix) {
    case "text":
      return "text";
    case "textarea":
      return "textarea";
    case "number":
      return "number";
    case "boolean":
    case "yesno":
      return "boolean";
    case "select":
    case "dropdown":
      return "select";
    case "multiselect":
    case "multi":
    case "checkboxes":
    case "checkbox":
      return "multiselect";
    case "radio":
      return "radio";
    case "date":
    case "datepicker":
      return "date";
    case "file":
    case "upload":
      return "file";
    default:
      return "text";
  }
}

function resolveFileUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const baseWithApi = getBackendBase(); // e.g. https://tenant.domain.com/api
  const cleanBase = baseWithApi.replace(/\/api\/?$/, ""); // → https://tenant.domain.com
  return `${cleanBase}${normalized}`;
}

function isFileLikeValue(value: any): boolean {
  if (!value) return false;

  const arr = Array.isArray(value) ? value : [value];

  return arr.some((item) => {
    if (!item) return false;
    if (typeof item !== "object") return false;
    return Boolean(
      item.url ||
        item.path ||
        item.location ||
        item.href ||
        item.downloadUrl ||
        item.src
    );
  });
}

/** Turn any stored value (string/object/array) into a list of file descriptors. */
function normalizeFilesValue(value: any): NormalizedFile[] {
  if (!value) return [];

  // If someone accidentally stored { raw: [...] } wrap, unwrap it safely
  const unwrapped =
    value && typeof value === "object" && Array.isArray((value as any).raw)
      ? (value as any).raw
      : value;

  const arr: any[] = Array.isArray(unwrapped) ? unwrapped : [unwrapped];

  return arr
    .map((item, idx): NormalizedFile | null => {
      if (!item) return null;

      if (typeof item === "string") {
        // could be "/upload/..." or a full URL
        return { url: item, name: `File ${idx + 1}` };
      }

      if (typeof item === "object") {
        const url =
          item.url ||
          item.path ||
          item.location ||
          item.href ||
          item.downloadUrl ||
          item.src ||
          "";
        const name =
          item.name ||
          item.filename ||
          item.originalname ||
          item.originalName ||
          `File ${idx + 1}`;
        const type = item.type || item.mimetype || item.mimeType || "";
        if (!url && !name) return null;
        return { url, name, type };
      }

      return null;
    })
    .filter((x): x is NormalizedFile => !!x);
}

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
    case "checkbox":
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
        curSectionKey = String(x.key ?? x.data?.key ?? slugify(title));
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
        (x.data?.key ?? x.key ?? x.id ?? slugify(label)) || `q_${i}`;

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

function coerceInitialValueForType(type: QuestionType, v: any) {
  if (v === undefined || v === null) return type === "multiselect" ? [] : "";

  if (type === "multiselect") {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      // you store "a, b, c" in answer but raw array in raw sometimes
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  if (type === "boolean") {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["yes", "true", "y", "1"].includes(s)) return true;
      if (["no", "false", "n", "0"].includes(s)) return false;
    }
    return "";
  }

  if (type === "number") {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))
      return Number(v);
    return "";
  }

  if (type === "file") {
    // keep structured as-is
    return v;
  }

  // text/textarea/date/select/radio -> string
  return typeof v === "string" ? v : String(v ?? "");
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
  const [hydrated, setHydrated] = useState(false);

  const storageKey = `consultation_${order._id}_risk`;

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

        // 1) Base answers from DB (IMPORTANT: prefer qa.raw always when present)
        const baseAnswers: RiskAnswer[] = qaArray
          .map((qa: any) => {
            const key = qa.key || qa.field || qa.id;
            if (!key) return null;

            const question = qa.question || String(key) || "";

            // Prefer raw when available; file uploads live here as structured objects.
            const hasRaw = qa.raw !== undefined && qa.raw !== null;
            const value = hasRaw ? qa.raw : qa.answer ?? "";

            return {
              key: String(key),
              question: String(question),
              value,
            } as RiskAnswer;
          })
          .filter((x): x is RiskAnswer => !!x);

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

        // Merge answers:
        // - Base answers first
        // - Stored overrides second, BUT never allow a file answer to be overwritten by a string
        const mergedMap = new Map<string, RiskAnswer>();
        baseAnswers.forEach((r) => mergedMap.set(r.key, r));

        if (stored) {
          stored.forEach((r) => {
            if (!r || !r.key) return;

            const existing = mergedMap.get(r.key);

            // If existing is file-like (raw upload objects), do NOT overwrite it with a string
            if (
              existing &&
              isFileLikeValue(existing.value) &&
              !isFileLikeValue(r.value)
            ) {
              return;
            }

            mergedMap.set(r.key, r);
          });
        }

        const mergedList = Array.from(mergedMap.values());
        if (!cancelled) setQaList(mergedList);

        // 3) Load schema (clinic form) if we have formId
        if (formId) {
          try {
            const f = await getClinicFormByIdApi(String(formId));
            if (cancelled) return;

            setForm(f);

            // ✅ IMPORTANT: your form stores real schema in `schema` (raf_schema is empty in your example)
            const schemaSource = (f as any).schema ?? (f as any).raf_schema;
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
          if (!cancelled)
            setError("No RAF form or answers found for this order.");
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load RAF data.");
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
  }, [order._id, order.meta, storageKey]);

  // Persist qaList to localStorage (IMPORTANT: we keep file values structured)
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(qaList));
  }, [qaList, storageKey, hydrated]);

  function setValueForKey(key: string, questionLabel: string, nextValue: any) {
    setQaList((prev) => {
      const idx = prev.findIndex((r) => r.key === key);

      // If the previous value is file-like, never replace it with a non-file value.
      if (idx !== -1) {
        const prevVal = prev[idx]?.value;
        if (isFileLikeValue(prevVal) && !isFileLikeValue(nextValue)) {
          return prev;
        }
      }

      if (idx === -1) {
        return [
          ...prev,
          { key, question: questionLabel || key, value: nextValue },
        ];
      }

      const clone = [...prev];
      clone[idx] = {
        ...clone[idx],
        question: questionLabel || key,
        value: nextValue,
      };
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

  const hasSchema = questions.length > 0;

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
        return values.some((v) => c.in!.some((item) => looseEqual(v, item)));
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
          [
            "text",
            "textarea",
            "number",
            "boolean",
            "select",
            "multiselect",
            "radio",
            "date",
            "file",
          ].includes(q.type)
      ),
    [visibleQuestions]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-neutral-300 text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading risk assessment…
      </div>
    );
  }

  // ✅ SCHEMA MODE: render EXACTLY according to schema types/options + populate answers
  if (hasSchema && hasSchemaRealQuestions) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        {form && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <p className="text-sm text-neutral-200 font-medium">{form.name}</p>
            {form.description && (
              <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                {form.description}
              </p>
            )}
          </div>
        )}

        <div className="max-h-[560px] overflow-y-auto pr-2 space-y-3">
          {visibleQuestions.map((q, idx) => {
            const fieldKey = q.key || q.id;

            // answers are stored by key in order.meta.formsQA.raf.qa[].key
            const ans = fieldKey ? qaByKey.get(fieldKey) : undefined;

            // populate value with minimal coercion per schema type
            const existingVal = coerceInitialValueForType(q.type, ans?.value);

            // Section header (whenever it changes)
            const prev = visibleQuestions[idx - 1];
            const showSection =
              q.sectionTitle && (!prev || prev.sectionTitle !== q.sectionTitle);

            return (
              <React.Fragment key={fieldKey || idx}>
                {showSection && (
                  <div className="pt-2">
                    <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-neutral-950/60 backdrop-blur">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-400" />
                        <h4 className="text-sm font-semibold text-neutral-100">
                          {q.sectionTitle}
                        </h4>
                      </div>
                    </div>
                  </div>
                )}

                <QuestionRow
                  question={q}
                  value={existingVal}
                  onChange={(val) =>
                    setValueForKey(fieldKey || `q_${idx}`, q.label, val)
                  }
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback: no schema, but QA exists
  if (qaList.length > 0) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3">
          <p className="text-sm text-neutral-200 font-medium">Saved RAF answers</p>
          <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
            Schema for this form wasn’t available, so answers are shown in a simplified view.
            File uploads are rendered from{" "}
            <span className="text-neutral-200">raw</span> data and are not editable here.
          </p>
        </div>

        <div className="max-h-[560px] overflow-y-auto pr-2 space-y-3">
          {qaList.map((qa, idx) => {
            const isFile = isFileLikeValue(qa.value);
            const inferredType = getFieldTypeFromRafKey(qa.key);

            return (
              <div
                key={qa.key || idx}
                className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3"
              >
                <p className="text-sm font-medium text-neutral-100">
                  {idx + 1}. {qa.question || qa.key}
                </p>

                <div className="mt-2">
                  {isFile || inferredType === "file" ? (
                    <FileAttachments value={qa.value} />
                  ) : (
                    <FallbackEditor
                      type={inferredType}
                      value={qa.value}
                      onChange={(val) =>
                        setValueForKey(qa.key, qa.question, val)
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // No schema and no QA
  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      )}
      <div className="text-sm text-neutral-400">
        No RAF questions/answers found for this order.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fallback Editor (when schema isn't available)                       */
/* ------------------------------------------------------------------ */

function FallbackEditor({
  type,
  value,
  onChange,
}: {
  type: QuestionType;
  value: any;
  onChange: (val: any) => void;
}) {
  const baseInput =
    "w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500";

  const toBool = (v: any): boolean | null => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["yes", "true", "y", "1"].includes(s)) return true;
      if (["no", "false", "n", "0"].includes(s)) return false;
    }
    return null;
  };

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

  if (type === "boolean") {
    const boolVal = toBool(value);
    return (
      <div className="inline-flex gap-2 rounded-full bg-neutral-950/80 p-1 text-sm">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-full px-4 py-1.5 font-medium ${
            boolVal === true ? "bg-emerald-500 text-black" : "text-neutral-200"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-full px-4 py-1.5 font-medium ${
            boolVal === false ? "bg-emerald-500 text-black" : "text-neutral-200"
          }`}
        >
          No
        </button>
      </div>
    );
  }

  if (type === "multiselect") {
    const arr = toArray(value);
    return (
      <textarea
        className={baseInput + " min-h-[80px] resize-y"}
        value={arr.join(", ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          )
        }
        placeholder="Enter values separated by commas…"
      />
    );
  }

  if (type === "number") {
    const v =
      typeof value === "number"
        ? String(value)
        : typeof value === "string"
        ? value
        : "";
    return (
      <input
        type="number"
        className={baseInput}
        value={v}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    );
  }

  if (type === "date") {
    const v = typeof value === "string" ? value : "";
    return (
      <input
        type="date"
        className={baseInput}
        value={v}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (type === "textarea") {
    return (
      <textarea
        className={baseInput + " min-h-[90px] resize-y"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Answer…"
      />
    );
  }

  return (
    <input
      type="text"
      className={baseInput}
      value={typeof value === "string" ? value : value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Answer…"
    />
  );
}

/* ------------------------------------------------------------------ */
/* File Attachments (renders from raw structured data)                 */
/* ------------------------------------------------------------------ */

function FileAttachments({ value }: { value: any }) {
  const files = normalizeFilesValue(value);

  if (!files.length) {
    return <p className="text-sm text-neutral-500">No file uploaded.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-400">
        File uploads are shown from saved raw data (not editable here).
      </p>

      <div className="flex flex-wrap gap-3">
        {files.map((file, i) => {
          const url = resolveFileUrl(file.url);
          if (!url) return null;

          const isImage =
            file.type?.startsWith("image/") ||
            /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || file.url);

          if (isImage) {
            return (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
                title="Open image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={file.name || `Attachment ${i + 1}`}
                  className="h-32 w-48 rounded-lg border border-neutral-800 bg-neutral-950 object-contain group-hover:border-emerald-500"
                />
                <div className="mt-1 max-w-[12rem] truncate text-xs text-neutral-300">
                  {file.name || `Attachment ${i + 1}`}
                </div>
              </a>
            );
          }

          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-500 hover:text-emerald-100"
              title="Open file"
            >
              {file.name || `Attachment ${i + 1}`}
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Question row renderer (schema mode)                                 */
/* Uses schema type/options + populates from qaByKey                   */
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
    "w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500";

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
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3">
        {q.label && (
          <p className="mb-2 text-sm font-semibold text-neutral-100">{q.label}</p>
        )}
        {q.contentHtml ? (
          <div
            className="text-sm leading-relaxed text-neutral-200"
            dangerouslySetInnerHTML={{ __html: q.contentHtml }}
          />
        ) : q.helpText ? (
          <p className="text-sm text-neutral-400">{q.helpText}</p>
        ) : null}
      </div>
    );
  }

  if (q.type === "image") {
    const rawSrc = q.imageUrl || "";
    const src = resolveFileUrl(rawSrc);

    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3">
        {q.label && (
          <p className="mb-2 text-sm font-semibold text-neutral-100">{q.label}</p>
        )}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={q.label || "Image"}
            className="max-h-72 w-auto rounded-lg border border-neutral-800 object-contain bg-neutral-950"
          />
        ) : (
          <p className="text-sm text-neutral-500">No image configured for this block.</p>
        )}
        {q.helpText && <p className="mt-2 text-sm text-neutral-400">{q.helpText}</p>}
      </div>
    );
  }

  if (q.type === "page-break") {
    return (
      <div className="py-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-neutral-500">
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

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3">
      <label className="mb-1 block text-sm font-medium text-neutral-100">
        {q.label}{" "}
        {q.required && <span className="text-rose-400 font-semibold">*</span>}
      </label>

      {q.helpText && (
        <p className="mb-3 text-sm text-neutral-400 leading-relaxed">{q.helpText}</p>
      )}

      {q.type === "text" && (
        <input
          type={q.htmlInputType || "text"}
          className={baseInput}
          placeholder={q.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {q.type === "textarea" && (
        <textarea
          className={baseInput + " min-h-[90px] resize-y"}
          placeholder={q.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {q.type === "number" && (
        <input
          type="number"
          className={baseInput}
          placeholder={q.placeholder}
          min={q.min}
          max={q.max}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
      )}

      {q.type === "boolean" && (
        <div className="inline-flex gap-2 rounded-full bg-neutral-950/80 p-1 text-sm">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`rounded-full px-4 py-1.5 font-medium ${
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
            className={`rounded-full px-4 py-1.5 font-medium ${
              toBool(value) === false
                ? "bg-emerald-500 text-black"
                : "text-neutral-200"
            }`}
          >
            No
          </button>
        </div>
      )}

      {q.type === "select" && (
        <select
          className={baseInput}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{q.placeholder || "Please select"}</option>
          {(q.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {q.type === "radio" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.options || []).map((opt) => {
            const checked = String(value ?? "") === String(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  checked
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-neutral-700 bg-neutral-950/60"
                }`}
              >
                <input
                  type="radio"
                  className="h-4 w-4 border-neutral-500 text-emerald-500"
                  checked={checked}
                  onChange={() => onChange(opt.value)}
                />
                <span className="text-neutral-100">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {q.type === "multiselect" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.options || []).map((opt) => {
            const arr = toArray(value);
            const checked = arr.includes(String(opt.value));
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  checked
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-neutral-700 bg-neutral-950/60"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-500 text-emerald-500"
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

      {q.type === "date" && (
        <input
          type="date"
          className={baseInput}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {/* FILE (read-only, always render from raw structured value) */}
      {q.type === "file" && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-400">
            File uploads are not editable from this view.
          </p>
          <FileAttachments value={value} />
        </div>
      )}
    </div>
  );
}
