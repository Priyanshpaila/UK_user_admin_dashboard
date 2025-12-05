"use client";

import React, { useEffect, useState } from "react";
import {
  getAppointmentsApi,
  updateAppointmentApi,
  type AppointmentDto,
  getUserByIdApi,
  type UserDto,
  getOrderByIdApi,
  type OrderDto,
} from "../../../api";
import {
  Loader2,
  CalendarClock,
  User,
  Stethoscope,
  Clock,
  Edit3,
  X,
  RefreshCw,
  Link2,
} from "lucide-react";

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

// Derive display name using appointment + user info
function getDisplayPatientName(
  appt: AppointmentDto,
  user?: UserDto | null
): string {
  if (appt.patient_name) return appt.patient_name;

  if (user) {
    const name =
      user.name ||
      user.fullName ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim();
    if (name) return name;
    if (user.email) return user.email;
  }

  return "Patient";
}

// Combine some extra details (email, phone, etc.)
function getPatientDetails(user?: UserDto | null): string {
  if (!user) return "";
  const email = user.email;
  const phone =
    (user as any).phone ||
    (user as any).mobile ||
    (user as any).phoneNumber;

  const parts: string[] = [];
  if (email) parts.push(email);
  if (phone) parts.push(phone);

  return parts.join(" • ");
}

// for <input type="datetime-local">
function toDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// status pill colours (appointments)
function appointmentStatusPillClass(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "pending")
    return "border-amber-500/70 bg-amber-500/10 text-amber-200";
  if (s === "confirmed")
    return "border-blue-500/70 bg-blue-500/10 text-blue-200";
  if (s === "cancelled")
    return "border-rose-500/70 bg-rose-500/10 text-rose-200";
  if (s === "completed")
    return "border-emerald-500/70 bg-emerald-500/10 text-emerald-200";
  if (s === "no-show" || s === "no_show" || s === "noshow")
    return "border-orange-500/70 bg-orange-500/10 text-orange-200";
  if (s === "rescheduled")
    return "border-violet-500/70 bg-violet-500/10 text-violet-200";

  return "border-neutral-500/60 bg-neutral-500/10 text-neutral-200";
}

function formatMoney(minor?: number | null) {
  if (minor == null) return "—";
  return `£${(minor / 100).toFixed(2)}`;
}

/* ----------------- page ----------------- */

