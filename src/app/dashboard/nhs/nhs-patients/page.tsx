"use client";

import React, { useEffect, useState } from "react";
import {
  getNhsServicesApi,
  type NhsServiceRequestDto,
  getUserByIdApi,
  type UserDto,
} from "../../../../api";

import {
  Loader2,
  Filter,
  User,
  CalendarDays,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Info,
  X,
  ClipboardList,
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

function getDisplayStaffName(user?: UserDto | null): string {
  if (!user) return "Unknown staff";
  return (
    user.name ||
    user.fullName ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.email ||
    "Unknown staff"
  );
}

/* ----------------- Page ----------------- */

export default function NhsApprovedPatientsPage() {
  const [items, setItems] = useState<NhsServiceRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // approvedBy user cache: userId -> UserDto
  const [approvedByUsers, setApprovedByUsers] = useState<
    Record<string, UserDto | null>
  >({});

  // detail modal state
  const [showDetail, setShowDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NhsServiceRequestDto | null>(
    null
  );

  // ---------- Load approved NHS items ----------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getNhsServicesApi(); // no query filters for now
        if (cancelled) return;
        const approved = (res.data || []).filter(
          (it: NhsServiceRequestDto) => it.status === "approved"
        );
        setItems(approved);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load NHS approved patients");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Load staff users for approvedBy ----------
  useEffect(() => {
    let cancelled = false;

    async function loadApprovedByUsers() {
      const ids = Array.from(
        new Set(
          items.map((it) => it.approvedBy as string | undefined).filter(Boolean)
        )
      ) as string[];

      // nothing new to load
      const idsToFetch = ids.filter((id) => approvedByUsers[id] === undefined);
      if (!idsToFetch.length) return;

      try {
        const results = await Promise.all(
          idsToFetch.map(async (id) => {
            try {
              const user = await getUserByIdApi(id);
              return [id, user] as const;
            } catch (err) {
              console.error("Failed to fetch user for NHS approvedBy", id, err);
              return [id, null] as const;
            }
          })
        );
        if (cancelled) return;

        const map: Record<string, UserDto | null> = { ...approvedByUsers };
        for (const [id, user] of results) {
          map[id] = user;
        }
        setApprovedByUsers(map);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed loading approvedBy users", err);
      }
    }

    if (items.length) {
      loadApprovedByUsers();
    }
    return () => {
      cancelled = true;
    };
  }, [items, approvedByUsers]);

  const totalApproved = items.length;

  function handleViewDetails(item: NhsServiceRequestDto) {
    setSelectedItem(item);
    setShowDetail(true);
  }

  function closeDetail() {
    setShowDetail(false);
    setSelectedItem(null);
  }

  // For modal: find staff user for selected item
  const selectedApprovedByUser =
    selectedItem && selectedItem.approvedBy
      ? approvedByUsers[selectedItem.approvedBy]
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            NHS Patients (Approved)
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Patients who have been successfully approved for NHS prescriptions
            with Pharmacy Express.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300">
            <Filter size={14} />
            <span>Status:</span>
            <span className="font-medium text-emerald-300">NHS Approved</span>
          </div>
          <span className="text-xs text-neutral-500">
            {totalApproved} NHS approved patient
            {totalApproved === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading NHS approved patients…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-center text-neutral-400">
          No NHS approved patients found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const fullName = `${item.first_name} ${item.last_name}`.trim();
            const age = calculateAgeFromDob(item.dob);
            const approvedAt = formatDateTime(item.approved_at);
            const createdAt = formatDateTime(item.createdAt);

            const approvedByUser =
              item.approvedBy && approvedByUsers[item.approvedBy]
                ? approvedByUsers[item.approvedBy]
                : null;

            return (
              <div
                key={item._id}
                className="group flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 hover:border-emerald-500/50 hover:bg-neutral-900 transition-colors"
              >
                {/* Top row: name + NHS Approved badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-xs font-semibold text-emerald-200">
                      {(
                        item.first_name?.[0] ||
                        item.last_name?.[0] ||
                        "P"
                      ).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm md:text-base font-semibold text-white">
                          {fullName || "Unnamed patient"}
                        </h2>
                        {/* ✅ NHS Approved pill */}
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          NHS Approved
                        </span>
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

                  {/* small top-right info */}
                  <div className="flex flex-col items-end gap-1 text-[11px] text-neutral-500">
                    <span className="text-emerald-300 font-medium">
                      NHS Patient
                    </span>
                    {approvedAt !== "—" && (
                      <span>
                        Approved:{" "}
                        <span className="font-mono text-neutral-300">
                          {approvedAt}
                        </span>
                      </span>
                    )}
                    {item.approvedBy && (
                      <span className="truncate">
                        By:{" "}
                        <span className="font-normal text-neutral-300">
                          {approvedByUser
                            ? getDisplayStaffName(approvedByUser)
                            : "Unknown staff"}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Contact + address */}
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

                {/* Exemption + meta */}
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
                    Registered:{` `}
                    <span className="font-mono text-neutral-300">
                      {createdAt}
                    </span>
                  </span>
                </div>

                {/* Source/info + details button */}
                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-neutral-500">
                  <div className="flex items-center gap-2"></div>

                  <button
                    type="button"
                    onClick={() => handleViewDetails(item)}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 text-[11px] font-medium text-neutral-100 hover:border-emerald-500 hover:text-emerald-200"
                  >
                    View details
                    <ClipboardList className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {showDetail && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 md:px-6">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                  <ClipboardList className="h-4 w-4" />
                  NHS patient details
                </span>
                <span className="text-[11px] text-neutral-500">
                  {selectedItem.first_name} {selectedItem.last_name}
                  {selectedItem.nhs_number
                    ? ` • NHS: ${selectedItem.nhs_number}`
                    : ""}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  NHS Approved
                </span>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="ml-2 rounded-full p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm text-neutral-200">
              {/* Patient summary */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/50 flex items-center justify-center text-sm font-semibold text-emerald-200">
                    {(
                      selectedItem.first_name?.[0] ||
                      selectedItem.last_name?.[0] ||
                      "P"
                    ).toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {selectedItem.first_name} {selectedItem.last_name}
                        </p>
                        <p className="text-[11px] text-neutral-400 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3 text-neutral-500" />
                            <span className="capitalize">
                              {selectedItem.gender || "Gender not set"}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3 text-neutral-500" />
                            <span>
                              DOB: {formatDate(selectedItem.dob)}
                              {(() => {
                                const age = calculateAgeFromDob(
                                  selectedItem.dob
                                );
                                return age ? ` (${age} yrs)` : "";
                              })()}
                            </span>
                          </span>
                        </p>
                      </div>

                      <div className="text-right text-[11px] text-neutral-500 space-y-1">
                        {selectedItem.approved_at && (
                          <p>
                            Approved at:{" "}
                            <span className="font-mono text-neutral-300">
                              {formatDateTime(selectedItem.approved_at)}
                            </span>
                          </p>
                        )}
                        {selectedItem.approvedBy && (
                          <p>
                            Approved by:{" "}
                            <span className="font-normal text-neutral-300">
                              {selectedApprovedByUser
                                ? getDisplayStaffName(selectedApprovedByUser)
                                : "Unknown staff"}
                            </span>
                          </p>
                        )}
                        <p>
                          Created:{" "}
                          <span className="font-mono text-neutral-300">
                            {formatDateTime(selectedItem.createdAt)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {selectedItem.nhs_number && (
                      <p className="text-[11px] text-neutral-400 mt-1">
                        NHS number:{" "}
                        <span className="font-mono text-neutral-200">
                          {selectedItem.nhs_number}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2-column layout: contact + addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-neutral-300 mb-1">
                    Contact details
                  </p>
                  <div className="flex items-center gap-2 text-[13px]">
                    <Mail className="h-4 w-4 text-neutral-500" />
                    <span className="truncate">
                      {selectedItem.email || "Not provided"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <Phone className="h-4 w-4 text-neutral-500" />
                    <span className="truncate">
                      {selectedItem.phone || "Not provided"}
                    </span>
                  </div>
                </div>

                {/* Home address */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-neutral-300 mb-1">
                    Home address
                  </p>
                  <div className="flex items-start gap-2 text-[13px]">
                    <MapPin className="h-4 w-4 text-neutral-500 mt-0.5" />
                    <div className="space-y-0.5">
                      <p>
                        {selectedItem.address || "Not provided"}
                        {selectedItem.address1
                          ? `, ${selectedItem.address1}`
                          : ""}
                        {selectedItem.address2
                          ? `, ${selectedItem.address2}`
                          : ""}
                      </p>
                      <p className="text-neutral-400">
                        {[selectedItem.city, selectedItem.postcode]
                          .filter(Boolean)
                          .join(", ") || " "}
                      </p>
                      <p className="text-neutral-500 text-[11px]">
                        {selectedItem.country || "United Kingdom"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery address */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-300">
                    Delivery address
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Uses alternative delivery:{" "}
                    <span className="font-semibold text-neutral-200">
                      {selectedItem.use_alt_delivery ? "Yes" : "No"}
                    </span>
                  </p>
                </div>
                <div className="flex items-start gap-2 text-[13px]">
                  <MapPin className="h-4 w-4 text-neutral-500 mt-0.5" />
                  <div className="space-y-0.5">
                    <p>
                      {selectedItem.delivery_address || selectedItem.address}
                      {selectedItem.delivery_address1
                        ? `, ${selectedItem.delivery_address1}`
                        : ""}
                      {selectedItem.delivery_address2
                        ? `, ${selectedItem.delivery_address2}`
                        : ""}
                    </p>
                    <p className="text-neutral-400">
                      {[
                        selectedItem.delivery_city || selectedItem.city,
                        selectedItem.delivery_postcode || selectedItem.postcode,
                      ]
                        .filter(Boolean)
                        .join(", ") || " "}
                    </p>
                    <p className="text-neutral-500 text-[11px]">
                      {selectedItem.delivery_country ||
                        selectedItem.country ||
                        "United Kingdom"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Exemption + consents */}
              <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1.2fr] gap-4">
                {/* Exemption card */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-neutral-300">
                    Prescription exemption
                  </p>
                  <p className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                    {formatExemption(selectedItem.exemption)}
                  </p>
                  {selectedItem.exemption_number && (
                    <p className="text-[11px] text-neutral-300">
                      Exemption number:{" "}
                      <span className="font-mono">
                        {selectedItem.exemption_number}
                      </span>
                    </p>
                  )}
                  {selectedItem.exemption_expiry && (
                    <p className="text-[11px] text-neutral-400">
                      Expires: {formatDate(selectedItem.exemption_expiry)}
                    </p>
                  )}
                </div>

                {/* Consent card */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-neutral-300">
                    Patient consents
                  </p>
                  <ul className="mt-1 space-y-1 text-[11px] text-neutral-300">
                    <li>
                      <span
                        className={
                          selectedItem.consent_patient
                            ? "text-emerald-300"
                            : "text-neutral-500"
                        }
                      >
                        ●
                      </span>{" "}
                      Consent to use Pharmacy Express as nominated pharmacy
                    </li>
                    <li>
                      <span
                        className={
                          selectedItem.consent_nomination
                            ? "text-emerald-300"
                            : "text-neutral-500"
                        }
                      >
                        ●
                      </span>{" "}
                      Nomination process explained
                    </li>
                    <li>
                      <span
                        className={
                          selectedItem.consent_exemption_signed
                            ? "text-emerald-300"
                            : "text-neutral-500"
                        }
                      >
                        ●
                      </span>{" "}
                      Exemption details signed/confirmed
                    </li>
                    <li>
                      <span
                        className={
                          selectedItem.consent_scr_access
                            ? "text-emerald-300"
                            : "text-neutral-500"
                        }
                      >
                        ●
                      </span>{" "}
                      Summary Care Record access consent
                    </li>
                  </ul>
                </div>
              </div>

              {/* Notes / approval text */}
              {(selectedItem.approval_note ||
                selectedItem.rejection_note ||
                (selectedItem.notes && selectedItem.notes.length > 0)) && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-neutral-300">
                    Notes
                  </p>
                  {selectedItem.approval_note && (
                    <div className="text-[11px] text-neutral-200">
                      <span className="font-semibold text-emerald-300">
                        Approval note:
                      </span>{" "}
                      {selectedItem.approval_note}
                    </div>
                  )}
                  {selectedItem.rejection_note && (
                    <div className="text-[11px] text-neutral-200">
                      <span className="font-semibold text-rose-300">
                        Rejection note:
                      </span>{" "}
                      {selectedItem.rejection_note}
                    </div>
                  )}
                  {selectedItem.notes && selectedItem.notes.length > 0 && (
                    <ul className="mt-1 space-y-1 text-[11px] text-neutral-300 list-disc list-inside">
                      {selectedItem.notes.map((n, idx) => (
                        <li key={idx}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
