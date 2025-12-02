"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  getUserByIdApi,
  type OrderDto,
  type OrdersListMeta,
  type UserDto,
} from "../../../../api";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  CalendarDays,
  User,
  ArrowRight,
  Filter,
  X,
  ClipboardList,
  Mail,
  Phone,
} from "lucide-react";

/* ----------------- Helpers ----------------- */

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

function formatMoney(minor?: number | null) {
  if (minor == null) return "—";
  return `£${(minor / 100).toFixed(2)}`;
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-500/10 text-amber-300 border-amber-500/40";
    case "approved":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
    case "completed":
      return "bg-sky-500/10 text-sky-300 border-sky-500/40";
    case "draft":
      return "bg-neutral-500/15 text-neutral-300 border-neutral-500/40";
    case "cancelled":
    case "rejected":
      return "bg-rose-500/10 text-rose-300 border-rose-500/40";
    default:
      return "bg-neutral-500/10 text-neutral-300 border-neutral-500/40";
  }
}

function paymentBadgeClasses(status: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
    case "pending":
      return "bg-amber-500/10 text-amber-300 border-amber-500/40";
    case "failed":
      return "bg-rose-500/10 text-rose-300 border-rose-500/40";
    default:
      return "bg-neutral-500/10 text-neutral-300 border-neutral-500/40";
  }
}

