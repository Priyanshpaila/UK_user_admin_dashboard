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
  [fieldKey: string]: string;
};

type DeclarationStorage = {
  fields: FieldsState;
  signatureUrl?: string | null; // full URL to image
  signaturePath?: string | null; // raw path from backend (/uploads/...png)
  signatureDataUrl?: string | null; // legacy base64 (backward compat)
};

// Helper to resolve stored path to full URL
const resolveImageUrl = (imagePath: string) => {
  if (!imagePath) return "";

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;

  const baseWithApi = getBackendBase();
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");

  return `${cleanBase}${normalizedPath}`;
};

// Helper: get logged-in userId from localStorage (adjust keys if needed)
function getLoggedInUserIdFromLocal(): string | null {
  if (typeof window === "undefined") return null;

  // 1) Try if you stored full user JSON under "user"
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
      // ignore JSON parse error
    }
  }

  // 2) Fallback: maybe you stored plain user id
  const idKeys = ["user_id", "userId", "pharmacist_id"];
  for (const key of idKeys) {
    const v = window.localStorage.getItem(key);
    if (v) return v;
  }

  return null;
}

export default function PharmacistDeclarationTab({
  orderId,
  serviceId,
}: Props) {
  const [form, setForm] = useState<ClinicForm | null>(null);
  const [fields, setFields] = useState<FieldsState>({});
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null); // what we render
  const [signaturePath, setSignaturePath] = useState<string | null>(null); // what we save as path
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
            setError(
              "No Pharmacist Declaration form is configured for this service."
            );
          }
          return;
        }

        let initialFields: FieldsState = {};
        let initialSignatureUrl: string | null = null;
        let initialSignaturePath: string | null = null;

        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            try {
              const parsed: DeclarationStorage = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                initialFields = parsed.fields || {};
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
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load declaration form");
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

  /* ------------- Load current user (for name, GPhC, signature) ------------- */
  useEffect(() => {
    let cancelled = false;
    const userId = getLoggedInUserIdFromLocal();
    if (!userId) return;

    async function loadUser() {
      try {
        const user = await getUserByIdApi(userId as string);
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch (err) {
        console.error("Failed to load current user for declaration:", err);
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------- Auto-fill pharmacist name & GPhC number ------------- */
  useEffect(() => {
    if (!form || !currentUser) return;

    const schema: any[] = (form as any).schema || [];

    let pharmacistKey: string | null = null;
    let gphcKey: string | null = null;

    for (const field of schema) {
      if (!["text", "textarea"].includes(field.type)) continue;
      const label = (field.data?.label || "").toLowerCase();
      const key = (field.data?.key || "").toLowerCase();
      const combined = `${label} ${key}`;

      if (
        !pharmacistKey &&
        combined.includes("pharmacist") &&
        combined.includes("name")
      ) {
        pharmacistKey = field.data?.key || field.data?.label || null;
      }

      if (!gphcKey && combined.includes("gphc")) {
        gphcKey = field.data?.key || field.data?.label || null;
      }

      if (pharmacistKey && gphcKey) break;
    }

    setFields((prev) => {
      const next: FieldsState = { ...prev };

      // Build pharmacist display name
      const pharmacistName =
        currentUser.name ||
        currentUser.fullName ||
        `${currentUser.firstName || ""} ${
          currentUser.lastName || ""
        }`.trim() ||
        currentUser.email ||
        "";

      if (pharmacistKey && !next[pharmacistKey] && pharmacistName) {
        next[pharmacistKey] = pharmacistName;
      }

      if (gphcKey && !next[gphcKey] && currentUser.gphc_number) {
        next[gphcKey] = currentUser.gphc_number;
      }

      // 🔹 NEW: immediately persist auto-filled values into localStorage
      if (typeof window !== "undefined") {
        const payload: DeclarationStorage = {
          fields: next,
          signatureUrl,
          signaturePath,
        };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      }

      return next;
    });
  }, [form, currentUser, storageKey, signatureUrl, signaturePath]);

  /* ------------- Signature from profile (read-only) ------------- */
  useEffect(() => {
    if (!currentUser || !currentUser.signature_image) return;

    const path = currentUser.signature_image;
    const url = resolveImageUrl(path);

    setSignaturePath(path);
    setSignatureUrl(url);
  }, [currentUser]);

  /* ---------------- Persist to localStorage on any manual change ---------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: DeclarationStorage = {
      fields,
      signatureUrl,
      signaturePath,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [fields, signatureUrl, signaturePath, storageKey]);

  function handleFieldChange(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
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

  const simpleFields =
    ((form as any).schema || []).filter((f: any) =>
      ["text", "textarea"].includes(f.type)
    ) || [];

  const signatureField = ((form as any).schema || []).find(
    (f: any) => f.type === "signature"
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Form:{" "}
        <span className="font-medium text-neutral-200">
          {form.name}
        </span>
      </p>

      {simpleFields.length > 0 && (
        <div className="space-y-3">
          {simpleFields.map((field: any, idx: number) => {
            const key =
              field.data?.key || field.data?.label || `field_${idx}`;
            const label = field.data?.label || `Field ${idx + 1}`;
            const value = fields[key] || "";
            const help = field.data?.help;

            return (
              <div key={key} className="space-y-1">
                <p className="text-xs font-medium text-neutral-200">
                  {label}
                </p>
                {help && (
                  <p className="text-[11px] text-neutral-500 whitespace-pre-line mb-1">
                    {help}
                  </p>
                )}
                {field.type === "textarea" ? (
                  <textarea
                    value={value}
                    onChange={(e) =>
                      handleFieldChange(key, e.target.value)
                    }
                    className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 min-h-[60px]"
                    placeholder={label}
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) =>
                      handleFieldChange(key, e.target.value)
                    }
                    className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500"
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
            <span className="font-semibold text-neutral-300">
              cannot be changed here
            </span>
            . To update it, please edit your Profile.
          </p>

          <div className="border border-neutral-700 rounded-lg bg-neutral-950/70 p-3">
            {signatureUrl ? (
              <div className="flex items-center justify-center h-40 bg-neutral-900 rounded-md border border-neutral-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureUrl}
                  alt="Pharmacist signature"
                  className="max-h-32 max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 bg-neutral-900 rounded-md border border-neutral-700 text-[11px] text-neutral-500 text-center px-4">
                No signature is configured for your profile. Please contact
                your admin or update your Profile to add a signature.
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