export default function Page() {
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<AppointmentDto | null>(null);
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [editStart, setEditStart] = useState<string>(""); // datetime-local value
  const [editEnd, setEditEnd] = useState<string>(""); // datetime-local value
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [hostUrl, setHostUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // user cache: user_id -> user
  const [appointmentUsers, setAppointmentUsers] = useState<
    Record<string, UserDto | null>
  >({});

  // current order for editing drawer
  const [editingOrder, setEditingOrder] = useState<OrderDto | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  async function loadAppointments() {
    setLoading(true);
    setError(null);
    try {
      const res = await getAppointmentsApi();
      const list: AppointmentDto[] = Array.isArray((res as any).data)
        ? (res as any).data
        : Array.isArray(res)
        ? (res as any)
        : [];
      setAppointments(list);

      // 🔹 Fetch user details for all unique user_ids
      const uniqueUserIds = Array.from(
        new Set(
          list
            .map((a) => a.user_id as string | undefined)
            .filter(Boolean)
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
        for (const [id, user] of results) {
          map[id] = user;
        }
        setAppointmentUsers(map);
      } else {
        setAppointmentUsers({});
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAppointments();
  }, []);

  function openEdit(appt: AppointmentDto) {
    setEditing(appt);
    setEditStatus(appt.status || "pending");
    setEditStart(toDateTimeLocal(appt.start_at));
    setEditEnd(toDateTimeLocal(appt.end_at));
    setJoinUrl(appt.join_url || "");
    setHostUrl(appt.host_url || "");
    setSaveError(null);

    // reset order state and fetch order details
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
    !!editing &&
    (editStart !== originalStartInput || editEnd !== originalEndInput);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: any = {
        join_url: joinUrl || undefined,
        host_url: hostUrl || undefined,
      };

      if (editStart) {
        payload.start_at = new Date(editStart).toISOString();
      }
      if (editEnd) {
        payload.end_at = new Date(editEnd).toISOString();
      }

      // If time changed → status must be rescheduled
      if (hasTimeChanged) {
        payload.status = "rescheduled";
      } else {
        payload.status = editStatus;
      }

      const updated = await updateAppointmentApi(editing._id, payload);

      setAppointments((prev) =>
        prev.map((a) => (a._id === updated._id ? updated : a))
      );
      setEditing(null);
      setEditingOrder(null);
    } catch (e: any) {
      setSaveError(e?.message || "Failed to update appointment");
    } finally {
      setSaving(false);
    }
  }

  const editingUser =
    editing && editing.user_id ? appointmentUsers[editing.user_id] : null;
  const editingPatientName =
    editing && getDisplayPatientName(editing, editingUser);
  const editingPatientDetails = getPatientDetails(editingUser);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Appointments</h1>
          <p className="text-xs text-neutral-400">
            Review and manage upcoming appointments, including meeting links,
            reschedules and order details.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAppointments}
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

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !appointments.length && (
        <div className="flex items-center justify-center py-16 text-neutral-300 text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading appointments…
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && appointments.length === 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-6 text-center text-sm text-neutral-400">
          No appointments found.
        </div>
      )}

      {/* Grid list */}
      {appointments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {appointments.map((appt) => {
            const start = appt.start_at;
            const end = appt.end_at;

            const user =
              appt.user_id && appointmentUsers[appt.user_id]
                ? appointmentUsers[appt.user_id]
                : null;

            const patientName = getDisplayPatientName(appt, user);
            const patientDetails = getPatientDetails(user);

            return (
              <div
                key={appt._id}
                className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-emerald-500/50 transition-colors flex flex-col justify-between shadow-[0_0_12px_rgba(0,0,0,0.5)]"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-neutral-500">
                        Order ID:{" "}
                        <span className="font-mono text-neutral-100">
                          {appt.order_id || "—"}
                        </span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-neutral-100">
                        <User className="h-3.5 w-3.5 text-emerald-400" />
                        {patientName}
                      </p>
                      {patientDetails && (
                        <p className="ml-5 text-[11px] text-neutral-400">
                          {patientDetails}
                        </p>
                      )}
                      <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                        <Stethoscope className="h-3 w-3 text-neutral-500" />
                        {appt.service_name || "Service"}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${appointmentStatusPillClass(
                        appt.status
                      )}`}
                    >
                      {formatStatus(appt.status)}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-neutral-300">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-3.5 w-3.5 text-neutral-500" />
                      <span className="text-neutral-400">Start:</span>
                      <span className="text-neutral-100">
                        {formatDateTime(start)}
                      </span>
                    </div>
                    {end && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-neutral-500" />
                        <span className="text-neutral-400">End:</span>
                        <span className="text-neutral-100">
                          {formatDateTime(end)}
                        </span>
                      </div>
                    )}
                  </div>

                  {(appt.join_url || appt.host_url) && (
                    <div className="mt-2 space-y-1 text-[11px] text-neutral-300 border-t border-neutral-800 pt-2">
                      {appt.join_url && (
                        <div className="flex items-center gap-1">
                          <Link2 className="h-3 w-3 text-emerald-400" />
                          <span className="text-neutral-400">Join:</span>
                          <a
                            href={appt.join_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-300 hover:underline break-all"
                          >
                            {truncateUrl(appt.join_url)}
                          </a>
                        </div>
                      )}
                      {appt.host_url && (
                        <div className="flex items-center gap-1">
                          <Link2 className="h-3 w-3 text-neutral-400" />
                          <span className="text-neutral-400">Host:</span>
                          <a
                            href={appt.host_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-neutral-200 hover:underline break-all"
                          >
                            {truncateUrl(appt.host_url)}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
                  <span>
                    Created:{" "}
                    {appt.createdAt ? formatDateTime(appt.createdAt) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEdit(appt)}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-neutral-100 hover:border-emerald-500 hover:text-emerald-200"
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/40">
          <div className="h-full w-full max-w-md bg-neutral-950 border-l border-neutral-800 px-4 py-5 flex flex-col gap-4 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
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
                Date & time
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
                  <label className="text-[11px] text-neutral-400">
                    End (local)
                  </label>
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

            {saveError && (
              <div className="text-[11px] text-rose-300">{saveError}</div>
            )}

            {/* footer */}
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
