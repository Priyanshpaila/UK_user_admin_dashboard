"use client";

import React, { useEffect, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  updateOrderStatusApi,
  type OrderDto,
  type OrdersListMeta,
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
  ThumbsUp,
  ThumbsDown,
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

export default function Page() {
  // list state
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<OrdersListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // detail modal state
  const [showDetail, setShowDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // approve / reject action state
  const [statusAction, setStatusAction] = useState<
    "approved" | "rejected" | null
  >(null);

  // 🔒 hard-coded filter
  const STATUS = "pending";

  // Load list (pending)
  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOrdersApi({ status: STATUS });
        if (cancelled) return;
        setOrders(res.data || []);
        setMeta(res.meta || null);
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
  }, []); // always "pending"

  // View details handler
  async function handleViewDetails(id: string) {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedOrder(null);
    setStatusAction(null);

    try {
      const order = await getOrderByIdApi(id);
      setSelectedOrder(order);
    } catch (e: any) {
      setDetailError(e?.message || "Failed to load order details");
    } finally {
      setDetailLoading(false);
    }
  }

  // Approve / Reject action
  async function handleChangeStatus(newStatus: "approved" | "rejected") {
    if (!selectedOrder) return;

    setStatusAction(newStatus);
    setDetailError(null);

    try {
      const updated = await updateOrderStatusApi(selectedOrder._id, {
        status: newStatus,
      });

      // Remove from local list, as it's no longer pending
      setOrders((prev) => prev.filter((o) => o._id !== selectedOrder._id));

      // Optionally, keep detail open with updated info:
      // setSelectedOrder(updated);

      // For pending page it's usually nice to close after action:
      setShowDetail(false);
      setSelectedOrder(updated);
    } catch (e: any) {
      setDetailError(e?.message || "Failed to update order status");
    } finally {
      setStatusAction(null);
    }
  }

  const totalPending = meta?.total ?? orders.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Pending Orders
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Orders waiting for review or action. Open details to inspect the
            full assessment and booking info.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300">
            <Filter size={14} />
            <span>Status:</span>
            <span className="font-medium text-amber-300">Pending</span>
          </div>
          <span className="text-xs text-neutral-500">
            {totalPending} pending{" "}
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
          No pending orders found.
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
            const patientName =
              order.patient_name ||
              `${order.first_name || ""} ${order.last_name || ""}`.trim() ||
              "Unknown patient";

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
                        Patient
                      </p>
                      <p className="text-sm font-medium text-white">
                        {selectedOrder.patient_name ||
                          `${selectedOrder.first_name || ""} ${
                            selectedOrder.last_name || ""
                          }`.trim() ||
                          "Unknown"}
                      </p>
                      {selectedOrder.email && (
                        <p className="text-xs text-neutral-400">
                          {selectedOrder.email}
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

                  {/* RAF Preview */}
                  {selectedOrder.meta?.formsQA?.raf?.qa?.length ? (
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
                  ) : null}

                  {/* 🔹 Approve / Reject buttons */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-neutral-500">
                      Change status for this order. Once approved or rejected,
                      it will disappear from the pending list.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        disabled={statusAction === "rejected" || statusAction === "approved"}
                        onClick={() => handleChangeStatus("rejected")}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-500/60 px-4 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {statusAction === "rejected" && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {statusAction === "rejected" ? "Rejecting…" : "Reject order"}
                        <ThumbsDown className="h-3 w-3" />
                      </button>

                      <button
                        type="button"
                        disabled={statusAction === "approved" || statusAction === "rejected"}
                        onClick={() => handleChangeStatus("approved")}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {statusAction === "approved" && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {statusAction === "approved" ? "Approving…" : "Approve order"}
                        <ThumbsUp className="h-3 w-3" />
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
