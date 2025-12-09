"use client";

import React, { useEffect, useState } from "react";
import {
  getNhsServicesApi,
  updateNhsServiceApi,
  type NhsServiceRequestDto,
} from "../../../../api";

import {
  Loader2,
  ClipboardList,
  Filter,
  User,
  CalendarDays,
  MapPin,
  Phone,
  Mail,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* ----------------- Helpers ----------------- */

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calculateAgeFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  if (age < 0 || age > 120) return null;
  return age;
}

const EXEMPTION_LABELS: Record<string, string> = {
  age_60_plus: "Age 60 or over",
  age_16_18_in_full_time_education: "Age 16–18 in full-time education",
  maternity: "Maternity exemption certificate",
  medical_exemption: "Medical exemption certificate",
  hc2: "HC2 certificate",
  hc3: "HC3 certificate",
  income_support: "Income Support",
  universal_credit: "Universal Credit",
  pays: "Pays for prescriptions",
};

function formatExemption(code?: string | null): string {
  if (!code) return "Not provided";
  return EXEMPTION_LABELS[code] || code.replace(/_/g, " ");
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-500/10 text-amber-300 border-amber-500/40";
    case "approved":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
    case "rejected":
      return "bg-rose-500/10 text-rose-300 border-rose-500/40";
    default:
      return "bg-neutral-500/10 text-neutral-300 border-neutral-500/40";
  }
}

/* ----------------- Component ----------------- */