function getDisplayPatientName(order: OrderDto, user?: UserDto | null): string {
  if (!order) return "Unknown";

  if ((order as any).patient_name) return (order as any).patient_name;

  const fromOrder = `${(order as any).first_name || ""} ${
    (order as any).last_name || ""
  }`.trim();
  if (fromOrder) return fromOrder;

  if (user) {
    const u: any = user;
    const fromUser =
      u.name ||
      u.fullName ||
      `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
      u.email;
    if (fromUser) return fromUser;
  }

  return "Unknown";
}

function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDobWithAge(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;

  const dateStr = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${dateStr} (${age} yrs)`;
}

function getUserInitials(user: UserDto | null): string {
  if (!user) return "PT";
  const u: any = user;
  const name =
    u.name ||
    u.fullName ||
    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
    u.email ||
    "";
  if (!name) return "PT";
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return initials.join("") || "PT";
}

function PatientProfileCard({ user }: { user: UserDto | null }) {
  if (!user) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
        <p className="text-xs text-neutral-400 mb-1">Patient profile</p>
        <p className="text-sm text-neutral-300">No patient details found.</p>
      </div>
    );
  }

  const u: any = user;
  const fullName =
    u.name ||
    u.fullName ||
    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
    "Unknown patient";

  const gender =
    u.gender && typeof u.gender === "string"
      ? u.gender.charAt(0).toUpperCase() + u.gender.slice(1)
      : null;

  const dobLabel = formatDobWithAge(u.dob);
  const createdAt = u.createdAt || u.created_at || null;
  const updatedAt = u.updatedAt || u.updated_at || null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
          <span className="text-xs font-semibold text-neutral-100">
            {getUserInitials(user)}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{fullName}</p>
          <p className="text-[11px] text-neutral-400">
            {gender ? gender : "Gender: —"}
            {dobLabel && (
              <>
                {" "}
                • <span>{dobLabel}</span>
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-300">
            {u.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3 text-neutral-500" />
                <span className="break-all">{u.email}</span>
              </span>
            )}
            {(u.phone || u.phoneNumber) && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-neutral-500" />
                <span>{u.phone || u.phoneNumber}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
        <div>
          <dt className="text-neutral-500">Address line 1</dt>
          <dd className="text-neutral-100">
            {u.address_line1 || u.addressLine1 || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Address line 2</dt>
          <dd className="text-neutral-100">
            {u.address_line2 || u.addressLine2 || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">City</dt>
          <dd className="text-neutral-100">{u.city || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">County</dt>
          <dd className="text-neutral-100">{u.county || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Postcode</dt>
          <dd className="text-neutral-100">{u.postalcode || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Country</dt>
          <dd className="text-neutral-100">{u.country || "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-4 text-[11px] text-neutral-500 pt-2 border-t border-neutral-800">
        <span>
          Created:{" "}
          <span className="text-neutral-200">
            {formatDateOnly(createdAt) || "—"}
          </span>
        </span>
        <span>
          Updated:{" "}
          <span className="text-neutral-200">
            {formatDateOnly(updatedAt) || "—"}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ----------------- Page ----------------- */

export default function Page() {
  // list state
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<OrdersListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cache of user info for cards: user_id -> user
  const [orderUsers, setOrderUsers] = useState<
    Record<string, UserDto | null>
  >({});

  // detail modal state
  const [showDetail, setShowDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [orderedByUser, setOrderedByUser] = useState<UserDto | null>(null);

  // 🔒 hard-coded filter
  const PAYMENT_STATUS = "pending";

  // 👉 derived notes for the currently selected order (detail modal)
  const adminNotesForDetail = useMemo(() => {
    if (!selectedOrder) return [] as string[];
    const raw =
      (selectedOrder as any).admin_notes ??
      (selectedOrder.meta as any)?.admin_notes ??
      [];
    if (Array.isArray(raw)) return raw.map((n) => String(n));
    if (raw == null) return [];
    return [String(raw)];
  }, [selectedOrder]);

  const consultantNotesForDetail = useMemo(() => {
    if (!selectedOrder) return [] as string[];
    const meta: any = selectedOrder.meta || {};
    const raw =
      meta.consultant_notes ??
      meta.consultantNotes ??
      meta.consultation_notes ??
      meta.consultationNotes ??
      [];
    if (Array.isArray(raw)) return raw.map((n) => String(n));
    if (raw == null) return [];
    return [String(raw)];
  }, [selectedOrder]);

  const hasAnyNotes =
    adminNotesForDetail.length > 0 || consultantNotesForDetail.length > 0;

  // Load list (unpaid)
  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOrdersApi({ payment_status: PAYMENT_STATUS });
        if (cancelled) return;
        const ordersList = res.data || [];
        setOrders(ordersList);
        setMeta(res.meta || null);

        const uniqueUserIds = Array.from(
          new Set(
            ordersList
              .map((o) => (o as any).user_id as string | undefined)
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
                console.error("Failed to fetch user for order list", id, err);
                return [id, null] as const;
              }
            })
          );

          if (!cancelled) {
            const map: Record<string, UserDto | null> = {};
            for (const [id, user] of results) {
              map[id] = user;
            }
            setOrderUsers(map);
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, []); // always "payment_status=pending"

  // View details handler
  async function handleViewDetails(id: string) {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedOrder(null);
    setOrderedByUser(null);

    try {
      const order = await getOrderByIdApi(id);
      setSelectedOrder(order);

      const userId = (order as any).user_id as string | undefined;
      if (userId) {
        try {
          const user = await getUserByIdApi(userId);
          setOrderedByUser(user);
        } catch (err) {
          console.error("Failed to fetch user for order (detail)", err);
        }
      }
    } catch (e: any) {
      setDetailError(e?.message || "Failed to load order details");
    } finally {
      setDetailLoading(false);
    }
  }

  const totalUnpaid = meta?.total ?? orders.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Unpaid Orders
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Orders with{" "}
            <span className="font-semibold text-amber-300">
              pending payment
            </span>
            . Review and chase payment, or update once payment is received.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300">
            <Filter size={14} />
            <span>Payment:</span>
            <span className="font-medium text-amber-300">Pending</span>
          </div>
          <span className="text-xs text-neutral-500">
            {totalUnpaid} unpaid order{totalUnpaid === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* List content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading orders…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-center text-neutral-400">
          No unpaid orders found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => {
            const totalMinor = order.meta?.totalMinor ?? null;
            const appointmentAt =
              order.meta?.appointment_start_at || order.start_at;
            const productName =
              order.meta?.selectedProduct?.name ||
              order.meta?.lines?.[0]?.name ||
              order.service_name;

            const userId = (order as any).user_id as string | undefined;
            const cardUser =
              userId && orderUsers[userId] !== undefined
                ? orderUsers[userId]
                : null;
            const patientName = getDisplayPatientName(order, cardUser);

            return (
              <div
                key={order._id}
                className="group flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 hover:border-emerald-500/50 hover:bg-neutral-900 transition-colors"
              >
                {/* Top: title + status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-white">
                        {productName}
                      </h2>
                      {order.status === "approved" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : order.status === "pending" ? (
                        <Clock className="h-4 w-4 text-amber-400" />
                      ) : order.status === "draft" ? (
                        <XCircle className="h-4 w-4 text-neutral-400" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      {order.service_name} • Ref:{" "}
                      <span className="font-mono">{order.reference}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                        statusBadgeClasses(order.status)
                      }
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                      {order.status.toUpperCase()}
                    </span>
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                        paymentBadgeClasses(order.payment_status)
                      }
                    >
                      <CreditCard className="h-3 w-3" />
                      {order.payment_status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Middle: patient + appointment */}
                <div className="mt-4 flex flex-col gap-2 text-xs text-neutral-300">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-neutral-400" />
                    <span className="font-medium">{patientName}</span>
                    {order.email && (
                      <span className="ml-2 truncate text-neutral-400">
                        {order.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-neutral-400" />
                    <span>{formatDateTime(appointmentAt)}</span>
                    {order.start_at && order.end_at && (
                      <>
                        <span className="mx-2 text-neutral-500">•</span>
                        <span className="text-neutral-400">
                          Duration:{" "}
                          {Math.max(
                            1,
                            Math.round(
                              (new Date(order.end_at).getTime() -
                                new Date(order.start_at).getTime()) /
                                60000
                            )
                          )}{" "}
                          min
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom: total + action */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-neutral-400">Total:</span>{" "}
                    <span className="font-semibold text-white">
                      {formatMoney(totalMinor)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleViewDetails(order._id)}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-200 hover:border-emerald-500 hover:text-emerald-300 group-hover:border-emerald-500"
                  >
                    View details
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🔹 Detail modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 md:px-6">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">
                  Order details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="rounded-full p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[80vh] overflow-y-auto px-5 py-4 space-y-4 text-sm text-neutral-200">
              {detailLoading && (
                <div className="flex items-center justify-center py-10 text-neutral-300">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading order…
                </div>
              )}

              {detailError && !detailLoading && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
                  {detailError}
                </div>
              )}

              {!detailLoading && !detailError && selectedOrder && (
                <>
                  {/* Top summary */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-neutral-400 mb-0.5">
                        Reference
                      </p>
                      <p className="font-mono text-sm text-white">
                        {selectedOrder.reference}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        Service:{" "}
                        <span className="font-medium">
                          {selectedOrder.service_name}
                        </span>{" "}
                        ({selectedOrder.service_slug})
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                          statusBadgeClasses(selectedOrder.status)
                        }
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        {selectedOrder.status.toUpperCase()}
                      </span>
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                          paymentBadgeClasses(selectedOrder.payment_status)
                        }
                      >
                        <CreditCard className="h-3 w-3" />
                        {selectedOrder.payment_status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Patient profile + appointment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <PatientProfileCard user={orderedByUser} />
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                      <p className="text-xs text-neutral-400 mb-0.5">
                        Appointment
                      </p>
                      <p className="text-sm text-white">
                        {formatDateTime(
                          selectedOrder.meta?.appointment_start_at ||
                            selectedOrder.start_at
                        )}
                      </p>
                      <p className="text-xs text-neutral-400">
                        End: {formatDateTime(selectedOrder.end_at)}
                      </p>
                    </div>
                  </div>

                  {/* Items / lines */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-neutral-300" />
                        <p className="text-xs font-semibold text-neutral-200">
                          Items
                        </p>
                      </div>
                      <p className="text-xs text-neutral-400">
                        Total:{" "}
                        <span className="font-semibold text-white">
                          {formatMoney(selectedOrder.meta?.totalMinor)}
                        </span>
                      </p>
                    </div>

                    {selectedOrder.meta?.items?.length ? (
                      <div className="space-y-1">
                        {selectedOrder.meta.items.map(
                          (it: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 border-b border-neutral-800/60 last:border-none"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-white">
                                  {it.name}
                                </span>
                                <span className="text-[11px] text-neutral-400">
                                  {it.variation || it.variations || "Standard"}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[11px] text-neutral-400">
                                  Qty: {it.qty}
                                </span>
                                <span className="block text-[11px] text-neutral-300">
                                  {formatMoney(it.totalMinor)}
                                </span>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        No items found on this order.
                      </p>
                    )}
                  </div>

                  {/* 🔹 Admin + Consultation notes */}
                  {hasAnyNotes && (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3 space-y-3">
                      <p className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-neutral-300" />
                        Notes
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold text-neutral-400 mb-1">
                            Admin notes
                          </p>
                          {adminNotesForDetail.length ? (
                            <ul className="space-y-1">
                              {adminNotesForDetail.map((note, idx) => (
                                <li
                                  key={idx}
                                  className="text-xs text-neutral-200 leading-snug"
                                >
                                  • {note}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-neutral-500">
                              No admin notes.
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-neutral-400 mb-1">
                            Consultation notes
                          </p>
                          {consultantNotesForDetail.length ? (
                            <ul className="space-y-1">
                              {consultantNotesForDetail.map((note, idx) => (
                                <li
                                  key={idx}
                                  className="text-xs text-neutral-200 leading-snug"
                                >
                                  • {note}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-neutral-500">
                              No consultation notes.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RAF Preview */}
                  {/* {selectedOrder.meta?.formsQA?.raf?.qa?.length ? (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                      <p className="text-xs font-semibold text-neutral-200 mb-2">
                        RAF Answers (preview)
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {selectedOrder.meta.formsQA.raf.qa.map(
                          (qa: any, idx: number) => (
                            <div
                              key={idx}
                              className="text-[11px] border-b border-neutral-800/60 pb-1 last:border-none"
                            >
                              <p className="text-neutral-400">
                                {qa.question || qa.key}
                              </p>
                              <p className="text-neutral-100">
                                {qa.answer ?? "—"}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : null} */}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
