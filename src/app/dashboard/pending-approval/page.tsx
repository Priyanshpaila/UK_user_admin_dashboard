"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  updateOrderStatusApi,
  getUserByIdApi,
  updateUserApi,
  getBackendBase,
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
  User as UserIcon,
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

/* ----------------------------- Helpers ----------------------------- */

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
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
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
  if (p === "red") return "border-red-500/60 bg-red-500/10 text-red-300";
  if (p === "green")
    return "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
  return "border-amber-500/60 bg-amber-500/10 text-amber-200";
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

function getUserInitials(user: UserDto | null) {
  if (!user) return "PT";
  const u: any = user;
  const full =
    u.name ||
    u.fullName ||
    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
    u.email ||
    "";
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return initials.join("") || "PT";
}

/* --------------------- RAF file/image helpers --------------------- */

const resolveImageUrl = (imagePath?: string | null): string => {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;

  const baseWithApi = getBackendBase();
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");
  return `${cleanBase}${normalizedPath}`;
};

// Render RAF answer including file uploads with images
function renderRafAnswer(qa: any) {
  const raw = qa?.raw;

  // File upload: raw is array of file objects with url/name/type
  if (Array.isArray(raw) && raw.length && typeof raw[0] === "object") {
    return (
      <div className="mt-1 flex flex-wrap gap-3">
        {raw.map((file: any, i: number) => {
          const url = resolveImageUrl(file.url);
          const isImage = (file.type || file.mimeType || "").startsWith(
            "image/"
          );

          if (!url) {
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1"
              >
                <span className="text-[11px] font-medium text-neutral-100">
                  {file.name || "File"}
                </span>
              </div>
            );
          }

          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1"
            >
              {isImage && (
                <button
                  type="button"
                  onClick={() => window.open(url, "_blank")}
                  className="relative h-10 w-10 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={file.name || "uploaded image"}
                    className="h-full w-full object-cover"
                  />
                </button>
              )}

              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => window.open(url, "_blank")}
                  className="text-left text-[11px] font-medium text-emerald-300 hover:underline"
                >
                  {file.name || "View file"}
                </button>
                <span className="text-[10px] text-neutral-500">
                  {file.type || file.mimeType || "file"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <p className="mt-0.5 text-[11px] text-neutral-100">{qa?.answer ?? "—"}</p>
  );
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

function normalizeRafQAs(order: OrderDto) {
  const meta: any = (order as any)?.meta || {};
  const ra =
    meta?.riskAssessment ||
    meta?.raf ||
    (order as any)?.riskAssessment ||
    (order as any)?.raf ||
    [];

  // Expected formats:
  // 1) Array: [{ question, answer, raw }, ...] or [{ key/question, value }, ...]
  // 2) Object map: { "Question": "Answer", ... }
  if (Array.isArray(ra)) {
    return ra
      .map((it: any, idx: number) => {
        const question = String(
          it?.question || it?.key || it?.label || `Question ${idx + 1}`
        );

        const value = it?.value ?? it?.answer ?? it?.raw ?? it?.response ?? it;

        // If file array
        if (
          Array.isArray(value) &&
          value.length &&
          typeof value[0] === "object"
        ) {
          return {
            question,
            answer: `${value.length} attachment${value.length === 1 ? "" : "s"}`,
            raw: value,
          };
        }

        // Plain
        const answer =
          value == null
            ? "—"
            : typeof value === "string" || typeof value === "number"
            ? String(value)
            : Array.isArray(value)
            ? value.map(String).filter(Boolean).join(", ") || "—"
            : typeof value === "boolean"
            ? value
              ? "Yes"
              : "No"
            : "—";

        return { question, answer, raw: it?.raw };
      })
      .filter((x: any) => x.question);
  }

  if (ra && typeof ra === "object") {
    return Object.entries(ra).map(([k, v]) => ({
      question: String(k),
      answer:
        v == null
          ? "—"
          : typeof v === "string" || typeof v === "number"
          ? String(v)
          : typeof v === "boolean"
          ? v
            ? "Yes"
            : "No"
          : Array.isArray(v)
          ? v.map(String).filter(Boolean).join(", ") || "—"
          : "—",
      raw: Array.isArray(v) && v.length && typeof v[0] === "object" ? v : null,
    }));
  }

  return [];
}

/* ----------------------------- Page ----------------------------- */

export default function Page() {
  // list state
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<OrdersListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cache of users for list: user_id -> user
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
        const res: any = await getOrdersApi({ status: STATUS });

        const ordersList: OrderDto[] =
          (res as any)?.data ??
          (res as any)?.orders ??
          (Array.isArray(res) ? res : []);
        const metaRes: OrdersListMeta | null =
          (res as any)?.meta ?? (res as any)?.pagination ?? null;

        if (cancelled) return;

        setOrders(Array.isArray(ordersList) ? ordersList : []);
        setMeta(metaRes);

        // fetch users for all distinct user_ids in list
        const uniqueUserIds = Array.from(
          new Set(
            (ordersList || [])
              .map((o: any) => (o?.user_id || o?.userId) as string | undefined)
              .filter(Boolean)
          )
        ) as string[];

        const missingIds = uniqueUserIds.filter(
          (id) => orderUsers[id] === undefined
        );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // helper to reset notes state when opening a different order
  function hydrateNotes(order: OrderDto) {
    setAdminNotes(((order as any).admin_notes as string[]) || []);
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
      const orderRes = await getOrderByIdApi(id);
      const order = unwrapOrder(orderRes);
      setSelectedOrder(order);
      hydrateNotes(order);

      const userId =
        ((order as any).user_id || (order as any).userId) as string | undefined;
      if (userId) {
        if (orderUsers[userId] !== undefined) {
          setOrderedByUser(orderUsers[userId]);
        } else {
          try {
            const userRes = await getUserByIdApi(userId);
            setOrderedByUser(unwrapUser(userRes));
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

  function closeDetail() {
    setShowDetail(false);
    setSelectedOrder(null);
    setOrderedByUser(null);
    setDetailError(null);
    setShowRejectDialog(false);
    setRejectError(null);
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

    const prevStatus = (selectedOrder as any).status;
    setStatusAction("approved");
    setDetailError(null);

    try {
      const payload: any = {
        status: "approved",
        admin_notes: adminNotes,
        consultation_notes: consultationNotes,
      };

      if (loggedInUserId) payload.approved_by = loggedInUserId;
      payload.approved_at = new Date().toISOString();

      const updatedRes = await updateOrderStatusApi(
        (selectedOrder as any)._id,
        payload
      );
      const updated = unwrapOrder(updatedRes);

      applyStatusChange(prevStatus, (updated as any).status);
      setOrders((prev) => prev.filter((o: any) => (o as any)._id !== idOf(o)));
      closeDetail();
      setSelectedOrder(updated);
    } catch (e: any) {
      setDetailError(e?.message || "Failed to update order status");
    } finally {
      setStatusAction(null);
    }
  }

  function idOf(o: any) {
    return String(o?._id || o?.id || "");
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

    const prevStatus = (selectedOrder as any).status;
    setStatusAction("rejected");
    setRejectError(null);

    try {
      const payload: any = {
        status: "rejected",
        admin_notes: adminNotes,
        consultation_notes: consultationNotes,
        rejection_notes: finalNotes,
      };
      if (loggedInUserId) payload.rejected_by = loggedInUserId;
      payload.rejected_at = new Date().toISOString();

      const updatedRes = await updateOrderStatusApi(
        (selectedOrder as any)._id,
        payload
      );
      const updated = unwrapOrder(updatedRes);

      applyStatusChange(prevStatus, (updated as any).status);
      setOrders((prev) => prev.filter((o: any) => (o as any)._id !== idOf(o)));
      setShowRejectDialog(false);
      closeDetail();
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
    (((selectedOrder as any).service_slug &&
      String((selectedOrder as any).service_slug).toLowerCase() ===
        "weight-management") ||
      ((selectedOrder as any).service_name &&
        String((selectedOrder as any).service_name).toLowerCase() ===
          "weight management"));

  // priority change
  async function handlePriorityChange(newPriority: string) {
    if (!orderedByUser) return;

    const userId = (orderedByUser as any)._id;
    const prevPriority = ((orderedByUser as any).user_priority || "yellow") as
      | string
      | undefined;

    setPrioritySaving(true);
    setPriorityError(null);

    try {
      // optimistic local update
      setOrderedByUser({
        ...(orderedByUser as any),
        user_priority: newPriority,
      } as any);

      const updatedUserRes = await updateUserApi(userId, {
        user_priority: newPriority,
      });
      const updatedUser = unwrapUser(updatedUserRes);

      setOrderedByUser(updatedUser);
      if (updatedUser) {
        setOrderUsers((prev) => ({
          ...prev,
          [(updatedUser as any)._id]: updatedUser,
        }));
      }
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

  // toggle SCR / ID verified
  async function handleVerify(field: "scr_verified" | "id_verified") {
    if (!orderedByUser) return;

    const current = !!(orderedByUser as any)[field];

    setVerifyingField(field);
    setVerificationError(null);
    try {
      const updatedUserRes = await updateUserApi((orderedByUser as any)._id, {
        [field]: !current,
      });
      const updatedUser = unwrapUser(updatedUserRes);

      setOrderedByUser(updatedUser);
      if (updatedUser) {
        setOrderUsers((prev) => ({
          ...prev,
          [(updatedUser as any)._id]: updatedUser,
        }));
      }
    } catch (e: any) {
      setVerificationError(e?.message || "Failed to update user verification");
    } finally {
      setVerifyingField(null);
    }
  }

  const totalPending = meta?.total ?? orders.length;

  const rows = useMemo(() => {
    return orders.map((order: any) => {
      const userId = (order?.user_id || order?.userId) as string | undefined;
      const listUser =
        userId && orderUsers[userId] !== undefined ? orderUsers[userId] : null;

      const patientName = getDisplayPatientName(order, listUser);
      const priority =
        ((listUser as any)?.user_priority as string | undefined) || "yellow";

      const totalMinor =
        order?.total_minor ?? order?.meta?.totalMinor ?? order?.meta?.total_minor;

      const appointmentAt =
        order?.meta?.appointment_start_at || order?.start_at || null;

      const productName =
        order?.meta?.selectedProduct?.name ||
        order?.meta?.lines?.[0]?.name ||
        order?.service_name ||
        "Order";

      const reference = order?.reference || order?._id;

      return {
        order,
        reference,
        patientName,
        listUser,
        priority,
        totalMinor,
        appointmentAt,
        productName,
      };
    });
  }, [orders, orderUsers]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white md:text-3xl">
              Pending Orders
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Orders waiting for review or action. Open details to inspect the
              full assessment and booking info.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/70 px-3 py-1.5 text-xs text-neutral-300">
              <Filter size={14} />
              <span>Status:</span>
              <span className="font-medium text-amber-300">Pending</span>
            </div>
            <span className="text-xs text-neutral-500">
              {totalPending} pending{" "}
              {meta ? `• page ${(meta as any).page} of ${(meta as any).totalPages}` : ""}
            </span>
          </div>
        </div>

        {/* List content (LIST FORM) */}
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
            No pending orders found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-neutral-900/80 text-[11px] uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      Reference
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Patient</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Product / Service
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Appointment
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Priority
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Payment</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Total
                    </th>
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map(
                    ({
                      order,
                      reference,
                      patientName,
                      listUser,
                      priority,
                      totalMinor,
                      appointmentAt,
                      productName,
                    }) => {
                      const status = String(order?.status || "pending");
                      const payment = String(order?.payment_status || "pending");
                      const email =
                        (listUser as any)?.email ||
                        (order as any)?.email ||
                        (order as any)?.patient_email ||
                        "";
                      return (
                        <tr
                          key={String(order?._id)}
                          className="cursor-pointer border-t border-neutral-900/80 bg-neutral-950/40 hover:bg-neutral-900/60"
                          onClick={() => handleViewDetails(String(order?._id))}
                        >
                          <td className="whitespace-nowrap px-3 py-2 align-middle">
                            <div className="flex items-center gap-1">
                              <ClipboardList className="h-3.5 w-3.5 text-neutral-500" />
                              <span className="font-medium text-neutral-100">
                                {reference}
                              </span>
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
                                <p className="truncate text-[10px] text-neutral-500">
                                  {email || "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="max-w-xs px-3 py-2 align-middle">
                            <p className="line-clamp-2 text-[11px] text-neutral-100">
                              {productName}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">
                              {order?.service_name || "—"}
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-3 py-2 align-middle text-[11px] text-neutral-200">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5 text-neutral-500" />
                              {formatDateTime(appointmentAt)}
                            </span>
                          </td>

                          <td className="px-3 py-2 align-middle">
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-medium",
                                priorityBadgeClasses(priority),
                              ].join(" ")}
                            >
                              <span className="h-2 w-2 rounded-full bg-current" />
                              {String(priority).toLowerCase()}
                            </span>
                          </td>

                          <td className="px-3 py-2 align-middle">
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-medium",
                                statusBadgeClasses(status),
                              ].join(" ")}
                            >
                              {status === "approved" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : status === "pending" ? (
                                <Clock className="h-3 w-3" />
                              ) : status === "rejected" ||
                                status === "cancelled" ? (
                                <XCircle className="h-3 w-3" />
                              ) : (
                                <ClipboardList className="h-3 w-3" />
                              )}
                              <span className="capitalize">
                                {status.replace(/_/g, " ")}
                              </span>
                            </span>
                          </td>

                          <td className="px-3 py-2 align-middle">
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-medium",
                                paymentBadgeClasses(payment),
                              ].join(" ")}
                            >
                              <CreditCard className="h-3 w-3" />
                              <span className="capitalize">
                                {payment.replace(/_/g, " ")}
                              </span>
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-3 py-2 text-right align-middle text-[11px] text-neutral-100">
                            {formatMoney(totalMinor ?? null)}
                          </td>

                          <td className="px-3 py-2 text-right align-middle">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(String(order?._id));
                              }}
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                            >
                              <span>Open</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------- Detail Drawer ----------------------------- */}
      {showDetail && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={closeDetail} />
          <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-neutral-800 bg-neutral-950">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                  Order reference
                </p>
                <p className="text-sm font-semibold text-white">
                  {selectedOrder
                    ? (selectedOrder as any).reference || (selectedOrder as any)._id
                    : "—"}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-400">
                  <ClipboardList className="h-3 w-3" />
                  <span>
                    {selectedOrder
                      ? (selectedOrder as any).service_name || "Service"
                      : "—"}
                  </span>
                </p>

                {selectedOrder && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedOrder as any).status && (
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                          statusBadgeClasses(String((selectedOrder as any).status)),
                        ].join(" ")}
                      >
                        {String((selectedOrder as any).status) === "approved" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : String((selectedOrder as any).status) === "pending" ? (
                          <Clock className="h-3 w-3" />
                        ) : String((selectedOrder as any).status) === "rejected" ||
                          String((selectedOrder as any).status) === "cancelled" ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <ClipboardList className="h-3 w-3" />
                        )}
                        <span className="capitalize">
                          {String((selectedOrder as any).status).replace(/_/g, " ")}
                        </span>
                      </span>
                    )}

                    {(selectedOrder as any).payment_status && (
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                          paymentBadgeClasses(
                            String((selectedOrder as any).payment_status)
                          ),
                        ].join(" ")}
                      >
                        <CreditCard className="h-3 w-3" />
                        <span className="capitalize">
                          {String((selectedOrder as any).payment_status).replace(
                            /_/g,
                            " "
                          )}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={closeDetail}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:border-neutral-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {detailLoading ? (
                <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading full order details…</span>
                </div>
              ) : detailError ? (
                <div className="rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
                  {detailError}
                </div>
              ) : selectedOrder ? (
                <>
                  {/* Patient card */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800">
                        <span className="text-xs font-semibold text-neutral-100">
                          {getUserInitials(orderedByUser)}
                        </span>
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                          {getDisplayPatientName(selectedOrder, orderedByUser)}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-neutral-300">
                          <span className="inline-flex items-center gap-1">
                            <UserIcon className="h-3.5 w-3.5 text-neutral-500" />
                            <span>
                              {orderedByUser
                                ? (orderedByUser as any).gender
                                  ? String((orderedByUser as any).gender)
                                      .charAt(0)
                                      .toUpperCase() +
                                    String((orderedByUser as any).gender).slice(1)
                                  : "Gender: —"
                                : "Gender: —"}
                            </span>
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <Hash className="h-3.5 w-3.5 text-neutral-500" />
                            <span>
                              DOB:{" "}
                              {orderedByUser
                                ? formatDateOnly((orderedByUser as any).dob)
                                : "—"}
                              {orderedByUser &&
                              (orderedByUser as any).dob &&
                              calculateAgeFromDob((orderedByUser as any).dob) != null ? (
                                <span className="text-neutral-400">
                                  {" "}
                                  (
                                  {calculateAgeFromDob(
                                    (orderedByUser as any).dob
                                  )}{" "}
                                  yrs)
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-300">
                          {(orderedByUser as any)?.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-neutral-500" />
                              <span className="break-all">
                                {(orderedByUser as any).email}
                              </span>
                            </span>
                          )}
                          {((orderedByUser as any)?.phone ||
                            (orderedByUser as any)?.phoneNumber) && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 text-neutral-500" />
                              <span>
                                {(orderedByUser as any).phone ||
                                  (orderedByUser as any).phoneNumber}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Priority */}
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={[
                            "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-medium",
                            priorityBadgeClasses(
                              ((orderedByUser as any)?.user_priority as string) ||
                                "yellow"
                            ),
                          ].join(" ")}
                        >
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {String(
                            ((orderedByUser as any)?.user_priority as string) ||
                              "yellow"
                          ).toLowerCase()}
                        </span>

                        <select
                          value={
                            String(
                              ((orderedByUser as any)?.user_priority as string) ||
                                "yellow"
                            ).toLowerCase()
                          }
                          disabled={prioritySaving || !orderedByUser}
                          onChange={(e) => handlePriorityChange(e.target.value)}
                          className="mt-1 h-7 rounded-md border border-neutral-700 bg-neutral-950/60 px-2 text-[11px] text-neutral-100 outline-none focus:border-emerald-500"
                        >
                          <option value="yellow">yellow</option>
                          <option value="green">green</option>
                          <option value="red">red</option>
                        </select>
                      </div>
                    </div>

                    {priorityError && (
                      <div className="mt-2 rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
                        {priorityError}
                      </div>
                    )}

                    {/* Address */}
                    <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <p className="text-neutral-500">Address</p>
                        <p className="mt-0.5 text-neutral-100">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                            {orderedByUser
                              ? [
                                  (orderedByUser as any).address_line1 ||
                                    (orderedByUser as any).addressLine1 ||
                                    "",
                                  (orderedByUser as any).address_line2 ||
                                    (orderedByUser as any).addressLine2 ||
                                    "",
                                  (orderedByUser as any).city || "",
                                  (orderedByUser as any).county || "",
                                  (orderedByUser as any).postalcode ||
                                    (orderedByUser as any).postcode ||
                                    "",
                                  (orderedByUser as any).country || "",
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "—"
                              : "—"}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Weight management verification */}
                    {isWeightManagement && (
                      <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-medium text-neutral-200">
                            Verification (Weight Management)
                          </p>
                          {verificationError && (
                            <p className="text-[11px] text-rose-200">
                              {verificationError}
                            </p>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerify("scr_verified")}
                            disabled={verifyingField === "scr_verified" || !orderedByUser}
                            className={[
                              "inline-flex items-center gap-2 rounded-md border px-3 py-1 text-[11px]",
                              (orderedByUser as any)?.scr_verified
                                ? "border-emerald-600/60 bg-emerald-600/10 text-emerald-200"
                                : "border-neutral-700 bg-neutral-900/60 text-neutral-200 hover:border-neutral-500",
                            ].join(" ")}
                          >
                            {(orderedByUser as any)?.scr_verified ? (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            ) : (
                              <ShieldAlert className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {verifyingField === "scr_verified"
                                ? "Updating…"
                                : (orderedByUser as any)?.scr_verified
                                ? "SCR verified"
                                : "SCR not verified"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVerify("id_verified")}
                            disabled={verifyingField === "id_verified" || !orderedByUser}
                            className={[
                              "inline-flex items-center gap-2 rounded-md border px-3 py-1 text-[11px]",
                              (orderedByUser as any)?.id_verified
                                ? "border-emerald-600/60 bg-emerald-600/10 text-emerald-200"
                                : "border-neutral-700 bg-neutral-900/60 text-neutral-200 hover:border-neutral-500",
                            ].join(" ")}
                          >
                            {(orderedByUser as any)?.id_verified ? (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            ) : (
                              <ShieldAlert className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {verifyingField === "id_verified"
                                ? "Updating…"
                                : (orderedByUser as any)?.id_verified
                                ? "ID verified"
                                : "ID not verified"}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order summary */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <p className="mb-2 text-xs font-semibold text-neutral-200">
                      Order summary
                    </p>

                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
                      <div>
                        <dt className="text-neutral-500">Reference</dt>
                        <dd className="text-neutral-100">
                          {(selectedOrder as any).reference ||
                            (selectedOrder as any)._id}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Service</dt>
                        <dd className="text-neutral-100">
                          {(selectedOrder as any).service_name || "—"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Created at</dt>
                        <dd className="text-neutral-100">
                          {formatDateTime(
                            (selectedOrder as any).createdAt ||
                              (selectedOrder as any).created_at
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Appointment</dt>
                        <dd className="text-neutral-100">
                          {formatDateTime(
                            (selectedOrder as any).meta?.appointment_start_at ||
                              (selectedOrder as any).start_at
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Total incl. VAT</dt>
                        <dd className="text-neutral-100">
                          {formatMoney(
                            (selectedOrder as any).meta?.totalMinor ??
                              (selectedOrder as any).total_minor ??
                              null
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Payment</dt>
                        <dd className="text-neutral-100 capitalize">
                          {String((selectedOrder as any).payment_status || "—").replace(
                            /_/g,
                            " "
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* RAF */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <p className="mb-2 text-xs font-semibold text-neutral-200">
                      Risk Assessment Form (RAF)
                    </p>

                    {normalizeRafQAs(selectedOrder).length === 0 ? (
                      <p className="text-[11px] text-neutral-400">
                        No Risk Assessment data captured for this order.
                      </p>
                    ) : (
                      <ol className="space-y-3">
                        {normalizeRafQAs(selectedOrder).map((qa: any, idx: number) => (
                          <li
                            key={idx}
                            className="rounded-md border border-neutral-800 bg-neutral-950/40 px-3 py-2"
                          >
                            <p className="text-xs font-medium text-neutral-100">
                              {idx + 1}. {qa.question}
                            </p>
                            <div className="mt-1">
                              <p className="text-[11px] text-neutral-300">
                                <span className="font-semibold text-neutral-400">
                                  Answer:
                                </span>{" "}
                                {qa.answer ?? "—"}
                              </p>
                              {/* if file uploads exist */}
                              {qa.raw ? renderRafAnswer(qa) : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <p className="mb-2 text-xs font-semibold text-neutral-200">
                      Notes
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Admin notes */}
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                        <p className="text-[11px] font-semibold text-neutral-200">
                          Admin notes
                        </p>

                        <div className="mt-2 space-y-2">
                          {adminNotes.length === 0 ? (
                            <p className="text-[11px] text-neutral-500">
                              No admin notes yet.
                            </p>
                          ) : (
                            adminNotes.map((n, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-2 py-1"
                              >
                                <p className="text-[11px] text-neutral-100">
                                  {n}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAdminNote(idx)}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 hover:border-rose-500/70 hover:text-rose-200"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="mt-2 flex gap-2">
                          <input
                            value={newAdminNote}
                            onChange={(e) => setNewAdminNote(e.target.value)}
                            className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-950/60 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                            placeholder="Add admin note…"
                          />
                          <button
                            type="button"
                            onClick={handleAddAdminNote}
                            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Consultation notes */}
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                        <p className="text-[11px] font-semibold text-neutral-200">
                          Consultation notes
                        </p>

                        <div className="mt-2 space-y-2">
                          {consultationNotes.length === 0 ? (
                            <p className="text-[11px] text-neutral-500">
                              No consultation notes yet.
                            </p>
                          ) : (
                            consultationNotes.map((n, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-2 py-1"
                              >
                                <p className="text-[11px] text-neutral-100">
                                  {n}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveConsultationNote(idx)}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 hover:border-rose-500/70 hover:text-rose-200"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="mt-2 flex gap-2">
                          <input
                            value={newConsultationNote}
                            onChange={(e) => setNewConsultationNote(e.target.value)}
                            className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-950/60 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                            placeholder="Add consultation note…"
                          />
                          <button
                            type="button"
                            onClick={handleAddConsultationNote}
                            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Existing rejection notes (read-only) */}
                    {existingRejectionNotes.length > 0 && (
                      <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                        <p className="text-[11px] font-semibold text-neutral-200">
                          Existing rejection notes
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-neutral-200">
                          {existingRejectionNotes.map((n, idx) => (
                            <li key={idx} className="break-words">
                              {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-neutral-400">
                        Approve or reject this order. Rejection requires at least
                        one note.
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={statusAction === "approved" || statusAction === "rejected"}
                          onClick={openRejectDialog}
                          className={[
                            "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[11px]",
                            statusAction
                              ? "border-neutral-800 bg-neutral-900/40 text-neutral-500"
                              : "border-rose-700/60 bg-rose-950/30 text-rose-100 hover:border-rose-500/70",
                          ].join(" ")}
                        >
                          {statusAction === "rejected" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ThumbsDown className="h-3.5 w-3.5" />
                          )}
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          disabled={statusAction === "approved" || statusAction === "rejected"}
                          onClick={handleApprove}
                          className={[
                            "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[11px]",
                            statusAction
                              ? "border-neutral-800 bg-neutral-900/40 text-neutral-500"
                              : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500",
                          ].join(" ")}
                        >
                          {statusAction === "approved" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ThumbsUp className="h-3.5 w-3.5" />
                          )}
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>

                    {detailError && (
                      <div className="mt-3 rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
                        {detailError}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-neutral-400">No order selected.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------- Reject Dialog ----------------------------- */}
      {showRejectDialog && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowRejectDialog(false)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">Reject order</p>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Add one or more rejection notes. These will be saved with the
                  order.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRejectDialog(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:border-neutral-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                  Add note
                </label>
                <div className="flex gap-2">
                  <input
                    value={rejectionNoteInput}
                    onChange={(e) => setRejectionNoteInput(e.target.value)}
                    className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="Reason for rejection…"
                  />
                  <button
                    type="button"
                    onClick={handleAddRejectionNote}
                    className="inline-flex h-8 items-center rounded-md border border-neutral-700 bg-neutral-900/80 px-3 text-[11px] text-neutral-200 hover:border-neutral-500"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-2">
                <p className="mb-2 text-[11px] font-medium text-neutral-300">
                  Notes to be saved
                </p>

                {existingRejectionNotes.length === 0 &&
                newRejectionNotes.length === 0 &&
                !rejectionNoteInput.trim() ? (
                  <p className="text-[11px] text-neutral-500">
                    No rejection notes added yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {existingRejectionNotes.map((n, idx) => (
                      <div
                        key={`ex-${idx}`}
                        className="rounded-md border border-neutral-800 bg-neutral-950/40 px-2 py-1 text-[11px] text-neutral-200"
                      >
                        {n}
                      </div>
                    ))}

                    {newRejectionNotes.map((n, idx) => (
                      <div
                        key={`new-${idx}`}
                        className="flex items-start justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-2 py-1"
                      >
                        <p className="text-[11px] text-neutral-100">{n}</p>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewRejectionNote(idx)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 hover:border-rose-500/70 hover:text-rose-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {rejectionNoteInput.trim() && (
                      <div className="rounded-md border border-dashed border-neutral-700 bg-neutral-950/30 px-2 py-1 text-[11px] text-neutral-300">
                        {rejectionNoteInput.trim()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {rejectError && (
                <div className="rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
                  {rejectError}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectDialog(false)}
                  className="inline-flex h-8 items-center rounded-md border border-neutral-700 bg-neutral-900/80 px-3 text-[11px] text-neutral-200 hover:border-neutral-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={statusAction === "rejected"}
                  onClick={confirmReject}
                  className={[
                    "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[11px]",
                    statusAction === "rejected"
                      ? "border-rose-700/70 bg-rose-700/40 text-rose-50"
                      : "border-rose-600 bg-rose-600 text-white hover:bg-rose-500",
                  ].join(" ")}
                >
                  {statusAction === "rejected" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Rejecting…</span>
                    </>
                  ) : (
                    <>
                      <ThumbsDown className="h-3.5 w-3.5" />
                      <span>Confirm reject</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
