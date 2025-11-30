"use client";

import React, {
  useEffect,
  useRef,
  useState,
  PointerEvent,
} from "react";
import {
  getClinicFormsApi,
  type ClinicForm,
  uploadPageImageApi,
  getBackendBase,
  getUserByIdApi,
  type UserDto,
} from "../../../../api";
import { Loader2, Trash2, Save } from "lucide-react";

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
  signatureDataUrl?: string | null; // legacy base64
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

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const storageKey = `consultation_${orderId}_declaration`;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

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

  /* ------------- Auto-fill Pharmacist Name from getUserByIdApi ------------- */
  useEffect(() => {
    if (!form) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function fillPharmacistName() {
      try {
        const schema: any[] = (form as any).schema || [];

        // Find a text field that looks like "Pharmacist Name"
        const pharmacistField = schema.find((f: any) => {
          if (f.type !== "text") return false;
          const label = (f.data?.label || "").toLowerCase();
          const key = (f.data?.key || "").toLowerCase();
          const combined = `${label} ${key}`;
          return (
            combined.includes("pharmacist") &&
            combined.includes("name")
          );
        });

        if (!pharmacistField) return;

        const pharmacistKey =
          pharmacistField.data?.key || pharmacistField.data?.label;
        if (!pharmacistKey) return;

        // If user already typed something or LS has a value, don't override
        if (fields[pharmacistKey]) return;

        const userId = getLoggedInUserIdFromLocal();
        if (!userId) {
          console.warn(
            "[PharmacistDeclaration] No logged-in user id found in localStorage"
          );
          return;
        }

        const user: UserDto = await getUserByIdApi(userId);
        if (cancelled) return;

        const pharmacistName =
          user.name ||
          user.fullName ||
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          user.email ||
          "";

        if (!pharmacistName) return;

        setFields((prev) => {
          // Double-check again to not override if user typed while we were fetching
          if (prev[pharmacistKey]) return prev;
          return {
            ...prev,
            [pharmacistKey]: pharmacistName,
          };
        });
      } catch (err) {
        console.error("Failed to auto-fill pharmacist name:", err);
      }
    }

    fillPharmacistName();

    return () => {
      cancelled = true;
    };
    // we intentionally only depend on `form` so it runs once after form load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  /* ---------------- Persist to localStorage ---------------- */
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

  /* ---------------- Canvas drawing handlers ---------------- */
  function getCanvasPos(
    e: PointerEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const pos = getCanvasPos(e);
    if (!pos) return;
    drawingRef.current = true;
    lastPosRef.current = pos;
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const lastPos = lastPosRef.current;
    if (!canvas || !lastPos) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getCanvasPos(e);
    if (!pos) return;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPosRef.current = pos;
  }

  function endDrawing() {
    drawingRef.current = false;
    lastPosRef.current = null;
  }

  /* ---------------- Signature upload ---------------- */
  async function handleSaveSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setUploading(true);
    setUploadError(null);

    try {
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );

      if (!blob) {
        throw new Error("Failed to capture signature image.");
      }

      const file = new File([blob], `signature-${orderId || "order"}.png`, {
        type: "image/png",
      });

      const res = await uploadPageImageApi(file);
      const rawPath = (res as any).url || (res as any).path;
      if (!rawPath) {
        throw new Error("Upload succeeded but no URL was returned.");
      }

      const fullUrl = resolveImageUrl(rawPath);

      setSignatureUrl(fullUrl);
      setSignaturePath(rawPath);
    } catch (err: any) {
      console.error("Signature upload failed:", err);
      setUploadError(err?.message || "Failed to upload signature.");
    } finally {
      setUploading(false);
    }
  }

  function handleClearSignature() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureUrl(null);
    setSignaturePath(null);
    setUploadError(null);
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
            Use your mouse or finger to sign inside the box. Click{" "}
            <span className="font-semibold text-neutral-300">
              “Save signature”
            </span>{" "}
            to upload and store it.
          </p>

          <div className="border border-neutral-700 rounded-lg bg-neutral-950/70 p-2">
            <canvas
              ref={canvasRef}
              width={500}
              height={200}
              className="w-full h-40 bg-neutral-900 rounded-md cursor-crosshair"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrawing}
              onPointerLeave={endDrawing}
            />
            <div className="flex justify-between items-center mt-2 gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveSignature}
                  disabled={uploading}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {uploading && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {!uploading && <Save className="h-3 w-3" />}
                  {uploading ? "Uploading…" : "Save signature"}
                </button>
                <button
                  type="button"
                  onClick={handleClearSignature}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-500/70 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              </div>

              <div className="flex flex-col items-end gap-1">
                {signatureUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-300">
                      Signature uploaded
                    </span>
                    <a
                      href={signatureUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-300 underline"
                    >
                      View
                    </a>
                  </div>
                )}
                {uploadError && (
                  <span className="text-[11px] text-rose-300">
                    {uploadError}
                  </span>
                )}
              </div>
            </div>

            {signatureUrl && (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureUrl}
                  alt="Uploaded signature preview"
                  className="h-16 rounded-md border border-neutral-700 bg-neutral-900 object-contain"
                />
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
