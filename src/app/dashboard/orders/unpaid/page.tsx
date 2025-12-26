"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  getUserByIdApi,
  getBackendBase,
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
  User as UserIcon,
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
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return initials.join("") || "PT";
}

/* ----------------- Robust unwrap helpers (matches your other page) ----------------- */

function unwrapOrdersList(res: any): { orders: OrderDto[]; meta: OrdersListMeta | null } {
  const orders = (res?.data ??
    res?.orders ??
    res?.items ??
    (Array.isArray(res) ? res : [])) as OrderDto[];
  const meta = (res?.meta ?? res?.pagination ?? null) as OrdersListMeta | null;
  return { orders: Array.isArray(orders) ? orders : [], meta };
}

function unwrapOrder(res: any): OrderDto {
  return (res?.data ?? res?.order ?? res) as OrderDto;
}

function unwrapUser(res: any): UserDto | null {
  if (!res) return null;
  const u = (res?.data ?? res?.user ?? res) as any;
  if (!u || typeof u !== "object") return null;
  return u as UserDto;
}

function idOf(o: any) {
  return String(o?._id || o?.id || "");
}

function extractUserIdFromOrder(order: any): string | null {
  return (
    (order?.user_id as string) ||
    (order?.userId as string) ||
    (order?.user?._id as string) ||
    null
  );
}

function extractTotalMinor(order: any): number | null {
  return (
    order?.meta?.totalMinor ??
    order?.meta?.total_minor ??
    order?.total_minor ??
    order?.totalMinor ??
    null
  );
}

function extractAppointmentStart(order: any): string | null {
  return (
    order?.meta?.appointment_start_at ??
    order?.meta?.appointmentStartAt ??
    order?.start_at ??
    order?.startAt ??
    null
  );
}

function extractProductName(order: any): string {
  return (
    order?.meta?.selectedProduct?.name ||
    order?.meta?.lines?.[0]?.name ||
    order?.meta?.items?.[0]?.name ||
    order?.service_name ||
    "Order"
  );
}

