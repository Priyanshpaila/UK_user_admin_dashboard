"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getAppointmentsApi,
  updateAppointmentApi,
  type AppointmentDto,
  getUserByIdApi,
  type UserDto,
  getOrderByIdApi,
  type OrderDto,
  sendEmailApi,
} from "../../../api";
import {
  Loader2,
  CalendarClock,
  User,
  Stethoscope,
  Clock,
  X,
  RefreshCw,
  Link2,
  Filter,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  CalendarX2,
  ArrowRight,
  ClipboardList,
} from "lucide-react";

/* ----------------- email constants ----------------- */

const RESCHEDULE_TEMPLATE = "rescheduleapp"; // ✅ hard-coded template name
const SUPPORT_EMAIL_FALLBACK = "support@pharmacyexpress.co.uk";
const TIMEZONE_FALLBACK = "Europe/London";

/* ----------------- helpers ----------------- */

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

function formatStatus(status?: string) {
  if (!status) return "Unknown";
  return status
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncateUrl(url?: string, max = 40) {
  if (!url) return "";
  if (url.length <= max) return url;
  return url.slice(0, max - 3) + "...";
}

function getDisplayPatientName(appt: AppointmentDto, user?: UserDto | null): string {
  if (appt.patient_name) return appt.patient_name;

  if (user) {
    const name =
      (user as any).name ||
      (user as any).fullName ||
      `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim();
    if (name) return name;
    if ((user as any).email) return (user as any).email;
  }

  return "Patient";
}

function getPatientDetails(user?: UserDto | null): string {
  if (!user) return "";
  const email = (user as any).email;
  const phone = (user as any).phone || (user as any).mobile || (user as any).phoneNumber;

  const parts: string[] = [];
  if (email) parts.push(email);
  if (phone) parts.push(phone);

  return parts.join(" • ");
}

function getInitialsFromName(name?: string) {
  const full = String(name || "").trim();
  if (!full) return "PT";
  const parts = full.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return initials.join("") || "PT";
}

function toDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function appointmentStatusPillClass(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "pending") return "border-amber-500/70 bg-amber-500/10 text-amber-200";
  if (s === "confirmed") return "border-blue-500/70 bg-blue-500/10 text-blue-200";
  if (s === "cancelled") return "border-rose-500/70 bg-rose-500/10 text-rose-200";
  if (s === "completed") return "border-emerald-500/70 bg-emerald-500/10 text-emerald-200";
  if (s === "no-show" || s === "no_show" || s === "noshow")
    return "border-orange-500/70 bg-orange-500/10 text-orange-200";
  if (s === "rescheduled") return "border-violet-500/70 bg-violet-500/10 text-violet-200";
  return "border-neutral-500/60 bg-neutral-500/10 text-neutral-200";
}

function formatMoney(minor?: number | null) {
  if (minor == null) return "—";
  return `£${(minor / 100).toFixed(2)}`;
}

function splitEmailDateTime(value?: string | null): { date?: string; time?: string } {
  if (!value) return {};
  const d = new Date(value);
  if (isNaN(d.getTime())) return {};
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time };
}

type StatusFilter =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "rescheduled"
  | "no-show"
  | "all";

const FILTERS: { key: StatusFilter; label: string; icon: any }[] = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: BadgeCheck },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "cancelled", label: "Cancelled", icon: XCircle },
  { key: "rescheduled", label: "Rescheduled", icon: CalendarX2 },
  { key: "no-show", label: "No-show", icon: CalendarX2 },
  { key: "all", label: "All", icon: Filter },
];

/* ----------------- page ----------------- */

export default function Page() {
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ filters (pending default)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  const [editing, setEditing] = useState<AppointmentDto | null>(null);
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [editStart, setEditStart] = useState<string>("");
  const [editEnd, setEditEnd] = useState<string>("");
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [hostUrl, setHostUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [notice, setNotice] = useState<{
    type: "success" | "warn";
    message: string;
  } | null>(null);

  const [appointmentUsers, setAppointmentUsers] = useState<Record<string, UserDto | null>>({});

  const [editingOrder, setEditingOrder] = useState<OrderDto | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  /* ----------------- pagination (NEW) ----------------- */

  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20); // default stays 20, now user can change
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  async function loadAppointments(
    filter: StatusFilter = statusFilter,
    opts?: { page?: number; limit?: number; append?: boolean }
  ) {
    const nextPage = typeof opts?.page === "number" ? opts.page : 1;
    const nextLimit = typeof opts?.limit === "number" ? opts.limit : limit;
    const append = !!opts?.append;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    setError(null);
    setNotice(null);

    try {
      // ✅ call backend with status when not "all", and pass page/limit
      const res =
        filter === "all"
          ? await getAppointmentsApi({ page: nextPage, limit: nextLimit })
          : await getAppointmentsApi({ status: filter, page: nextPage, limit: nextLimit });

      const list: AppointmentDto[] = Array.isArray((res as any).data)
        ? (res as any).data
        : Array.isArray(res)
        ? (res as any)
        : [];

      // ✅ UI safety filter (in case backend ignores query)
      const filtered =
        filter === "all"
          ? list
          : list.filter((a) => (a.status || "").toLowerCase() === filter);

      // ✅ append vs replace
      const nextAppointments = append ? [...appointments, ...filtered] : filtered;
      setAppointments(nextAppointments);

      // ✅ determine hasMore (prefer meta if available; fallback to "got less than limit")
      const meta = (res as any)?.meta;
      const metaHasMore =
        meta && typeof meta === "object"
          ? (typeof meta.hasMore === "boolean" ? meta.hasMore : undefined)
          : undefined;

      const computedHasMore =
        typeof metaHasMore === "boolean" ? metaHasMore : list.length >= nextLimit;

      setHasMore(computedHasMore);
      setPage(nextPage);
      setLimit(nextLimit);

      // ✅ fetch users for the appointments we have (existing logic, but supports append)
      const uniqueUserIds = Array.from(
        new Set(
          nextAppointments.map((a) => a.user_id as string | undefined).filter(Boolean)
        )
      ) as string[];

      if (uniqueUserIds.length) {
        const results = await Promise.all(
          uniqueUserIds.map(async (id) => {
            try {
              const user = await getUserByIdApi(id);
              return [id, user] as const;
            } catch (err) {
              console.error("Failed to fetch user for appointment", id, err);
              return [id, null] as const;
            }
          })
        );

        const map: Record<string, UserDto | null> = {};
        for (const [id, user] of results) map[id] = user;
        setAppointmentUsers(map);
      } else {
        setAppointmentUsers({});
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load appointments");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // initial + when filter changes (reset pagination)
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    void loadAppointments(statusFilter, { page: 1, limit, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openEdit(appt: AppointmentDto) {
    setEditing(appt);
    setEditStatus(appt.status || "pending");
    setEditStart(toDateTimeLocal(appt.start_at));
    setEditEnd(toDateTimeLocal(appt.end_at));
    setJoinUrl(appt.join_url || "");
    setHostUrl(appt.host_url || "");
    setSaveError(null);
    setNotice(null);

    setEditingOrder(null);
    setOrderError(null);

    if (appt.order_id) {
      setOrderLoading(true);
      (async () => {
        try {
          const order = await getOrderByIdApi(appt.order_id);
          setEditingOrder(order);
        } catch (e: any) {
          setOrderError(e?.message || "Failed to load order details");
        } finally {
          setOrderLoading(false);
        }
      })();
    } else {
      setOrderLoading(false);
    }
  }

  function closeEdit() {
    setEditing(null);
    setSaveError(null);
    setEditingOrder(null);
    setOrderError(null);
    setOrderLoading(false);
  }

  const originalStartInput = editing ? toDateTimeLocal(editing.start_at) : "";
  const originalEndInput = editing ? toDateTimeLocal(editing.end_at) : "";
  const hasTimeChanged =
    !!editing && (editStart !== originalStartInput || editEnd !== originalEndInput);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    setNotice(null);

    // snapshot BEFORE update (for reschedule email)
    const prevStatus = String(editing.status || "").toLowerCase();
    const prevStartIso = editing.start_at || null;
    const prevEndIso = editing.end_at || null;

    try {
      const payload: any = {
        join_url: joinUrl || undefined,
        host_url: hostUrl || undefined,
      };

      if (editStart) payload.start_at = new Date(editStart).toISOString();
      if (editEnd) payload.end_at = new Date(editEnd).toISOString();

      const intendedStatus = hasTimeChanged ? "rescheduled" : editStatus;
      payload.status = intendedStatus;

      const updated = await updateAppointmentApi(editing._id, payload);

      // update local list
      setAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)));

      // ✅ if we are in a filtered view, drop the row if it no longer matches
      const f = statusFilter;
      if (f !== "all" && (updated.status || "").toLowerCase() !== f) {
        setAppointments((prev) => prev.filter((a) => a._id !== updated._id));
      }

      /* ----------------- SEND RESCHEDULE EMAIL ----------------- */
      const newStatus = String(updated.status || intendedStatus || "").toLowerCase();
      const becameRescheduled = newStatus === "rescheduled";
      const shouldSendRescheduleEmail =
        becameRescheduled && (hasTimeChanged || prevStatus !== "rescheduled");

      if (shouldSendRescheduleEmail) {
        try {
          // ensure we have a user object (email)
          let patientUser: UserDto | null =
            (editing.user_id && appointmentUsers[editing.user_id]) || null;

          if (!patientUser && editing.user_id) {
            try {
              patientUser = await getUserByIdApi(editing.user_id);
            } catch (e) {
              console.error("Failed to refetch patient user for email", e);
            }
          }

          // ensure we have order ref/email fallback
          let orderRef = editingOrder?.reference || "";
          let orderEmail = (editingOrder as any)?.email || "";
          if ((!orderRef || !orderEmail) && updated.order_id) {
            try {
              const ord = await getOrderByIdApi(updated.order_id);
              orderRef = orderRef || ord?.reference || "";
              orderEmail = orderEmail || (ord as any)?.email || "";
            } catch (e) {
              console.error("Failed to refetch order for email", e);
            }
          }

          const patientEmail =
            (patientUser as any)?.email ||
            (updated as any)?.email ||
            orderEmail ||
            "";

          if (!patientEmail) {
            setNotice({
              type: "warn",
              message:
                "Appointment rescheduled, but patient email was not found (email not sent).",
            });
          } else {
            const patientName = getDisplayPatientName(updated, patientUser);
            const serviceName = updated.service_name || editing.service_name || "Service";

            const prevParts = splitEmailDateTime(prevStartIso);
            const newParts = splitEmailDateTime(
              updated.start_at || payload.start_at || prevStartIso
            );

            const prevEndParts = splitEmailDateTime(prevEndIso);
            const newEndParts = splitEmailDateTime(
              updated.end_at || payload.end_at || prevEndIso
            );

            // appointment ref fallback
            const appointmentRef =
              (updated as any).reference || (editing as any).reference || updated._id;

            // use join_url as "manageUrl" if you want a clickable CTA in email
            const manageUrl =
              updated.join_url ||
              (typeof window !== "undefined" ? `${window.location.origin}` : "");

            await sendEmailApi({
              to: patientEmail,
              subject: "Appointment Rescheduled",
              template: RESCHEDULE_TEMPLATE, // ✅ hardcoded template
              context: {
                subject: "Your appointment has been rescheduled",
                name: patientName,

                appointmentRef,
                orderRef: orderRef || updated.order_id || "",

                serviceName,

                oldDate: prevParts.date,
                oldTime: prevParts.time,
                // optional: show old end too (if you use it in template)
                oldEndTime: prevEndParts.time,

                newDate: newParts.date,
                newTime: newParts.time,
                // optional: show new end too (if you use it in template)
                newEndTime: newEndParts.time,

                timezone: TIMEZONE_FALLBACK,

                manageUrl,

                supportEmail: SUPPORT_EMAIL_FALLBACK,
                year: String(new Date().getFullYear()),
              },
            });

            setNotice({
              type: "success",
              message: "Appointment updated and reschedule email sent to patient.",
            });
          }
        } catch (mailErr: any) {
          console.error("Reschedule email failed:", mailErr);
          setNotice({
            type: "warn",
            message:
              mailErr?.message ||
              "Appointment rescheduled, but failed to send email to patient.",
          });
        }
      }

      setEditing(null);
      setEditingOrder(null);
    } catch (e: any) {
      setSaveError(e?.message || "Failed to update appointment");
    } finally {
      setSaving(false);
    }
  }

  const editingUser = editing && editing.user_id ? appointmentUsers[editing.user_id] : null;
  const editingPatientName = editing && getDisplayPatientName(editing, editingUser);
  const editingPatientDetails = getPatientDetails(editingUser);

  const activeFilterLabel = useMemo(() => {
    return FILTERS.find((f) => f.key === statusFilter)?.label || "Pending";
  }, [statusFilter]);

  const rows = useMemo(() => {
    return appointments.map((appt) => {
      const user =
        appt.user_id && appointmentUsers[appt.user_id] ? appointmentUsers[appt.user_id] : null;

      const patientName = getDisplayPatientName(appt, user);
      const patientDetails = getPatientDetails(user);

      const created = (appt as any).createdAt || (appt as any).created_at || null;

      return {
        appt,
        user,
        patientName,
        patientDetails,
        created,
      };
    });
  }, [appointments, appointmentUsers]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">
            Appointments
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Filter:{" "}
            <span className="text-neutral-200 font-semibold">{activeFilterLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Rows per page (NEW) */}
          <div className="flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200">
            <span className="text-neutral-400">Rows</span>
            <select
              value={limit}
              onChange={(e) => {
                const v = Number(e.target.value || 20);
                setLimit(v);
                setPage(1);
                setHasMore(true);
                void loadAppointments(statusFilter, { page: 1, limit: v, append: false });
              }}
              className="rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setPage(1);
              setHasMore(true);
              void loadAppointments(statusFilter, { page: 1, limit, append: false });
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
              : "border-amber-500/40 bg-amber-950/30 text-amber-100"
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500 hover:text-white"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-emerald-300" : "text-neutral-400"}`} />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {/* Loading (initial) */}
      {loading && !appointments.length && (
        <div className="flex items-center justify-center py-20 text-neutral-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading appointments…
        </div>
      )}

      {/* Empty */}
      {!loading && !error && rows.length === 0 && (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-center text-neutral-400">
          No appointments found.
        </div>
      )}

      {/* LIST FORM (table) */}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-900/80 text-[11px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Order ID</th>
                  <th className="px-3 py-2 text-left font-medium">Patient</th>
                  <th className="px-3 py-2 text-left font-medium">Service</th>
                  <th className="px-3 py-2 text-left font-medium">Start</th>
                  <th className="px-3 py-2 text-left font-medium">End</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Links</th>
                  <th className="px-3 py-2 text-left font-medium">Created</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>

              <tbody>
                {rows.map(({ appt, patientName, patientDetails, created }) => {
                  const initials = getInitialsFromName(patientName);

                  return (
                    <tr
                      key={appt._id}
                      className="cursor-pointer border-t border-neutral-900/80 bg-neutral-950/40 hover:bg-neutral-900/60"
                      onClick={() => openEdit(appt)}
                    >
                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        <div className="flex items-center gap-1">
                          <ClipboardList className="h-3.5 w-3.5 text-neutral-500" />
                          <span className="font-mono text-[11px] text-neutral-100">
                            {appt.order_id || "—"}
                          </span>
                        </div>
                      </td>

                      <td className="max-w-xs px-3 py-2 align-middle">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-[10px] font-semibold text-neutral-100">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-neutral-100">
                              {patientName}
                            </p>
                            <p className="truncate text-[10px] text-neutral-500">
                              {patientDetails || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="max-w-xs px-3 py-2 align-middle">
                        <p className="line-clamp-2 text-[11px] text-neutral-100">
                          {appt.service_name || "Service"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2 align-middle text-[11px] text-neutral-200">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5 text-neutral-500" />
                          {formatDateTime(appt.start_at)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2 align-middle text-[11px] text-neutral-200">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-neutral-500" />
                          {formatDateTime(appt.end_at)}
                        </span>
                      </td>

                      <td className="px-3 py-2 align-middle">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-medium border ${appointmentStatusPillClass(
                            appt.status
                          )}`}
                        >
                          {formatStatus(appt.status)}
                        </span>
                      </td>

                      <td className="px-3 py-2 align-middle">
                        {appt.join_url || appt.host_url ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {appt.join_url && (
                              <a
                                href={appt.join_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200 hover:border-emerald-500/70"
                                title={appt.join_url}
                              >
                                <Link2 className="h-3 w-3" />
                                Join: {truncateUrl(appt.join_url, 18)}
                              </a>
                            )}
                            {appt.host_url && (
                              <a
                                href={appt.host_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] text-neutral-200 hover:border-neutral-500"
                                title={appt.host_url}
                              >
                                <Link2 className="h-3 w-3 text-neutral-400" />
                                Host: {truncateUrl(appt.host_url, 18)}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-500">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2 align-middle text-[11px] text-neutral-300">
                        {formatDateTime(created)}
                      </td>

                      <td className="px-3 py-2 text-right align-middle">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(appt);
                          }}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                        >
                          <span>Edit</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-neutral-800 bg-neutral-950/40 px-3 py-2 text-[11px] text-neutral-500 flex flex-wrap items-center justify-between gap-2">
            <div>
              Showing <span className="text-neutral-200">{rows.length}</span>{" "}
              appointment{rows.length === 1 ? "" : "s"}
              {statusFilter !== "all" ? (
                <>
                  {" "}
                  in <span className="text-neutral-200">{activeFilterLabel}</span>
                </>
              ) : null}
              .
            </div>

            {/* Load more (NEW) */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">
                Page <span className="text-neutral-300">{page}</span>
              </span>

              <button
                type="button"
                disabled={loadingMore || loading || !hasMore}
                onClick={() =>
                  loadAppointments(statusFilter, { page: page + 1, limit, append: true })
                }
                className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {hasMore ? (loadingMore ? "Loading…" : "Load more") : "No more"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40">
          <div className="h-full w-full max-w-md bg-neutral-950 border-l border-neutral-800 px-4 py-5 flex flex-col gap-4 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden">
            {/* ✅ SCROLL AREA START */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
              {/* header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-[11px] text-neutral-400">Edit appointment</p>
                  <p className="text-sm font-semibold text-white">
                    {editing.order_id || "No order ID"}
                  </p>
                  {editingPatientName && (
                    <p className="mt-0.5 text-xs text-neutral-300 flex items-center gap-1">
                      <User className="h-3 w-3 text-emerald-400" />
                      {editingPatientName}
                    </p>
                  )}
                  {editingPatientDetails && (
                    <p className="ml-4 text-[11px] text-neutral-500">
                      {editingPatientDetails}
                    </p>
                  )}
                  {editing.service_name && (
                    <p className="mt-1 text-[11px] text-neutral-400 flex items-center gap-1">
                      <Stethoscope className="h-3 w-3 text-neutral-600" />
                      {editing.service_name}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="inline-flex items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 p-1 text-neutral-300 hover:border-rose-500 hover:text-rose-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* time controls */}
              <div className="space-y-2 text-xs text-neutral-300 rounded-lg bg-neutral-900/60 border border-neutral-800 px-3 py-3">
                <p className="text-[11px] font-semibold text-neutral-200 mb-1">
                  Date &amp; time
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-[11px] text-neutral-400">
                      Start (local)
                    </label>
                    <input
                      type="datetime-local"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      className="mt-1 w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400">End (local)</label>
                    <input
                      type="datetime-local"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      className="mt-1 w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                {hasTimeChanged && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-300">
                    <Clock className="h-3 w-3" />
                    Time changed – this appointment will be marked as{" "}
                    <span className="font-semibold">Rescheduled</span>.
                  </p>
                )}
              </div>

              {/* status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-neutral-300">Status</label>
                  {hasTimeChanged && (
                    <span className="text-[10px] text-neutral-500">
                      Locked to <span className="font-semibold">Rescheduled</span>{" "}
                      due to time change
                    </span>
                  )}
                </div>
                <select
                  value={hasTimeChanged ? "rescheduled" : editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  disabled={hasTimeChanged}
                  className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                  <option value="no-show">No-show</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>

              {/* URLs */}
              <div className="space-y-2">
                <label className="text-xs text-neutral-300 flex items-center gap-1">
                  <Link2 className="h-3 w-3 text-emerald-400" />
                  Join URL (for patient)
                </label>
                <input
                  type="url"
                  value={joinUrl}
                  onChange={(e) => setJoinUrl(e.target.value)}
                  className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500"
                  placeholder="https://zoom.us/j/..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-300 flex items-center gap-1">
                  <Link2 className="h-3 w-3 text-neutral-400" />
                  Host URL (for pharmacist)
                </label>
                <input
                  type="url"
                  value={hostUrl}
                  onChange={(e) => setHostUrl(e.target.value)}
                  className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500"
                  placeholder="https://zoom.us/s/..."
                />
              </div>

              {/* Order details */}
              <div className="space-y-2 rounded-lg bg-neutral-900/60 border border-neutral-800 px-3 py-3 text-xs text-neutral-300">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-neutral-200">
                    Order details
                  </p>
                  {editingOrder?.reference && (
                    <span className="text-[11px] text-neutral-400">
                      Ref:{" "}
                      <span className="font-mono text-neutral-100">
                        {editingOrder.reference}
                      </span>
                    </span>
                  )}
                </div>

                {orderLoading && (
                  <p className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading order…
                  </p>
                )}

                {orderError && (
                  <p className="text-[11px] text-rose-300">{orderError}</p>
                )}

                {!orderLoading && !orderError && !editingOrder && (
                  <p className="text-[11px] text-neutral-500">
                    No linked order found for this appointment.
                  </p>
                )}

                {!orderLoading && !orderError && editingOrder && (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {editingOrder.status && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 border ${appointmentStatusPillClass(
                            editingOrder.status
                          )}`}
                        >
                          {formatStatus(editingOrder.status)}
                        </span>
                      )}
                      {editingOrder.payment_status && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-neutral-600 bg-neutral-900 text-[11px] text-neutral-200">
                          Payment: {formatStatus(editingOrder.payment_status)}
                        </span>
                      )}
                    </div>

                    {editingOrder.meta?.items?.length ? (
                      <div className="mt-2 space-y-1 border-t border-neutral-800 pt-2">
                        {editingOrder.meta.items.map((it: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] py-1 border-b border-neutral-800 last:border-none"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-neutral-100">
                                {it.name}
                              </span>
                              <span className="text-[10px] text-neutral-400">
                                {it.variation || it.variations || "Standard"}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[10px] text-neutral-400">
                                Qty: {it.qty}
                              </span>
                              <span className="block text-[10px] text-neutral-300">
                                {formatMoney(it.totalMinor)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-neutral-500">
                        No line items on this order.
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 text-[11px]">
                      <span className="text-neutral-400">Total amount</span>
                      <span className="font-semibold text-neutral-100">
                        {formatMoney(editingOrder.meta?.totalMinor)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {saveError && <div className="text-[11px] text-rose-300">{saveError}</div>}
            </div>
            {/* ✅ SCROLL AREA END */}

            {/* footer (kept EXACT as you had it) */}
            <div className="mt-auto flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-neutral-200 hover:border-neutral-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/80 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