export default function NhsPendingPage() {
  const [items, setItems] = useState<NhsServiceRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<NhsServiceRequestDto | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(
    null
  );

  // ✅ logged-in user id for approvedBy
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  // read logged-in user from localStorage (same pattern as your pending orders page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const id = parsed._id || parsed.id || parsed.userId;
      if (id) setLoggedInUserId(String(id));
    } catch (err) {
      console.error("Failed to read logged-in user from localStorage", err);
    }
  }, []);

  // load NHS nominations (no query params – as requested)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getNhsServicesApi();
        if (cancelled) return;
        const pending = (res.data || []).filter(
          (it: NhsServiceRequestDto) => it.status === "pending"
        );
        setItems(pending);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load NHS nominations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPending = items.length;

  const openModal = (item: NhsServiceRequestDto) => {
    setSelected(item);
    setNote("");
  };

  const closeModal = () => {
    setSelected(null);
    setNote("");
    setSubmitting(null);
  };

  async function handleDecision(action: "approve" | "reject") {
    if (!selected) return;

    const trimmed = note.trim();
    const payload: any = {
      status: action === "approve" ? "approved" : "rejected",
    };

    // ✅ approval / rejection notes
    if (action === "approve" && trimmed) {
      payload.approval_note = trimmed;
    }
    if (action === "reject" && trimmed) {
      payload.rejection_note = trimmed;
    }

    // ✅ keep notes array in sync
    if (trimmed) {
      payload.notes = [...(selected.notes || []), trimmed];
    }

    // ✅ on approve, send logged-in user + time
    if (action === "approve") {
      if (loggedInUserId) {
        payload.approvedBy = loggedInUserId; // matches your DB field
      }
      payload.approved_at = new Date().toISOString();
    }

    setSubmitting(action);
    try {
      await updateNhsServiceApi(selected._id, payload);
      // remove from local list (no longer pending)
      setItems((prev) => prev.filter((x) => x._id !== selected._id));
      closeModal();
    } catch (e: any) {
      alert(e?.message || "Failed to update NHS nomination");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Pending NHS Nominations
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            New NHS prescription nominations that need to be approved or
            rejected by the pharmacy team.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300">
            <Filter size={14} />
            <span>Status:</span>
            <span className="font-medium text-amber-300">Pending</span>
          </div>
          <span className="text-xs text-neutral-500">
            {totalPending} pending nomination{totalPending === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading NHS nominations…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-center text-neutral-400">
          No pending NHS nominations found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const fullName = `${item.first_name} ${item.last_name}`.trim();
            const age = calculateAgeFromDob(item.dob);
            const createdLabel = formatDateTime(item.createdAt);

            return (
              <div
                key={item._id}
                className="group flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 hover:border-emerald-500/50 hover:bg-neutral-900 transition-colors"
              >
                {/* Top: patient + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-xs font-semibold text-emerald-200">
                      {(item.first_name?.[0] ||
                        item.last_name?.[0] ||
                        "P"
                      ).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm md:text-base font-semibold text-white">
                          {fullName || "Unnamed patient"}
                        </h2>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-neutral-500" />
                          <span>
                            {formatDate(item.dob)}
                            {age ? ` • ${age} yrs` : ""}
                          </span>
                        </span>
                        {item.gender && (
                          <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-900/70 px-2 py-0.5 capitalize">
                            {item.gender}
                          </span>
                        )}
                        {item.nhs_number && (
                          <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-900/70 px-2 py-0.5 font-mono text-[10px]">
                            NHS: {item.nhs_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                      statusBadgeClasses(item.status)
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {item.status.toUpperCase()}
                  </span>
                </div>

                {/* Middle: contact + address */}
                <div className="mt-4 space-y-2 text-xs text-neutral-300">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-neutral-500" />
                        <span className="truncate">{item.email}</span>
                      </div>
                    )}
                    {item.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-neutral-500" />
                        <span>{item.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3 w-3 text-neutral-500 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-neutral-200">
                        {item.address}
                        {item.address1 ? `, ${item.address1}` : ""}
                        {item.address2 ? `, ${item.address2}` : ""}
                      </p>
                      <p className="text-neutral-400">
                        {[item.city, item.postcode]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                      <p className="text-neutral-500 text-[11px]">
                        {item.country || "United Kingdom"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Exemption + created */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/40 px-2 py-0.5 font-medium text-emerald-200">
                      {formatExemption(item.exemption)}
                    </span>
                    {item.exemption_expiry && (
                      <span className="text-neutral-400">
                        Expires: {formatDate(item.exemption_expiry)}
                      </span>
                    )}
                  </div>
                  <span className="text-neutral-500">
                    Created:{" "}
                    <span className="font-mono text-neutral-300">
                      {createdLabel}
                    </span>
                  </span>
                </div>

                {/* Bottom: actions */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                    <Info className="h-3 w-3 text-neutral-600" />
                    <span>
                      Source:{" "}
                      {item.meta?.source || "NHS services registration form"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openModal(item)}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-200 hover:border-emerald-500 hover:text-emerald-300 group-hover:border-emerald-500"
                  >
                    Review & decide
                    <ClipboardList className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 md:px-6">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                    <ClipboardList className="h-4 w-4" />
                    NHS nomination review
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {selected.first_name} {selected.last_name} • NHS no:{" "}
                    <span className="font-mono text-neutral-300">
                      {selected.nhs_number || "not provided"}
                    </span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="ml-4 rounded-full p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm text-neutral-200">
              {/* Patient + contact */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-xs font-semibold text-emerald-200">
                      {(selected.first_name?.[0] ||
                        selected.last_name?.[0] ||
                        "P"
                      ).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {selected.first_name} {selected.last_name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-neutral-500" />
                          <span>
                            {formatDate(selected.dob)}
                            {calculateAgeFromDob(selected.dob)
                              ? ` • ${calculateAgeFromDob(selected.dob)} yrs`
                              : ""}
                          </span>
                        </span>
                        {selected.gender && (
                          <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-900/70 px-2 py-0.5 capitalize">
                            {selected.gender}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                      statusBadgeClasses(selected.status)
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {selected.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-neutral-300 mt-2">
                  <div className="space-y-1">
                    <p className="font-semibold text-neutral-400">Contact</p>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-neutral-500" />
                      <span className="truncate">{selected.email || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-neutral-500" />
                      <span>{selected.phone || "—"}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-neutral-400">Created</p>
                    <p>{formatDateTime(selected.createdAt)}</p>
                    <p className="text-neutral-500 text-[11px]">
                      Source:{" "}
                      {selected.meta?.source || "NHS services registration"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-[11px]">
                  <p className="text-neutral-400 font-semibold mb-1">
                    Home address
                  </p>
                  <p className="text-neutral-200">
                    {selected.address}
                    {selected.address1 ? `, ${selected.address1}` : ""}
                    {selected.address2 ? `, ${selected.address2}` : ""}
                  </p>
                  <p className="text-neutral-400">
                    {[selected.city, selected.postcode]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                  <p className="text-neutral-500">
                    {selected.country || "United Kingdom"}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-[11px]">
                  <p className="text-neutral-400 font-semibold mb-1">
                    Delivery address
                  </p>
                  <p className="text-neutral-200">
                    {selected.delivery_address}
                    {selected.delivery_address1
                      ? `, ${selected.delivery_address1}`
                      : ""}
                    {selected.delivery_address2
                      ? `, ${selected.delivery_address2}`
                      : ""}
                  </p>
                  <p className="text-neutral-400">
                    {[selected.delivery_city, selected.delivery_postcode]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                  <p className="text-neutral-500">
                    {selected.delivery_country || "United Kingdom"}
                  </p>
                  {selected.use_alt_delivery && (
                    <p className="mt-1 text-emerald-300">
                      Uses alternative delivery address.
                    </p>
                  )}
                </div>
              </div>

              {/* Exemption + consent */}
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)] gap-4">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-[11px]">
                  <p className="text-neutral-400 font-semibold mb-1">
                    NHS exemption
                  </p>
                  <p className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/40 px-2 py-0.5 text-xs font-medium text-emerald-200">
                    {formatExemption(selected.exemption)}
                  </p>
                  <div className="mt-2 space-y-1 text-neutral-300">
                    {selected.exemption_expiry && (
                      <p>
                        Expires on:{" "}
                          <span className="font-medium">
                          {formatDate(selected.exemption_expiry)}
                        </span>
                      </p>
                    )}
                    {selected.exemption_number && (
                      <p>
                        Exemption number:{" "}
                        <span className="font-medium">
                          {selected.exemption_number}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-[11px]">
                  <p className="text-neutral-400 font-semibold mb-1">
                    Patient consent
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <ConsentRow
                      label="Patient confirms they are the patient"
                      value={selected.consent_patient}
                    />
                    <ConsentRow
                      label="Consents to nomination to this pharmacy"
                      value={selected.consent_nomination}
                    />
                    <ConsentRow
                      label="Nomination process explained"
                      value={selected.consent_nomination_explained}
                    />
                    <ConsentRow
                      label="Exemption details signed / confirmed"
                      value={selected.consent_exemption_signed}
                    />
                    <ConsentRow
                      label="Agrees to SCR access where appropriate"
                      value={selected.consent_scr_access}
                    />
                  </div>
                </div>
              </div>

              {/* Notes + action note */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-[11px] space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-200">
                    Notes
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Internal notes only visible to staff.
                  </p>
                </div>

                {selected.notes && selected.notes.length > 0 && (
                  <div className="space-y-1">
                    {selected.notes.map((n, idx) => (
                      <div
                        key={idx}
                        className="rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-[11px] text-neutral-200"
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="nhs-note"
                    className="text-[11px] font-medium text-neutral-300"
                  >
                    Approval / rejection note (optional)
                  </label>
                  <textarea
                    id="nhs-note"
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-[11px] text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500"
                    placeholder="Add context about checks you have done, reasons for rejecting, etc."
                  />
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-neutral-500">
                    <Info className="h-3 w-3 text-neutral-600" />
                    This note will be saved on the nomination record.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-neutral-800 px-5 py-3 text-[11px] text-neutral-400">
              <p className="max-w-md">
                Approve to confirm nomination to this pharmacy, or reject if
                details are incorrect or nomination is not appropriate.
              </p>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  disabled={submitting === "reject" || submitting === "approve"}
                  onClick={() => handleDecision("reject")}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-500/60 px-4 py-1.5 text-xs font-medium text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting === "reject" && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Reject nomination
                  <XCircle className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  disabled={submitting === "approve" || submitting === "reject"}
                  onClick={() => handleDecision("approve")}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting === "approve" && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Approve nomination
                  <CheckCircle2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------- Small sub-component ----------------- */

function ConsentRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-neutral-300">{label}</span>
      <span
        className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          value
            ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
            : "border-neutral-600 bg-neutral-900 text-neutral-300"
        }`}
      >
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}
