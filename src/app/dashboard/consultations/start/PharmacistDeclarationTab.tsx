"use client";

import React, { useEffect, useState } from "react";
import {
  getClinicFormsApi,
  type ClinicForm,
  getBackendBase,
  getUserByIdApi,
  type UserDto,
} from "../../../../api";
import { Loader2 } from "lucide-react";

interface Props {
  orderId: string;
  serviceId: string;
}

type FieldsState = {
  // ✅ store by LABEL (what you want)
  [fieldLabel: string]: string;
};

type DeclarationStorage = {
  fields: FieldsState;
  signatureUrl?: string | null; // full URL to image
  signaturePath?: string | null; // raw path from backend (/uploads/...png)
  signatureDataUrl?: string | null; // legacy base64 (backward compat)
};

/* ---------------- helpers ---------------- */

const resolveImageUrl = (imagePath: string) => {
  if (!imagePath) return "";

  // already absolute
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;

  // getBackendBase => https://domain/api
  const baseWithApi = getBackendBase();
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");

  return `${cleanBase}${normalizedPath}`;
};

function getLoggedInUserIdFromLocal(): string | null {
  if (typeof window === "undefined") return null;

  const rawUser = window.localStorage.getItem("user");
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser);
      if (parsed && typeof parsed === "object") {
        if (parsed._id) return String(parsed._id);
        if (parsed.id) return String(parsed.id);
        if (parsed.userId) return String(parsed.userId);
      }
    } catch {
      // ignore
    }
  }

  const idKeys = ["user_id", "userId", "pharmacist_id"];
  for (const key of idKeys) {
    const v = window.localStorage.getItem(key);
    if (v) return v;
  }

  return null;
}

