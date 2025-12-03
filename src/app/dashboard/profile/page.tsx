"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  getCurrentUserApi,
  updateUserWithFormDataApi,
  type UserDto,
  getBackendBase,
} from "../../../api";
import {
  Loader2,
  Save,
  User as UserIcon,
  Mail,
  Phone,
  CalendarDays,
  MapPin,
  Shield,
  BadgeCheck,
  X,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  phone: string;
  dob: string; // YYYY-MM-DD
  address_line1: string;
  address_line2: string;
  city: string;
  county: string;
  postalcode: string;
  country: string;
  user_priority: string;
  gphc_number: string;
};

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-neutral-800/80 bg-gradient-to-br from-neutral-900 via-neutral-900/95 to-black/95 shadow-[0_18px_45px_rgba(0,0,0,0.8)] p-[1px]">
      <div className="rounded-2xl bg-neutral-950/90 p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-wide text-neutral-50 flex items-center gap-2">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState<ProfileFormState>({
    firstName: "",
    lastName: "",
    gender: "",
    email: "",
    phone: "",
    dob: "",
    address_line1: "",
    address_line2: "",
    city: "",
    county: "",
    postalcode: "",
    country: "",
    user_priority: "",
    gphc_number: "",
  });

  // ---------- Signature pad ----------
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false); // ⬅️ track if user actually drew
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(
    null
  ); // existing signature PREVIEW (not drawn on canvas)

  // scale-aware coordinate helper (fixes "mouse is far from stroke" bug)
  const getPointFromEvent = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number;
    let clientY: number;

    if ("touches" in e.nativeEvent && e.nativeEvent.touches.length > 0) {
      const touch = e.nativeEvent.touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      const mouseEvent = e.nativeEvent as MouseEvent;
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const setupCanvasBackground = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#050507";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  useEffect(() => {
    setupCanvasBackground();
  }, []);

  const handleSignatureStart = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // user is drawing a *new* signature
    setHasDrawn(true);

    const point = getPointFromEvent(e);
    if (!point) return;

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setIsDrawing(true);
  };

  const handleSignatureMove = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const point = getPointFromEvent(e);
    if (!point) return;

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const handleSignatureEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setupCanvasBackground();
    setHasDrawn(false);
    // keep existing signatureImageUrl (preview) OR clear it? your call.
    // If you want clear to visually remove old saved signature:
    // setSignatureImageUrl(null);
  };

  // Load current user
  useEffect(() => {
    const load = async () => {
      try {
        const u: UserDto = await getCurrentUserApi();
        setUserId(u._id);

        setForm({
          firstName: u.firstName || "",
          lastName: u.lastName || "",
          gender: (u.gender as string) || "",
          email: u.email || "",
          phone: (u.phone as string) || "",
          dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : "",
          address_line1: (u.address_line1 as string) || "",
          address_line2: (u.address_line2 as string) || "",
          city: (u.city as string) || "",
          county: (u.county as string) || "",
          postalcode: (u.postalcode as string) || "",
          country: (u.country as string) || "",
          user_priority: (u.user_priority as string) || "",
          gphc_number: (u.gphc_number as string) || "",
        });

        // Existing signature preview (we DO NOT draw this onto the canvas)
        if (u.signature_image) {
          const baseForFiles = getBackendBase().replace(/\/api\/?$/, "");
          const fullUrl = (u.signature_image as string).startsWith("http")
            ? (u.signature_image as string)
            : `${baseForFiles}/${(u.signature_image as string).replace(
                /^\/+/,
                ""
              )}`;
          setSignatureImageUrl(fullUrl);
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        ...form,
        dob: form.dob ? new Date(form.dob).toISOString() : "",
      };

      let signatureFile: File | null = null;
      const canvas = canvasRef.current;

      // ⬅️ Only try to export if user actually drew something
      if (canvas && hasDrawn) {
        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png")
        );
        if (blob) {
          signatureFile = new File([blob], "signature.png", {
            type: "image/png",
          });
        }
      }

      const updated = await updateUserWithFormDataApi(
        userId,
        payload,
        signatureFile
      );

      // If backend returns new path, refresh preview
      if (updated?.signature_image) {
        const baseForFiles = getBackendBase().replace(/\/api\/?$/, "");
        const fullUrl = updated.signature_image.startsWith("http")
          ? updated.signature_image
          : `${baseForFiles}/${updated.signature_image.replace(/^\/+/, "")}`;
        setSignatureImageUrl(fullUrl);
        setHasDrawn(false);
        setupCanvasBackground();
      }

      toast.success("Profile updated successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ToastContainer position="top-right" autoClose={3000} />
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading your profile…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
            <UserIcon size={14} />
            Logged-in Pharmacist
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide text-neutral-50">
              Profile & Signature
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Keep your personal, professional and signing information up to
              date.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              Save Changes
            </>
          )}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)]">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          <SectionCard
            title="Personal details"
            subtitle="These details identify you in the system and on patient-facing documents."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-neutral-300">
                  First name
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/70 px-3">
                  <UserIcon size={14} className="text-neutral-500" />
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    className="w-full bg-transparent py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                    placeholder="John"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Last name
                </label>
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg bg-neutral-900/70 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="Doe"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Gender
                </label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg bg-neutral-900/70 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 flex items-center gap-1">
                  Date of birth
                  <CalendarDays size={12} className="text-neutral-500" />
                </label>
                <input
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg bg-neutral-900/70 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Email
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/70 px-3">
                  <Mail size={14} className="text-neutral-500" />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full bg-transparent py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Phone
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/70 px-3">
                  <Phone size={14} className="text-neutral-500" />
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full bg-transparent py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                    placeholder="07…"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Address"
            subtitle="Used for correspondence and appearing in some clinic documents."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-300 flex items-center gap-1">
                  Address line 1
                  <MapPin size={12} className="text-neutral-500" />
                </label>
                <input
                  name="address_line1"
                  value={form.address_line1}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg bg-neutral-900/70 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="Building, street"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-300">
                  Address line 2
                </label>
                <input
                  name="address_line2"
                  value={form.address_line2}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg bg-neutral-900/70 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  City
                </label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg bg-neutral-900/70 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="City"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  County
                </label>
                <input
                  name="county"
                  value={form.county}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg bg-neutral-900/70 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="County"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Postcode
                </label>
                <input
                  name="postalcode"
                  value={form.postalcode}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg bg-neutral-900/70 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="e.g. SW1A 1AA"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Country
                </label>
                <input
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg bg-neutral-900/70 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="United Kingdom"
                />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <SectionCard
            title="Professional details"
            subtitle="These values are shown on prescriptions and clinical documents."
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-300 flex items-center gap-2">
                  GPhC registration number
                  <BadgeCheck size={14} className="text-emerald-400" />
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/70 px-3">
                  <Shield size={14} className="text-neutral-500" />
                  <input
                    name="gphc_number"
                    value={form.gphc_number}
                    onChange={handleChange}
                    className="w-full bg-transparent py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                    placeholder="e.g. 2-XXXXX"
                  />
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  This will appear next to your name when you approve documents.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Priority status
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium
                    ${
                      form.user_priority === "red"
                        ? "border-red-500/50 bg-red-500/10 text-red-300"
                        : form.user_priority === "green"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/50 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {form.user_priority || "yellow"}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    (Set by admin; used for internal dashboards.)
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Signature"
            subtitle="Draw your signature once — we’ll reuse it whenever documents require your approval."
          >
            <div className="space-y-3">
              <p className="text-xs text-neutral-400">
                Use your mouse or touch to draw your signature below.
              </p>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3 space-y-3">
                <p className="text-[11px] font-medium text-neutral-300 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 border border-neutral-700">
                    ✒️
                  </span>
                  Draw inside the box
                </p>

                <div className="relative rounded-lg border border-neutral-700 bg-neutral-900/80">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full h-40 sm:h-44 md:h-48 cursor-crosshair rounded-lg"
                    onMouseDown={handleSignatureStart}
                    onMouseMove={handleSignatureMove}
                    onMouseUp={handleSignatureEnd}
                    onMouseLeave={handleSignatureEnd}
                    onTouchStart={handleSignatureStart}
                    onTouchMove={handleSignatureMove}
                    onTouchEnd={handleSignatureEnd}
                  />
                  <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-neutral-500">
                    Sign here
                  </span>
                </div>

                {/* Existing saved signature preview (NOT drawn on canvas) */}
                {signatureImageUrl && !hasDrawn && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-neutral-500">
                      Current saved signature:
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signatureImageUrl}
                      alt="Current signature"
                      className="h-16 rounded-md border border-neutral-700 bg-neutral-900 object-contain"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-neutral-500 max-w-xs">
                    On save, your drawn signature is uploaded as{" "}
                    <span className="font-medium text-neutral-300">
                      signature_image
                    </span>{" "}
                    and used whenever documents require your approval.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearSignature}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] font-medium text-neutral-200 hover:bg-neutral-800"
                  >
                    <X size={12} />
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