function PatientProfileCard({ user }: { user: UserDto | null }) {
  if (!user) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
        <p className="mb-1 text-xs text-neutral-400">Patient profile</p>
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
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800">
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

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Address line 1</dt>
          <dd className="text-neutral-100">{u.address_line1 || u.addressLine1 || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Address line 2</dt>
          <dd className="text-neutral-100">{u.address_line2 || u.addressLine2 || "—"}</dd>
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
          <dd className="text-neutral-100">{u.postalcode || u.postcode || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Country</dt>
          <dd className="text-neutral-100">{u.country || "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-4 border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
        <span>
          Created:{" "}
          <span className="text-neutral-200">{formatDateOnly(createdAt) || "—"}</span>
        </span>
        <span>
          Updated:{" "}
          <span className="text-neutral-200">{formatDateOnly(updatedAt) || "—"}</span>
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

  // cache of users for list: user_id -> user
  const [orderUsers, setOrderUsers] = useState<Record<string, UserDto | null>>({});
  const orderUsersRef = useRef<Record<string, UserDto | null>>({});
  useEffect(() => {
    orderUsersRef.current = orderUsers;
  }, [orderUsers]);

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
      (selectedOrder as any).meta?.admin_notes ??
      [];
    if (Array.isArray(raw)) return raw.map((n) => String(n));
    if (raw == null) return [];
    return [String(raw)];
  }, [selectedOrder]);

  const consultantNotesForDetail = useMemo(() => {
    if (!selectedOrder) return [] as string[];
    const metaAny: any = (selectedOrder as any).meta || {};
    const raw =
      metaAny.consultant_notes ??
      metaAny.consultantNotes ??
      metaAny.consultation_notes ??
      metaAny.consultationNotes ??
      [];
    if (Array.isArray(raw)) return raw.map((n) => String(n));
    if (raw == null) return [];
    return [String(raw)];
  }, [selectedOrder]);

  const hasAnyNotes = adminNotesForDetail.length > 0 || consultantNotesForDetail.length > 0;

  // Load list (payment_status=pending)
  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);

      try {
        const res: any = await getOrdersApi({ payment_status: PAYMENT_STATUS });
        if (cancelled) return;

        const { orders: ordersList, meta: metaRes } = unwrapOrdersList(res);
        setOrders(ordersList);
        setMeta(metaRes);

        // fetch users for all distinct user_ids in list (only missing)
        const uniqueUserIds = Array.from(
          new Set(
            ordersList.map((o: any) => extractUserIdFromOrder(o)).filter(Boolean)
          )
        ) as string[];

        const currentUsers = orderUsersRef.current;
        const missingIds = uniqueUserIds.filter((id) => currentUsers[id] === undefined);

        if (missingIds.length) {
          const results = await Promise.all(
            missingIds.map(async (id) => {
              try {
                const uRes = await getUserByIdApi(id);
                return [id, unwrapUser(uRes)] as const;
              } catch (err) {
                console.error("Failed to fetch user for order list", id, err);
                return [id, null] as const;
              }
            })
          );

          if (!cancelled) {
            setOrderUsers((prev) => {
              const next = { ...prev };
              for (const [id, user] of results) next[id] = user;
              return next;
            });
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
  }, []);

  // View details handler
  async function handleViewDetails(id: string) {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedOrder(null);
    setOrderedByUser(null);

    try {
      const orderRes: any = await getOrderByIdApi(id);
      const order = unwrapOrder(orderRes);
      setSelectedOrder(order);

      const userId = extractUserIdFromOrder(order);
      if (userId) {
        // prefer cache first
        if (orderUsersRef.current[userId] !== undefined) {
          setOrderedByUser(orderUsersRef.current[userId] || null);
        } else {
          try {
            const uRes = await getUserByIdApi(userId);
            const u = unwrapUser(uRes);
            setOrderedByUser(u);
            setOrderUsers((prev) => ({ ...prev, [userId]: u }));
          } catch (err) {
            console.error("Failed to fetch user for order (detail)", err);
          }
        }
      }
    } catch (e: any) {
      setDetailError(e?.message || "Failed to load order details");
    } finally {
      setDetailLoading(false);
    }
  }

  const totalUnpaid = (meta as any)?.total ?? orders.length;

  // ✅ rows for table (same pattern as your Pending Orders page)
  const rows = useMemo(() => {
    return orders.map((order: any) => {
      const userId = extractUserIdFromOrder(order) || undefined;
      const listUser = userId && orderUsers[userId] !== undefined ? orderUsers[userId] : null;

      const patientName = getDisplayPatientName(order, listUser);

      const email =
        (listUser as any)?.email ||
        (order as any)?.email ||
        (order as any)?.patient_email ||
        "";

      const totalMinor = extractTotalMinor(order);
      const appointmentAt = extractAppointmentStart(order);
      const productName = extractProductName(order);

      const reference = order?.reference || order?._id;

      return {
        order,
        reference,
        patientName,
        email,
        listUser,
        totalMinor,
        appointmentAt,
        productName,
      };
    });
  }, [orders, orderUsers]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">
            Unpaid Orders
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Orders with{" "}
            <span className="font-semibold text-amber-300">pending payment</span>.
            Open details to review and chase payment.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/70 px-3 py-1.5 text-xs text-neutral-300">
            <Filter size={14} />
            <span>Payment:</span>
            <span className="font-medium text-amber-300">Pending</span>
          </div>

          <span className="text-xs text-neutral-500">
            {totalUnpaid} unpaid{" "}
            {meta ? `• page ${(meta as any).page} of ${(meta as any).totalPages}` : ""}
          </span>
        </div>
      </div>

      {/* ✅ List content (TABLE LAYOUT like your Pending Orders page) */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading orders…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-center text-neutral-400">
          No unpaid orders found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-900/80 text-[11px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Reference</th>
                  <th className="px-3 py-2 text-left font-medium">Patient</th>
                  <th className="px-3 py-2 text-left font-medium">Product / Service</th>
                  <th className="px-3 py-2 text-left font-medium">Appointment</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>

              <tbody>
                {rows.map(({ order, reference, patientName, email, listUser, totalMinor, appointmentAt, productName }) => {
                  return (
                    <tr
                      key={String((order as any)?._id)}
                      className="cursor-pointer border-t border-neutral-900/80 bg-neutral-950/40 hover:bg-neutral-900/60"
                      onClick={() => handleViewDetails(String((order as any)?._id))}
                    >
                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        <div className="flex items-center gap-1">
                          <ClipboardList className="h-3.5 w-3.5 text-neutral-500" />
                          <span className="font-medium text-neutral-100">{reference}</span>
                        </div>

                        {/* small badges (status + payment) */}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(order as any)?.status && (
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                                statusBadgeClasses(String((order as any).status)),
                              ].join(" ")}
                            >
                              {String((order as any).status) === "approved" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : String((order as any).status) === "pending" ? (
                                <Clock className="h-3 w-3" />
                              ) : String((order as any).status) === "rejected" ||
                                String((order as any).status) === "cancelled" ? (
                                <XCircle className="h-3 w-3" />
                              ) : (
                                <ClipboardList className="h-3 w-3" />
                              )}
                              <span className="capitalize">
                                {String((order as any).status).replace(/_/g, " ")}
                              </span>
                            </span>
                          )}

                          {(order as any)?.payment_status && (
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                                paymentBadgeClasses(String((order as any).payment_status)),
                              ].join(" ")}
                            >
                              <CreditCard className="h-3 w-3" />
                              <span className="capitalize">
                                {String((order as any).payment_status).replace(/_/g, " ")}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="max-w-xs px-3 py-2 align-middle">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-[10px] font-semibold text-neutral-100">
                            {getUserInitials(listUser)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-neutral-100">
                              {patientName}
                            </p>
                            <p className="truncate text-[10px] text-neutral-500">{email || "—"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="max-w-xs px-3 py-2 align-middle">
                        <p className="line-clamp-2 text-[11px] text-neutral-100">{productName}</p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">
                          {(order as any)?.service_name || "—"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        <div className="flex items-center gap-2 text-[11px] text-neutral-200">
                          <CalendarDays className="h-3.5 w-3.5 text-neutral-500" />
                          <span>{formatDateTime(appointmentAt)}</span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2 text-right align-middle text-[11px] text-neutral-100">
                        {formatMoney(totalMinor ?? null)}
                      </td>

                      <td className="px-3 py-2 text-right align-middle">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(String((order as any)?._id));
                          }}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                        >
                          <span>Open</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🔹 Detail modal (kept as-is) */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 md:px-6">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">Order details</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[80vh] space-y-4 overflow-y-auto px-5 py-4 text-sm text-neutral-200">
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
                      <p className="mb-0.5 text-xs text-neutral-400">Reference</p>
                      <p className="font-mono text-sm text-white">{(selectedOrder as any).reference}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        Service:{" "}
                        <span className="font-medium">{(selectedOrder as any).service_name}</span>{" "}
                        ({String((selectedOrder as any).service_slug || "")})
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                          statusBadgeClasses(String((selectedOrder as any).status))
                        }
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        {String((selectedOrder as any).status).toUpperCase()}
                      </span>

                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                          paymentBadgeClasses(String((selectedOrder as any).payment_status))
                        }
                      >
                        <CreditCard className="h-3 w-3" />
                        {String((selectedOrder as any).payment_status).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Patient profile + appointment */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <PatientProfileCard user={orderedByUser} />
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                      <p className="mb-0.5 text-xs text-neutral-400">Appointment</p>
                      <p className="text-sm text-white">
                        {formatDateTime(
                          (selectedOrder as any)?.meta?.appointment_start_at ||
                            (selectedOrder as any)?.start_at
                        )}
                      </p>
                      <p className="text-xs text-neutral-400">
                        End: {formatDateTime(String((selectedOrder as any)?.end_at || ""))}
                      </p>
                    </div>
                  </div>

                  {/* Items / lines */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-neutral-300" />
                        <p className="text-xs font-semibold text-neutral-200">Items</p>
                      </div>
                      <p className="text-xs text-neutral-400">
                        Total:{" "}
                        <span className="font-semibold text-white">
                          {formatMoney((selectedOrder as any)?.meta?.totalMinor ?? null)}
                        </span>
                      </p>
                    </div>

                    {(selectedOrder as any)?.meta?.items?.length ? (
                      <div className="space-y-1">
                        {(selectedOrder as any).meta.items.map((it: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between border-b border-neutral-800/60 py-1 text-xs last:border-none"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-white">{it.name}</span>
                              <span className="text-[11px] text-neutral-400">
                                {it.variation || it.variations || "Standard"}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[11px] text-neutral-400">Qty: {it.qty}</span>
                              <span className="block text-[11px] text-neutral-300">
                                {formatMoney(it.totalMinor ?? null)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">No items found on this order.</p>
                    )}
                  </div>

                  {/* Notes */}
                  {hasAnyNotes && (
                    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                      <p className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
                        <ClipboardList className="h-4 w-4 text-neutral-300" />
                        Notes
                      </p>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold text-neutral-400">Admin notes</p>
                          {adminNotesForDetail.length ? (
                            <ul className="space-y-1">
                              {adminNotesForDetail.map((note, idx) => (
                                <li key={idx} className="text-xs leading-snug text-neutral-200">
                                  • {note}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-neutral-500">No admin notes.</p>
                          )}
                        </div>

                        <div>
                          <p className="mb-1 text-[11px] font-semibold text-neutral-400">
                            Consultation notes
                          </p>
                          {consultantNotesForDetail.length ? (
                            <ul className="space-y-1">
                              {consultantNotesForDetail.map((note, idx) => (
                                <li key={idx} className="text-xs leading-snug text-neutral-200">
                                  • {note}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-neutral-500">No consultation notes.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!detailLoading && !detailError && !selectedOrder && (
                <div className="text-xs text-neutral-400">No order selected.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
