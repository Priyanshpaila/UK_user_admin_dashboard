"use client";

import React, { useEffect, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  updateOrderStatusApi,
  getUserByIdApi,
  updateUserApi,
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
  ThumbsUp,
  ThumbsDown,
  Phone,
  Mail,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Hash,
} from "lucide-react";
import { useOrdersStats } from "../orders-badge-context";

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

function priorityBadgeClasses(priority?: string | null) {
  const p = (priority || "yellow").toLowerCase();
  if (p === "red")
    return "border-red-500/60 bg-red-500/10 text-red-300";
  if (p === "green")
    return "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
  return "border-amber-500/60 bg-amber-500/10 text-amber-200"; // default yellow
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
  // list state
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<OrdersListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cache of users for cards: user_id -> user
  const [orderUsers, setOrderUsers] = useState<Record<string, UserDto | null>>(
    {}
  );

  // detail modal state
  const [showDetail, setShowDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ordered-by user (detail)
  const [orderedByUser, setOrderedByUser] = useState<UserDto | null>(null);

  // notes state
  const [adminNotes, setAdminNotes] = useState<string[]>([]);
  const [newAdminNote, setNewAdminNote] = useState("");
  const [consultationNotes, setConsultationNotes] = useState<string[]>([]);
  const [newConsultationNote, setNewConsultationNote] = useState("");

  // rejection notes
  const [existingRejectionNotes, setExistingRejectionNotes] = useState<
    string[]
  >([]);
  const [newRejectionNotes, setNewRejectionNotes] = useState<string[]>([]);
  const [rejectionNoteInput, setRejectionNoteInput] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // approve / reject action state
  const [statusAction, setStatusAction] = useState<
    "approved" | "rejected" | null
  >(null);

  // verification buttons state
  const [verifyingField, setVerifyingField] = useState<
    "scr_verified" | "id_verified" | null
  >(null);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );

  // priority editing state
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);

  // global stats actions (for sidebar badges)
  const { applyStatusChange, refresh } = useOrdersStats();

  // logged-in user id (for approved_by / rejected_by)
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  // read logged-in user id from localStorage
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

  // hard-coded filter
  const STATUS = "pending";

  // load list
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

        // fetch users for all distinct user_ids in list
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

        await refresh();
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
  }, [refresh]);

  // helper to reset notes state when opening a different order
  function hydrateNotes(order: OrderDto) {
    setAdminNotes(order.admin_notes || []);
    setNewAdminNote("");

    const existingConsultation =
      ((order as any).consultation_notes as string[] | undefined) || [];
    setConsultationNotes(existingConsultation);
    setNewConsultationNote("");

    const existingRejection =
      ((order as any).rejection_notes as string[] | undefined) || [];
    setExistingRejectionNotes(existingRejection);
    setNewRejectionNotes([]);
    setRejectionNoteInput("");
    setRejectError(null);
  }

  // View details handler
  async function handleViewDetails(id: string) {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedOrder(null);
    setStatusAction(null);
    setOrderedByUser(null);
    setVerificationError(null);
    setVerifyingField(null);
    setPriorityError(null);
    setPrioritySaving(false);

    try {
      const order = await getOrderByIdApi(id);
      setSelectedOrder(order);
      hydrateNotes(order);

      const userId = (order as any).user_id as string | undefined;
      if (userId) {
        if (orderUsers[userId] !== undefined) {
          setOrderedByUser(orderUsers[userId]);
        } else {
          try {
            const user = await getUserByIdApi(userId);
            setOrderedByUser(user);
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

  // helpers for notes
  function handleAddAdminNote() {
    const v = newAdminNote.trim();
    if (!v) return;
    setAdminNotes((prev) => [...prev, v]);
    setNewAdminNote("");
  }

  function handleRemoveAdminNote(idx: number) {
    setAdminNotes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddConsultationNote() {
    const v = newConsultationNote.trim();
    if (!v) return;
    setConsultationNotes((prev) => [...prev, v]);
    setNewConsultationNote("");
  }

  function handleRemoveConsultationNote(idx: number) {
    setConsultationNotes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddRejectionNote() {
    const v = rejectionNoteInput.trim();
    if (!v) return;
    setNewRejectionNotes((prev) => [...prev, v]);
    setRejectionNoteInput("");
  }

  function handleRemoveNewRejectionNote(idx: number) {
    setNewRejectionNotes((prev) => prev.filter((_, i) => i !== idx));
  }

  // approve
  async function handleApprove() {
    if (!selectedOrder) return;

    const prevStatus = selectedOrder.status;
    setStatusAction("approved");
    setDetailError(null);

    try {
      const payload: any = {
        status: "approved",
        admin_notes: adminNotes,
        consultation_notes: consultationNotes,
      };

      if (loggedInUserId) {
        payload.approved_by = loggedInUserId;
      }
      payload.approved_at = new Date().toISOString();

      const updated = await updateOrderStatusApi(selectedOrder._id, payload);

      applyStatusChange(prevStatus, updated.status);
      setOrders((prev) => prev.filter((o) => o._id !== selectedOrder._id));
      setShowDetail(false);
      setSelectedOrder(updated);
    } catch (e: any) {
      setDetailError(e?.message || "Failed to update order status");
    } finally {
      setStatusAction(null);
    }
  }

  // open reject dialog
  function openRejectDialog() {
    setShowRejectDialog(true);
    setRejectError(null);
  }

  // confirm reject (with rejection notes)
  async function confirmReject() {
    if (!selectedOrder) return;

    const finalNotes = [
      ...existingRejectionNotes,
      ...newRejectionNotes,
      ...(rejectionNoteInput.trim() ? [rejectionNoteInput.trim()] : []),
    ];

    if (!finalNotes.length) {
      setRejectError("Please add at least one rejection note.");
      return;
    }

    const prevStatus = selectedOrder.status;
    setStatusAction("rejected");
    setRejectError(null);

    try {
      const payload: any = {
        status: "rejected",
        admin_notes: adminNotes,
        consultation_notes: consultationNotes,
        rejection_notes: finalNotes,
      };
      if (loggedInUserId) {
        payload.rejected_by = loggedInUserId;
      }
      payload.rejected_at = new Date().toISOString();

      const updated = await updateOrderStatusApi(selectedOrder._id, payload);

      applyStatusChange(prevStatus, updated.status);
      setOrders((prev) => prev.filter((o) => o._id !== selectedOrder._id));
      setShowDetail(false);
      setShowRejectDialog(false);
      setSelectedOrder(updated);
    } catch (e: any) {
      setRejectError(e?.message || "Failed to reject order");
    } finally {
      setStatusAction(null);
    }
  }

  // user verification buttons (only for weight-management)
  const isWeightManagement =
    selectedOrder &&
    ((selectedOrder.service_slug &&
      selectedOrder.service_slug.toLowerCase() === "weight-management") ||
      (selectedOrder.service_name &&
        selectedOrder.service_name.toLowerCase() === "weight management"));

  // 🔁 priority change
  async function handlePriorityChange(newPriority: string) {
    if (!orderedByUser) return;

    const userId = orderedByUser._id;
    const prevPriority = (orderedByUser as any).user_priority || "yellow";

    setPrioritySaving(true);
    setPriorityError(null);

    try {
      // optimistic local update
      setOrderedByUser({
        ...(orderedByUser as any),
        user_priority: newPriority,
      } as any);

      const updatedUser = await updateUserApi(userId, {
        user_priority: newPriority,
      });

      setOrderedByUser(updatedUser);
      setOrderUsers((prev) => ({
        ...prev,
        [updatedUser._id]: updatedUser,
      }));
    } catch (e: any) {
      console.error("Failed to update priority", e);
      setPriorityError(e?.message || "Failed to update priority status.");
      // revert
      setOrderedByUser((prev) =>
        prev
          ? ({
              ...(prev as any),
              user_priority: prevPriority,
            } as any)
          : prev
      );
    } finally {
      setPrioritySaving(false);
    }
  }

  // 🔁 TOGGLE SCR / ID VERIFIED
  async function handleVerify(field: "scr_verified" | "id_verified") {
    if (!orderedByUser) return;

    const current = !!(orderedByUser as any)[field];

    setVerifyingField(field);
    setVerificationError(null);
    try {
      const updatedUser = await updateUserApi(orderedByUser._id, {
        [field]: !current,
      });

      setOrderedByUser(updatedUser);

      setOrderUsers((prev) => ({
        ...prev,
        [updatedUser._id]: updatedUser,
      }));
    } catch (e: any) {
      setVerificationError(e?.message || "Failed to update user verification");
    } finally {
      setVerifyingField(null);
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
            const priority =
              ((cardUser as any)?.user_priority as string | undefined) ||
              "yellow";

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
                  <div className="flex flex-wrap items-center gap-2">
                    <User className="h-4 w-4 text-neutral-400" />
                    <span className="font-medium">{patientName}</span>
                    {(order as any).email && (
                      <span className="truncate text-neutral-400">
                        {(order as any).email}
                      </span>
                    )}

                    {/* Priority badge on card */}
                    <span
                      className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityBadgeClasses(
                        priority
                      )}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-neutral-400" />
                    <span>{formatDateTime(appointmentAt)}</span>
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

      {/* Detail modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 md:px-6">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                  <ClipboardList className="h-4 w-4" />
                  Order details
                </span>
                {selectedOrder && (
                  <span className="text-[11px] text-neutral-500">
                    Ref:{" "}
                    <span className="font-mono text-neutral-300">
                      {selectedOrder.reference}
                    </span>
                  </span>
                )}
              </div>

              {selectedOrder && (
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
              )}

              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="ml-4 rounded-full p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm text-neutral-200">
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
                  {/* Service row */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
                    <p className="text-[11px] text-neutral-400 mb-1">
                      Service
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {selectedOrder.service_name}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {selectedOrder.service_slug}
                        </p>
                      </div>
                      <p className="text-xs text-neutral-400">
                        Created:{" "}
                        <span className="font-mono text-neutral-200">
                          {formatDateTime(selectedOrder.createdAt)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Patient details + appointment */}
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-4">
                    {/* Patient details card */}
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 text-xs font-semibold text-neutral-200">
                            {getDisplayPatientName(
                              selectedOrder,
                              orderedByUser
                            )
                              .split(" ")
                              .map((s) => s[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase() || "PT"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {getDisplayPatientName(
                                selectedOrder,
                                orderedByUser
                              )}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                              {orderedByUser && (
                                <>
                                  {(orderedByUser as any).gender && (
                                    <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-900/60 px-2 py-0.5 capitalize">
                                      {(orderedByUser as any).gender}
                                    </span>
                                  )}
                                  {(orderedByUser as any)._id && (
                                    <span className="inline-flex items-center gap-1">
                                      <Hash className="h-3 w-3 text-neutral-500" />
                                      {(orderedByUser as any)._id}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {orderedByUser && (
                          <div className="text-right text-[11px] text-neutral-400 space-y-1">
                            {(orderedByUser as any).createdAt && (
                              <p>
                                Account created:{" "}
                                <span className="text-neutral-200">
                                  {formatDateTime(
                                    (orderedByUser as any).createdAt
                                  )}
                                </span>
                              </p>
                            )}
                            {(orderedByUser as any).updatedAt && (
                              <p>
                                Last updated:{" "}
                                <span className="text-neutral-200">
                                  {formatDateTime(
                                    (orderedByUser as any).updatedAt
                                  )}
                                </span>
                              </p>
                            )}
                            {(orderedByUser as any).__v !== undefined && (
                              <p>Record version: {(orderedByUser as any).__v}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-neutral-300">
                        <div className="space-y-1">
                          <p className="font-semibold text-neutral-400">
                            Contact
                          </p>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-neutral-500" />
                            <span className="truncate">
                              {(orderedByUser as any)?.email ||
                                (selectedOrder as any).email ||
                                "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-neutral-500" />
                            <span className="truncate">
                              {(orderedByUser as any)?.phone ||
                                (orderedByUser as any)?.phoneNumber ||
                                (selectedOrder as any).phone ||
                                "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-3 w-3 text-neutral-500" />
                            <span>
                              DOB:{" "}
                              {formatDateOnly((orderedByUser as any)?.dob) ||
                                "—"}
                              {(() => {
                                const age = calculateAgeFromDob(
                                  (orderedByUser as any)?.dob
                                );
                                return age ? ` (${age} yrs)` : "";
                              })()}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="font-semibold text-neutral-400">
                            Address
                          </p>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-3 w-3 text-neutral-500 mt-0.5" />
                            <div className="space-y-0.5">
                              <p>
                                {(orderedByUser as any)?.address_line1 || "—"}
                              </p>
                              {(orderedByUser as any)?.address_line2 && (
                                <p>{(orderedByUser as any).address_line2}</p>
                              )}
                              <p>
                                {[
                                  (orderedByUser as any)?.city,
                                  (orderedByUser as any)?.county,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </p>
                              <p>
                                {[
                                  (orderedByUser as any)?.postalcode,
                                  (orderedByUser as any)?.country,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Priority status (editable) */}
                      {orderedByUser && (
                        <div className="pt-3 border-t border-neutral-800 mt-1 space-y-2">
                          <p className="text-[11px] text-neutral-400">
                            Priority status
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityBadgeClasses(
                                (orderedByUser as any)?.user_priority
                              )}`}
                            >
                              <span className="h-2 w-2 rounded-full bg-current" />
                              {(
                                (orderedByUser as any)?.user_priority ||
                                "yellow"
                              ).toString()}
                            </span>
                            <select
                              className="rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-[11px] text-neutral-100 focus:outline-none focus:border-emerald-500"
                              disabled={prioritySaving}
                              value={
                                ((orderedByUser as any)?.user_priority as
                                  | string
                                  | undefined) || "yellow"
                              }
                              onChange={(e) =>
                                handlePriorityChange(e.target.value)
                              }
                            >
                              <option value="red">Red – High risk</option>
                              <option value="yellow">Yellow – Medium</option>
                              <option value="green">Green – Low</option>
                            </select>
                            {prioritySaving && (
                              <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                            )}
                          </div>
                          {priorityError && (
                            <p className="text-[11px] text-rose-300">
                              {priorityError}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Weight management verification inside patient card */}
                      {isWeightManagement && orderedByUser && (
                        <div className="pt-3 border-t border-neutral-800 space-y-1 mt-2">
                          <p className="text-[11px] text-neutral-400">
                            Verification (Weight Management only)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {/* SCR verified */}
                            <button
                              type="button"
                              disabled={verifyingField === "scr_verified"}
                              onClick={() => handleVerify("scr_verified")}
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${
                                (orderedByUser as any).scr_verified
                                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                                  : "border-neutral-600 bg-neutral-900 text-neutral-200 hover:border-emerald-500 hover:text-emerald-200"
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              {verifyingField === "scr_verified" && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              {(orderedByUser as any).scr_verified ? (
                                <ShieldCheck className="h-3 w-3" />
                              ) : (
                                <ShieldAlert className="h-3 w-3" />
                              )}
                              SCR verified
                            </button>

                            {/* ID verified */}
                            <button
                              type="button"
                              disabled={verifyingField === "id_verified"}
                              onClick={() => handleVerify("id_verified")}
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${
                                (orderedByUser as any).id_verified
                                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                                  : "border-neutral-600 bg-neutral-900 text-neutral-200 hover:border-emerald-500 hover:text-emerald-200"
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              {verifyingField === "id_verified" && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              {(orderedByUser as any).id_verified ? (
                                <ShieldCheck className="h-3 w-3" />
                              ) : (
                                <ShieldAlert className="h-3 w-3" />
                              )}
                              ID verified
                            </button>
                          </div>
                          {verificationError && (
                            <p className="text-[11px] text-rose-300">
                              {verificationError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Appointment card */}
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-4 space-y-2">
                      <p className="text-[11px] text-neutral-400">
                        Appointment
                      </p>
                      <p className="text-sm text-white">
                        {formatDateTime(
                          selectedOrder.meta?.appointment_start_at ||
                            (selectedOrder as any).start_at
                        )}
                      </p>
                      {(selectedOrder as any).end_at && (
                        <p className="text-xs text-neutral-400">
                          End:{" "}
                          {formatDateTime((selectedOrder as any).end_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
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

                  {/* RAF preview */}
                  {selectedOrder.meta?.formsQA?.raf?.qa?.length ? (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
                      <p className="text-xs font-semibold text-neutral-200 mb-2">
                        RAF Answers (preview)
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
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

                  {/* Notes section */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-neutral-200">
                        Notes
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Internal notes only visible to staff.
                      </p>
                    </div>

                    {/* Admin notes */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-neutral-300">
                        Admin notes
                      </p>
                      {adminNotes.length > 0 && (
                        <div className="space-y-1">
                          {adminNotes.map((note, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-[11px]"
                            >
                              <span className="flex-1 truncate">{note}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveAdminNote(idx)}
                                className="shrink-0 rounded-full p-1 hover:bg-neutral-800 text-neutral-500 hover:text-rose-300"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          value={newAdminNote}
                          onChange={(e) => setNewAdminNote(e.target.value)}
                          className="flex-1 rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-[11px] text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500"
                          placeholder="Add new admin note"
                        />
                        <button
                          type="button"
                          onClick={handleAddAdminNote}
                          className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-neutral-100 hover:border-emerald-500 hover:text-emerald-200"
                        >
                          + Add
                        </button>
                      </div>
                    </div>

                    {/* (Consultation notes block left commented as before) */}
                  </div>

                  {/* Action bar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-neutral-500 max-w-md">
                      Change status for this order. Once approved or rejected,
                      it will disappear from the pending list. Notes will be
                      saved with the order.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        disabled={
                          statusAction === "rejected" ||
                          statusAction === "approved"
                        }
                        onClick={openRejectDialog}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-500/60 px-4 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {statusAction === "rejected" && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        Reject order
                        <ThumbsDown className="h-3 w-3" />
                      </button>

                      <button
                        type="button"
                        disabled={
                          statusAction === "approved" ||
                          statusAction === "rejected"
                        }
                        onClick={handleApprove}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {statusAction === "approved" && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        Approve order
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Reject dialog (nested) */}
          {showRejectDialog && selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
              <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl px-4 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Reject order
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Add one or more rejection notes. These will be stored with
                      this order.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRejectDialog(false)}
                    className="rounded-full p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {newRejectionNotes.length > 0 && (
                    <div className="space-y-1">
                      {newRejectionNotes.map((note, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-[11px]"
                        >
                          <span className="flex-1 truncate">{note}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveNewRejectionNote(idx)}
                            className="shrink-0 rounded-full p-1 hover:bg-neutral-800 text-neutral-500 hover:text-rose-300"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      value={rejectionNoteInput}
                      onChange={(e) => setRejectionNoteInput(e.target.value)}
                      className="flex-1 rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-[11px] text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-rose-500"
                      placeholder="Add rejection note (reason, safety concern, etc.)"
                    />
                    <button
                      type="button"
                      onClick={handleAddRejectionNote}
                      className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-neutral-100 hover:border-rose-500 hover:text-rose-200"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {rejectError && (
                  <p className="text-[11px] text-rose-300">{rejectError}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRejectDialog(false)}
                    className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-neutral-200 hover:border-neutral-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmReject}
                    disabled={statusAction === "rejected"}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-500/70 bg-rose-500/10 px-4 py-1.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {statusAction === "rejected" && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Confirm rejection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
