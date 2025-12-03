"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Loader2,
  AlertCircle,
  CheckCircle2,
  PenLine,
  Eraser,
} from "lucide-react";
import { getCurrentUserApi, updateUserApi, type UserDto } from "../../../api"; // ⬅️ adjust relative path if needed
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ---------- Small helper card component ---------- */

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
    <section className="relative rounded-2xl border border-neutral-800/80 bg-gradient-to-br from-neutral-900/95 via-neutral-900/90 to-neutral-950/95 shadow-[0_18px_45px_rgba(0,0,0,0.8)] p-[1px]">
      <div className="rounded-2xl bg-neutral-950/90 p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-wide text-neutral-50">
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

/* ---------- Types ---------- */

type ProfileFormState = {
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  phone: string;
  dob: string; // YYYY-MM-DD for <input type="date" />
  address_line1: string;
  address_line2: string;
  city: string;
  county: string;
  postalcode: string;
  country: string;
  user_priority: string;
};

/* ---------- Priority pill helper ---------- */

function PriorityBadge({ value }: { value?: string }) {
  const v = (value || "").toLowerCase();

  let label = "Normal priority";
  let classes = "bg-neutral-800 text-neutral-200 border border-neutral-600/70";

  if (v === "red") {
    label = "High priority";
    classes = "bg-red-500/15 text-red-300 border border-red-500/50";
  } else if (v === "yellow") {
    label = "Medium priority";
    classes = "bg-amber-500/15 text-amber-300 border border-amber-500/50";
  } else if (v === "green") {
    label = "Low priority";
    classes = "bg-emerald-500/15 text-emerald-300 border border-emerald-500/50";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${classes}`}
    >
      <span className="h-2 w-2 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

/* ---------- Profile Page ---------- */

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<UserDto | null>(null);
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
    user_priority: "yellow",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Signature state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  // Load current user on mount
  useEffect(() => {
    const loadMe = async () => {
      try {
        const data = await getCurrentUserApi();
        setUser(data);

        setForm({
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          gender: data.gender ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          dob: data.dob ? String(data.dob).slice(0, 10) : "",
          address_line1: data.address_line1 ?? "",
          address_line2: data.address_line2 ?? "",
          city: data.city ?? "",
          county: data.county ?? "",
          postalcode: data.postalcode ?? "",
          country: data.country ?? "",
          user_priority: data.user_priority ?? "yellow",
        });

        if (data.signature) {
          setSignatureDataUrl(data.signature);
        }
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadMe();
  }, []);

  // Draw existing signature (if any) when signatureDataUrl changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Setup pen style
    ctx.strokeStyle = "#f97316"; // orange-500
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = signatureDataUrl;
    }
  }, [signatureDataUrl]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  /* ---------- Signature pad handlers ---------- */

  const getPointFromEvent = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    // 🔑 Scale DOM coordinates → canvas coordinates
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

  const handleSignatureStart = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPointFromEvent(e);
    if (!point) return;

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setIsDrawing(true);
  };

  const handleSignatureMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPointFromEvent(e);
    if (!point) return;

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const handleSignatureEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    setSignatureDataUrl(dataUrl);
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  /* ---------- Submit ---------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const payload = {
        ...form,
        dob: form.dob ? new Date(form.dob).toISOString() : null,
        signature: signatureDataUrl ?? null,
      };

      await updateUserApi(user._id, payload);
      toast.success("Profile updated successfully");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ToastContainer position="top-right" autoClose={3000} />
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Loading your profile…</span>
        </div>
      </div>
    );
  }

  const fullName =
    (form.firstName || form.lastName) && `${form.firstName} ${form.lastName}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40">
            <User className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide text-neutral-50">
              My Profile
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Manage your personal details, contact information and digital
              signature.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <PriorityBadge value={form.user_priority} />
          {user?.createdAt && (
            <p className="text-[11px] text-neutral-500 flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Member since{" "}
              {new Date(user.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)]">
          {/* Left column */}
          <div className="space-y-6">
            {/* Basic details */}
            <SectionCard
              title="Basic details"
              subtitle="These details are used throughout the system in orders, appointments and letters."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    First name
                  </label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Tony"
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Last name
                  </label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Stark"
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    name="dob"
                    value={form.dob}
                    onChange={handleChange}
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Priority
                  </label>
                  <select
                    name="user_priority"
                    value={form.user_priority}
                    onChange={handleChange}
                    className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="green">Low</option>
                    <option value="yellow">Medium</option>
                    <option value="red">High</option>
                  </select>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Used by admins to quickly identify urgent accounts.
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* Contact & address */}
            <SectionCard
              title="Contact & address"
              subtitle="Your contact details are used for communication and appointment letters."
            >
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-300">
                      Email
                    </label>
                    <div className="flex items-center gap-2 rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-400">
                      <Mail className="h-4 w-4 text-neutral-500" />
                      <input
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        readOnly
                        className="w-full bg-transparent outline-none text-neutral-300"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Email is used as your login and cannot be changed here.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-300">
                      Phone
                    </label>
                    <div className="flex items-center gap-2 rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100">
                      <Phone className="h-4 w-4 text-neutral-500" />
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="1234567890"
                        className="w-full bg-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-neutral-300">
                      Address line 1
                    </label>
                    <input
                      name="address_line1"
                      value={form.address_line1}
                      onChange={handleChange}
                      placeholder="Street address, building"
                      className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-neutral-300">
                      Address line 2
                    </label>
                    <input
                      name="address_line2"
                      value={form.address_line2}
                      onChange={handleChange}
                      placeholder="Apartment, suite, etc."
                      className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-300">
                      City
                    </label>
                    <input
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-300">
                      County
                    </label>
                    <input
                      name="county"
                      value={form.county}
                      onChange={handleChange}
                      className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-300">
                      Postal code
                    </label>
                    <input
                      name="postalcode"
                      value={form.postalcode}
                      onChange={handleChange}
                      className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-300">
                      Country
                    </label>
                    <input
                      name="country"
                      value={form.country}
                      onChange={handleChange}
                      className="w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Summary card */}
            <SectionCard
              title="Profile overview"
              subtitle="Quick snapshot of how your profile appears in the system."
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-100">
                      {fullName || "Unnamed user"}
                    </p>
                    <p className="text-xs text-neutral-400 flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {form.email || "No email set"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {form.city || form.country
                      ? `${form.city || ""}${
                          form.city && form.country ? ", " : ""
                        }${form.country || ""}`
                      : "No location set"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  {form.phone ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Contact number saved</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                      <span>Please add a contact number</span>
                    </>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Signature card */}
            <SectionCard
              title="Digital signature"
              subtitle="Your signature appears on patient letters and important documents."
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-neutral-400">
                    Use your mouse or touch to draw your signature below.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearSignature}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] font-medium text-neutral-200 hover:bg-neutral-800"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      Clear
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 px-3 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <PenLine className="h-4 w-4 text-neutral-400" />
                    <span className="text-xs text-neutral-400">
                      Draw inside the box
                    </span>
                  </div>
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={200}
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 cursor-crosshair"
                      onMouseDown={handleSignatureStart}
                      onMouseMove={handleSignatureMove}
                      onMouseUp={handleSignatureEnd}
                      onMouseLeave={handleSignatureEnd}
                      onTouchStart={handleSignatureStart}
                      onTouchMove={handleSignatureMove}
                      onTouchEnd={handleSignatureEnd}
                    />
                    {!signatureDataUrl && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] text-neutral-500">
                          Sign here
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-500">
                    By saving, your signature will be securely stored and used
                    whenever documents require your approval.
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
