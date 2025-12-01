"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  updateOrderStatusApi,
  getUserByIdApi,
  type OrderDto,
  type OrdersListMeta,
  type UserDto,
} from "../../../api";
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
} from "lucide-react";
import { useRouter } from "next/navigation";

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
    const fromUser =
      (user as any).name ||
      (user as any).fullName ||
      `${(user as any).firstName || ""} ${
        (user as any).lastName || ""
      }`.trim() ||
      (user as any).email;
    if (fromUser) return fromUser;
  }

  return "Unknown";
}

export default function Page() {
  const router = useRouter();

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

  // admin notes state (editable)
  const [adminNotes, setAdminNotes] = useState<string[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // ordered-by user state (for detail modal)
  const [orderedByUser, setOrderedByUser] = useState<UserDto | null>(null);

  // 🔒 hard-coded filter
  const STATUS = "approved";

  // 🔹 derived consultation / rejection notes from selectedOrder
  const consultationNotes = useMemo(() => {
    if (!selectedOrder) return [] as string[];
    const o: any = selectedOrder;
    const meta: any = o.meta || {};

    const rawRoot =
      o.consultation_notes ?? o.consultant_notes ?? o.consultationNotes;
    const rawMeta =
      meta.consultation_notes ??
      meta.consultationNotes ??
      meta.consultant_notes ??
      meta.consultantNotes;

    const raw = rawRoot ?? rawMeta ?? [];
    const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    return arr
      .map((n) => String(n).trim())
      .filter((n) => n.length > 0);
  }, [selectedOrder]);

  const rejectionNotes = useMemo(() => {
    if (!selectedOrder) return [] as string[];
    const o: any = selectedOrder;
    const meta: any = o.meta || {};

    const rawRoot =
      o.rejection_notes ??
      o.rejected_notes ??
      o.rejection_reason ??
      o.rejected_reason;
    const rawMeta =
      meta.rejection_notes ??
      meta.rejected_notes ??
      meta.rejection_reason ??
      meta.rejected_reason;

    const raw = rawRoot ?? rawMeta ?? [];
    const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    return arr
      .map((n) => String(n).trim())
      .filter((n) => n.length > 0);
  }, [selectedOrder]);

  const hasAnyOtherNotes =
    consultationNotes.length > 0 || rejectionNotes.length > 0;

  // Load list (approved)
  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOrdersApi({ status: STATUS });
        if (cancelled) return;

        const ordersList = res.data || [];
        setOrders(ordersList);
        setMeta(res.meta || null);

        // fetch all distinct user_ids for cards
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
  }, []); // always "approved"

  // View details handler
  async function handleViewDetails(id: string) {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedOrder(null);
    setAdminNotes([]);
    setNewNote("");
    setOrderedByUser(null);

    try {
      const order = await getOrderByIdApi(id);
      setSelectedOrder(order);
      setAdminNotes((order as any).admin_notes || []);

      // fetch the user who ordered (by user_id)
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

  // Save admin notes (using updateOrderStatusApi)
  async function handleSaveAdminNotes() {
    if (!selectedOrder) return;

    setSavingNotes(true);
    setDetailError(null);

    try {
      const updated = await updateOrderStatusApi(selectedOrder._id, {
        status: selectedOrder.status,
        admin_notes: adminNotes,
      } as any);

      setSelectedOrder(updated);
      setAdminNotes((updated as any).admin_notes || []);
    } catch (e: any) {
      setDetailError(e?.message || "Failed to save admin notes");
    } finally {
      setSavingNotes(false);
    }
  }

  // 👉 Start consultancy: navigate with service_id & order_id
  function handleStartConsultancy() {
    if (!selectedOrder) return;

    const serviceId = (selectedOrder as any).service_id as string | undefined;
    const orderId = selectedOrder._id;

    if (!serviceId || !orderId) {
      console.warn("Missing service_id or order_id for consultancy navigation");
      return;
    }

    const url = `/dashboard/consultations/start?service_id=${encodeURIComponent(
      serviceId
    )}&order_id=${encodeURIComponent(orderId)}`;

    setShowDetail(false);
    router.push(url);
  }

  const totalApproved = meta?.total ?? orders.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Approved Orders
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Orders that have been approved and are ready for consultation and
            follow-up.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300">
            <Filter size={14} />
            <span>Status:</span>
            <span className="font-medium text-emerald-400">Approved</span>
          </div>
          <span className="text-xs text-neutral-500">
            {totalApproved} approved{" "}
            {meta ? `• page ${meta.page} of ${meta.totalPages}` : ""}
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
          No approved orders found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => {
            const totalMinor = order.meta?.totalMinor ?? null;
            const appointmentAt =
              order.meta?.appointment_start_at || (order as any).start_at;
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
                    {(order as any).email && (
                      <span className="ml-2 truncate text-neutral-400">
                        {(order as any).email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-neutral-400" />
                    <span>{formatDateTime(appointmentAt)}</span>
                    <span className="mx-2 text-neutral-500">•</span>
                    {order.meta?.appointment_start_at &&
                    (order as any).end_at ? (
                      <span className="text-neutral-400">
                        Duration:{" "}
                        {Math.max(
                          1,
                          Math.round(
                            (new Date((order as any).end_at).getTime() -
                              new Date(
                                order.meta?.appointment_start_at
                              ).getTime()) /
                              60000
                          )
                        )}{" "}
                        min
                      </span>
                    ) : null}
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-t-2xl md:rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
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
            <div className="max-h-[80vh] overflow-y-auto px-4 py-4 space-y-4 text-sm text-neutral-200">
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

                  {/* Patient & appointment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div>
                      <p className="text-xs text-neutral-400 mb-0.5">
                        Patient / Ordered by
                      </p>
                      <p className="text-sm font-medium text-white">
                        {getDisplayPatientName(selectedOrder, orderedByUser)}
                      </p>
                      {orderedByUser && (
                        <p className="text-[11px] text-neutral-500">
                          Account:{" "}
                          {(orderedByUser as any).name ||
                            (orderedByUser as any).fullName ||
                            `${(orderedByUser as any).firstName || ""} ${
                              (orderedByUser as any).lastName || ""
                            }`.trim() ||
                            (orderedByUser as any).email}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-neutral-400 mb-0.5">
                        Appointment
                      </p>
                      <p className="text-sm text-white">
                        {formatDateTime(
                          selectedOrder.meta?.appointment_start_at ||
                            (selectedOrder as any).start_at
                        )}
                      </p>
                      {(selectedOrder as any).end_at &&
                        selectedOrder.meta?.appointment_start_at && (
                          <p className="text-xs text-neutral-400">
                            End: {formatDateTime((selectedOrder as any).end_at)}
                          </p>
                        )}
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

                  {/* RAF Answers (full questions + answers) */}
                  {selectedOrder.meta?.formsQA?.raf?.qa?.length ? (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                      <p className="text-xs font-semibold text-neutral-200 mb-2">
                        RAF Questions &amp; Answers
                      </p>
                      <div className="space-y-2">
                        {selectedOrder.meta.formsQA.raf.qa.map(
                          (qa: any, idx: number) => (
                            <div
                              key={idx}
                              className="text-[11px] border-b border-neutral-800/60 pb-2 last:border-none"
                            >
                              <p className="text-neutral-400 font-medium">
                                {qa.question || qa.key}
                              </p>
                              <p className="text-neutral-100 whitespace-pre-wrap mt-0.5">
                                {Array.isArray(qa.raw)
                                  ? qa.raw.join(", ")
                                  : qa.answer ?? qa.raw ?? "—"}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Notes card: consultation + rejection + editable admin notes */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-neutral-200">
                        Notes
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveAdminNotes}
                        disabled={savingNotes}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {savingNotes && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {savingNotes ? "Saving…" : "Save admin notes"}
                      </button>
                    </div>

                    {/* Read-only consultation + rejection notes */}
                    {hasAnyOtherNotes && (
                      <div className="grid gap-3 md:grid-cols-2 mb-3">
                        <div>
                          <p className="text-[11px] font-semibold text-neutral-400 mb-1">
                            Consultation notes
                          </p>
                          {consultationNotes.length ? (
                            <ul className="space-y-1">
                              {consultationNotes.map((note, idx) => (
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

                        <div>
                          <p className="text-[11px] font-semibold text-neutral-400 mb-1">
                            Rejection notes
                          </p>
                          {rejectionNotes.length ? (
                            <ul className="space-y-1">
                              {rejectionNotes.map((note, idx) => (
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
                              No rejection notes.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Editable admin notes list */}
                    {adminNotes.length === 0 && (
                      <p className="text-xs text-neutral-500 mb-2">
                        No admin notes yet. Add your first note below.
                      </p>
                    )}

                    {adminNotes.length > 0 && (
                      <ul className="space-y-2 mb-3">
                        {adminNotes.map((note, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-xs"
                          >
                            <span className="mt-1 text-[10px] text-neutral-500">
                              #{idx + 1}
                            </span>
                            <div className="flex-1 bg-neutral-800/70 rounded-md px-2 py-1 text-neutral-100">
                              {note}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setAdminNotes((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-[11px] text-rose-400 hover:text-rose-300"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Add new admin note */}
                    <div className="flex gap-2">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note about this order…"
                        className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 resize-none min-h-[60px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newNote.trim()) return;
                          setAdminNotes((prev) => [...prev, newNote.trim()]);
                          setNewNote("");
                        }}
                        className="self-end inline-flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold px-3 py-1.5"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Start consultancy button */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-neutral-500">
                      Ready to speak to the patient? Start a consultation
                      session for this order.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        onClick={handleStartConsultancy}
                        className="inline-flex items-center gap-1 rounded-full border border-sky-500/70 bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
                      >
                        Start consultancy
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
