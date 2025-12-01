"use client";

import React, { useEffect, useState } from "react";
import {
  getAppointmentsApi,
  updateAppointmentApi,
  type AppointmentDto,
  getUserByIdApi,
  type UserDto,
} from "../../../api"; // ⬅️ same api file
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
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

export default function Page() {
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<AppointmentDto | null>(null);
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [hostUrl, setHostUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // user cache: user_id -> user
  const [appointmentUsers, setAppointmentUsers] = useState<
    Record<string, UserDto | null>
  >({});

  async function loadAppointments() {
    setLoading(true);
    setError(null);
    try {
      const res = await getAppointmentsApi(); // you can pass filters if needed
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
    setJoinUrl(appt.join_url || "");
    setHostUrl(appt.host_url || "");
    setSaveError(null);
  }

  function closeEdit() {
    setEditing(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateAppointmentApi(editing._id, {
        status: editStatus,
        join_url: joinUrl || undefined,
        host_url: hostUrl || undefined,
      });

      setAppointments((prev) =>
        prev.map((a) => (a._id === updated._id ? updated : a))
      );
      setEditing(null);
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
            View and update patient appointments, including Zoom links.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAppointments}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {!loading && <RefreshCw className="h-3 w-3" />}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                className="p-4 rounded-lg bg-neutral-900/80 border border-neutral-800 hover:border-emerald-500/50 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-neutral-400">
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
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                        (appt.status || "").toLowerCase() === "completed"
                          ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                          : (appt.status || "").toLowerCase() === "cancelled"
                          ? "border-rose-500/70 bg-rose-500/10 text-rose-200"
                          : "border-amber-500/70 bg-amber-500/10 text-amber-200"
                      }`}
                    >
                      {formatStatus(appt.status)}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-neutral-300">
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
                    <div className="mt-2 space-y-1 text-[11px] text-neutral-300">
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
                    {appt.createdAt
                      ? formatDateTime(appt.createdAt)
                      : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEdit(appt)}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-neutral-100 hover:border-emerald-500 hover:text-emerald-200"
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
          <div className="h-full w-full max-w-md bg-neutral-950 border-l border-neutral-800 px-4 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-neutral-400">Edit appointment</p>
                <p className="text-sm font-semibold text-white">
                  {editing.order_id}
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
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 p-1 text-neutral-300 hover:border-rose-500 hover:text-rose-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-300">
              <div>
                <p className="text-neutral-400 mb-0.5">Start time</p>
                <p className="font-mono text-neutral-100">
                  {formatDateTime(editing.start_at)}
                </p>
              </div>
              <div>
                <p className="text-neutral-400 mb-0.5">End time</p>
                <p className="font-mono text-neutral-100">
                  {formatDateTime(editing.end_at)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-300">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

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

            {saveError && (
              <div className="text-[11px] text-rose-300">{saveError}</div>
            )}

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