function pickPharmacistName(user: UserDto): string {
  const u: any = user;
  return (
    user.name ||
    (user as any).fullName ||
    `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() ||
    u.email ||
    ""
  );
}

/**
 * For backward-compat:
 * If localStorage contains old fields keyed by schema `data.key` (like text_xxx),
 * we migrate into label-keyed fields once on load.
 */
function migrateKeyedFieldsToLabelFields(
  schema: any[],
  stored: FieldsState
): FieldsState {
  if (!stored || typeof stored !== "object") return {};

  const next: FieldsState = { ...stored };

  // map data.key -> label
  const keyToLabel: Record<string, string> = {};
  for (const f of schema || []) {
    const k = String(f?.data?.key || "").trim();
    const l = String(f?.data?.label || "").trim();
    if (k && l) keyToLabel[k] = l;
  }

  // if any old keys exist, migrate them to labels
  let changed = false;
  for (const [k, v] of Object.entries(stored)) {
    // if k looks like old schema key and label exists
    const label = keyToLabel[k];
    if (label && !next[label]) {
      next[label] = String(v ?? "");
      delete next[k];
      changed = true;
    }
  }

  return changed ? next : next;
}

/* ---------------- component ---------------- */

export default function PharmacistDeclarationTab({ orderId, serviceId }: Props) {
  const [form, setForm] = useState<ClinicForm | null>(null);
  const [fields, setFields] = useState<FieldsState>({});
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);

  const storageKey = `consultation_${orderId}_declaration`;

  /* ---------------- Load form + localStorage ---------------- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!serviceId) {
        setError("Missing service id for pharmacist declaration form");
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

        const declarationForm =
          forms.find(
            (f: any) =>
              f.form_type === "pharmacist_declaration" ||
              f.form_type === "pharmacist-declaration"
          ) || null;

        if (!declarationForm) {
          if (!cancelled) {
            setError("No Pharmacist Declaration form is configured for this service.");
          }
          return;
        }

        const schema: any[] = (declarationForm as any).schema || [];

        let initialFields: FieldsState = {};
        let initialSignatureUrl: string | null = null;
        let initialSignaturePath: string | null = null;

        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            try {
              const parsed: DeclarationStorage = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                // ✅ migrate possible old keyed storage into label storage
                initialFields = migrateKeyedFieldsToLabelFields(
                  schema,
                  parsed.fields || {}
                );

                if (parsed.signatureUrl) {
                  initialSignatureUrl = parsed.signatureUrl;
                } else if (parsed.signaturePath) {
                  initialSignaturePath = parsed.signaturePath;
                  initialSignatureUrl = resolveImageUrl(parsed.signaturePath);
                } else if (parsed.signatureDataUrl) {
                  initialSignatureUrl = parsed.signatureDataUrl;
                }
              }
            } catch {
              // ignore parse errors
            }
          }
        }

        if (!cancelled) {
          setForm(declarationForm);
          setFields(initialFields);
          setSignatureUrl(initialSignatureUrl);
          setSignaturePath(initialSignaturePath);

          // persist migrated fields immediately (so old keys disappear)
          if (typeof window !== "undefined") {
            const payload: DeclarationStorage = {
              fields: initialFields,
              signatureUrl: initialSignatureUrl,
              signaturePath: initialSignaturePath,
            };
            window.localStorage.setItem(storageKey, JSON.stringify(payload));
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load declaration form");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [serviceId, storageKey]);

  /* ------------- Load current user (for name, GPhC, signature) ------------- */
  useEffect(() => {
    let cancelled = false;

    const userId = getLoggedInUserIdFromLocal();
    if (!userId) return;

    async function loadUser() {
      try {
        const user = await getUserByIdApi(userId as string);
        if (!cancelled) setCurrentUser(user);
      } catch (err) {
        console.error("Failed to load current user for declaration:", err);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------- Signature from profile (read-only) ------------- */
  useEffect(() => {
    if (!currentUser || !currentUser.signature_image) return;

    const path = currentUser.signature_image;
    const url = resolveImageUrl(path);

    setSignaturePath(path);
    setSignatureUrl(url);
  }, [currentUser]);

  /* ------------- Auto-fill pharmacist name & GPhC number (STORE BY LABEL) ------------- */
  useEffect(() => {
    if (!form || !currentUser) return;

    const schema: any[] = (form as any).schema || [];

    let pharmacistLabel: string | null = null;
    let gphcLabel: string | null = null;

    for (const field of schema) {
      if (!["text", "textarea"].includes(field.type)) continue;

      const labelRaw = String(field.data?.label || "").trim();
      const keyRaw = String(field.data?.key || "").trim();
      const combined = `${labelRaw} ${keyRaw}`.toLowerCase();

      if (!pharmacistLabel && combined.includes("pharmacist") && combined.includes("name")) {
        pharmacistLabel = labelRaw || null;
      }
      if (!gphcLabel && combined.includes("gphc")) {
        gphcLabel = labelRaw || null;
      }

      if (pharmacistLabel && gphcLabel) break;
    }

    setFields((prev) => {
      const next: FieldsState = { ...prev };

      const pharmacistName = pickPharmacistName(currentUser);

      if (pharmacistLabel && !next[pharmacistLabel] && pharmacistName) {
        next[pharmacistLabel] = pharmacistName;
      }

      if (gphcLabel && !next[gphcLabel] && (currentUser as any).gphc_number) {
        next[gphcLabel] = String((currentUser as any).gphc_number);
      }

      return next;
    });
  }, [form, currentUser]);

  /* ---------------- Persist to localStorage on any change ---------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: DeclarationStorage = {
      fields,
      signatureUrl,
      signaturePath,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [fields, signatureUrl, signaturePath, storageKey]);

  function handleFieldChange(storageFieldKey: string, value: string) {
    setFields((prev) => ({ ...prev, [storageFieldKey]: value }));
  }

  /* ---------------- Render ---------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-neutral-300 text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading declaration form…
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
        {error || "Declaration form not available for this service."}
      </div>
    );
  }

  const schema: any[] = (form as any).schema || [];

  const simpleFields =
    schema.filter((f: any) => ["text", "textarea"].includes(f.type)) || [];

  const signatureField = schema.find((f: any) => f.type === "signature");

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Form: <span className="font-medium text-neutral-200">{form.name}</span>
      </p>

      {simpleFields.length > 0 && (
        <div className="space-y-3">
          {simpleFields.map((field: any, idx: number) => {
            // stable react key
            const reactKey = field.data?.key || field.data?.label || `field_${idx}`;

            // ✅ STORAGE KEY = LABEL (fallback to key if label missing)
            const storageFieldKey =
              String(field.data?.label || "").trim() ||
              String(field.data?.key || "").trim() ||
              `field_${idx}`;

            const label = String(field.data?.label || "").trim() || `Field ${idx + 1}`;
            const value = fields[storageFieldKey] || "";
            const help = field.data?.help;

            const commonClass =
              "w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500";

            return (
              <div key={reactKey} className="space-y-1">
                <p className="text-xs font-medium text-neutral-200">{label}</p>

                {help && (
                  <p className="text-[11px] text-neutral-500 whitespace-pre-line mb-1">
                    {help}
                  </p>
                )}

                {field.type === "textarea" ? (
                  <textarea
                    value={value}
                    onChange={(e) => handleFieldChange(storageFieldKey, e.target.value)}
                    className={`${commonClass} min-h-[60px]`}
                    placeholder={label}
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleFieldChange(storageFieldKey, e.target.value)}
                    className={commonClass}
                    placeholder={label}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {signatureField && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-200">
            {signatureField.data?.label || "Pharmacist Signature"}
          </p>

          {signatureField.data?.help && (
            <p className="text-[11px] text-neutral-500 whitespace-pre-line">
              {signatureField.data.help}
            </p>
          )}

          <p className="text-[11px] text-neutral-500">
            This signature is loaded from your profile and{" "}
            <span className="font-semibold text-neutral-300">cannot be changed here</span>. To
            update it, please edit your Profile.
          </p>

          <div className="border border-neutral-700 rounded-lg bg-neutral-950/70 p-3">
            {signatureUrl ? (
              <div className="flex items-center justify-center h-40 bg-neutral-900 rounded-md border border-neutral-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureUrl}
                  alt="Pharmacist signature"
                  className="max-h-32 max-w-full object-contain"
                  onError={() => setSignatureUrl(null)}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 bg-neutral-900 rounded-md border border-neutral-700 text-[11px] text-neutral-500 text-center px-4">
                No signature is configured for your profile. Please contact your admin or update
                your Profile to add a signature.
              </div>
            )}
          </div>
        </div>
      )}

      {!signatureField && (
        <p className="text-[11px] text-neutral-500">
          No signature field configured in this declaration form.
        </p>
      )}
    </div>
  );
}
