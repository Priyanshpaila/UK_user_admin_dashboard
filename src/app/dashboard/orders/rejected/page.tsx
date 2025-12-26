/* eslint-disable @next/next/no-img-element */
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
  CreditCard,
  ArrowRight,
  Filter,
  X,
  ClipboardList,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Hash,
} from "lucide-react";

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

/* ----------------- URL helper (for RAF attachments) ----------------- */

function resolveImageUrl(imagePath?: string | null): string {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;

  const baseWithApi = getBackendBase();
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");
  return `${cleanBase}${normalizedPath}`;
}

/* ----------------- API unwrap helpers (robust) ----------------- */

function unwrapOrder(res: any): OrderDto {
  return (res?.data ?? res?.order ?? res) as OrderDto;
}

function unwrapUser(res: any): UserDto | null {
  if (!res) return null;
  const u = (res?.data ?? res?.user ?? res) as any;
  if (!u || typeof u !== "object") return null;
  return u as UserDto;
}

function unwrapOrdersList(res: any): { orders: OrderDto[]; meta: OrdersListMeta | null } {
  const orders = (res?.data ??
    res?.orders ??
    res?.items ??
    (Array.isArray(res) ? res : [])) as OrderDto[];
  const meta = (res?.meta ?? res?.pagination ?? null) as OrdersListMeta | null;
  return { orders: Array.isArray(orders) ? orders : [], meta };
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

type OrderItemRow = {
  name: string;
  qty: number;
  variation: string;
  totalMinor: number | null;
  unitMinor: number | null;
};

function toNumberOrNull(v: any): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function extractOrderItems(order: any): OrderItemRow[] {
  const meta: any = order?.meta || {};

  const raw = meta?.items ?? meta?.lines ?? order?.items ?? [];
  const arr = Array.isArray(raw) ? raw : [];
  if (!arr.length) return [];

  return arr
    .map((it: any) => {
      const name = String(it?.name || it?.title || it?.medicine_name || "Item").trim();

      const qtyRaw = it?.qty ?? it?.quantity ?? it?.count ?? 1;
      const qty = Math.max(1, toNumberOrNull(qtyRaw) ?? 1);

      const variation = String(
        it?.variation || it?.variations || it?.strength || "Standard"
      ).trim();

      const unitMinor =
        toNumberOrNull(it?.unitMinor) ??
        toNumberOrNull(it?.unit_minor) ??
        toNumberOrNull(it?.priceMinor) ??
        toNumberOrNull(it?.price_minor) ??
        null;

      const totalMinorExplicit =
        toNumberOrNull(it?.totalMinor) ?? toNumberOrNull(it?.total_minor) ?? null;

      const totalMinor =
        totalMinorExplicit != null ? totalMinorExplicit : unitMinor != null ? unitMinor * qty : null;

      return { name, qty, variation, totalMinor, unitMinor };
    })
    .filter((x) => x.name.length > 0);
}

/* ----------------- RAF extraction + render (same approach) ----------------- */

function getRafQAs(order: any): Array<{ question: string; answer: string; raw?: any }> {
  const meta: any = order?.meta || {};

  const forms = meta?.formsQA?.raf?.qa;
  if (Array.isArray(forms) && forms.length) {
    return forms.map((qa: any, idx: number) => ({
      question: String(qa?.question || qa?.key || `Question ${idx + 1}`),
      answer:
        qa?.answer != null
          ? String(qa.answer)
          : qa?.raw == null
          ? "—"
          : Array.isArray(qa.raw)
          ? qa.raw.map(String).join(", ")
          : String(qa.raw),
      raw: qa?.raw,
    }));
  }

  const ra = meta?.riskAssessment || meta?.raf || order?.riskAssessment || order?.raf || null;

  if (Array.isArray(ra)) {
    return ra.map((it: any, idx: number) => {
      const question = String(it?.question || it?.key || it?.label || `Question ${idx + 1}`);
      const value = it?.value ?? it?.answer ?? it?.raw ?? it?.response ?? it;

      if (Array.isArray(value) && value.length && typeof value[0] === "object") {
        return {
          question,
          answer: `${value.length} attachment${value.length === 1 ? "" : "s"}`,
          raw: value,
        };
      }

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
    });
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
      raw: Array.isArray(v) && v.length && typeof (v as any[])[0] === "object" ? v : null,
    }));
  }

  return [];
}

function RafAnswer({ raw, answer }: { raw: any; answer: string }) {
  const isFileArray =
    Array.isArray(raw) &&
    raw.length > 0 &&
    typeof raw[0] === "object" &&
    ((raw[0] as any).url || (raw[0] as any).name);

  if (!isFileArray) {
    return <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-neutral-100">{answer}</p>;
  }

  const files = (raw as any[]).filter((f) => f && (f.url || f.name));
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {files.map((file: any, i: number) => {
        const fileUrl = resolveImageUrl(file.url || "");
        if (!fileUrl) return null;

        const isImage =
          (file.type || file.mimeType || "").startsWith("image/") ||
          /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || file.url || "");

        if (isImage) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => window.open(fileUrl, "_blank")}
              className="group relative overflow-hidden rounded border border-neutral-800 bg-neutral-900"
              title="Open image"
            >
              <img
                src={fileUrl}
                alt={file.name || `Attachment ${i + 1}`}
                className="max-h-24 max-w-[180px] object-contain"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] text-neutral-200 opacity-0 group-hover:opacity-100">
                {file.name || "Open"}
              </span>
            </button>
          );
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => window.open(fileUrl, "_blank")}
            className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] text-emerald-200 hover:border-emerald-500 hover:text-emerald-100"
          >
            {file.name || `Attachment ${i + 1}`}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------- Notes extraction (robust) ----------------- */

function normaliseStringArray(v: any): string[] {
  const arr = Array.isArray(v) ? v : v == null ? [] : [v];
  return arr.map((x) => String(x).trim()).filter((x) => x.length > 0);
}

function extractAdminNotes(order: any): string[] {
  const o: any = order;
  const m: any = o?.meta || {};
  return normaliseStringArray(o?.admin_notes ?? m?.admin_notes ?? []);
}

function extractConsultationNotes(order: any): string[] {
  const o: any = order;
  const m: any = o?.meta || {};
  const raw =
    o?.consultation_notes ??
    o?.consultant_notes ??
    o?.consultationNotes ??
    m?.consultation_notes ??
    m?.consultationNotes ??
    m?.consultant_notes ??
    m?.consultantNotes ??
    [];
  return normaliseStringArray(raw);
}

function extractRejectionNotes(order: any): string[] {
  const o: any = order;
  const m: any = o?.meta || {};
  const raw =
    o?.rejection_notes ??
    o?.rejected_notes ??
    o?.reject_notes ??
    o?.rejection_reason ??
    o?.rejected_reason ??
    m?.rejection_notes ??
    m?.rejected_notes ??
    m?.reject_notes ??
    m?.rejection_reason ??
    m?.rejected_reason ??
    [];
  return normaliseStringArray(raw);
}

/* ----------------------------- Page ----------------------------- */

export default function Page() {
  // list state
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<OrdersListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cache user_id -> user
  const [orderUsers, setOrderUsers] = useState<Record<string, UserDto | null>>({});
  const orderUsersRef = useRef<Record<string, UserDto | null>>({});
  useEffect(() => {
    orderUsersRef.current = orderUsers;
  }, [orderUsers]);

  // detail drawer state
  const [showDetail, setShowDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [orderedByUser, setOrderedByUser] = useState<UserDto | null>(null);

  // notes state (detail)
  const [adminNotes, setAdminNotes] = useState<string[]>([]);
  const [consultationNotes, setConsultationNotes] = useState<string[]>([]);
  const [rejectionNotes, setRejectionNotes] = useState<string[]>([]);

  // hard-coded filter
  const STATUS = "rejected";

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);
      try {
        const res: any = await getOrdersApi({ status: STATUS });
        if (cancelled) return;

        const { orders: ordersList, meta: metaRes } = unwrapOrdersList(res);
        setOrders(ordersList);
        setMeta(metaRes);

        const uniqueUserIds = Array.from(
          new Set(
            ordersList
              .map((o: any) => extractUserIdFromOrder(o))
              .filter(Boolean)
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

  function hydrateNotes(order: OrderDto) {
    setAdminNotes(extractAdminNotes(order));
    setConsultationNotes(extractConsultationNotes(order));
    setRejectionNotes(extractRejectionNotes(order));
  }

  async function handleViewDetails(id: string) {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedOrder(null);
    setOrderedByUser(null);

    setAdminNotes([]);
    setConsultationNotes([]);
    setRejectionNotes([]);

    try {
      const orderRes = await getOrderByIdApi(id);
      const order = unwrapOrder(orderRes);
      setSelectedOrder(order);
      hydrateNotes(order);

      const userId = extractUserIdFromOrder(order);
      if (userId) {
        if (orderUsersRef.current[userId] !== undefined) {
          setOrderedByUser(orderUsersRef.current[userId] || null);
        } else {
          try {
            const userRes = await getUserByIdApi(userId);
            const u = unwrapUser(userRes);
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

  function closeDetail() {
    setShowDetail(false);
    setSelectedOrder(null);
    setOrderedByUser(null);
    setDetailError(null);
  }

  const totalRejected = (meta as any)?.total ?? orders.length;

  const rows = useMemo(() => {
    return orders.map((order: any) => {
      const userId = extractUserIdFromOrder(order) || undefined;
      const listUser = userId && orderUsers[userId] !== undefined ? orderUsers[userId] : null;

      const patientName = getDisplayPatientName(order, listUser);
      const priority = ((listUser as any)?.user_priority as string | undefined) || "yellow";
      const totalMinor = extractTotalMinor(order);
      const productName = extractProductName(order);
      const reference = order?.reference || order?._id;

      return { order, reference, patientName, listUser, priority, totalMinor, productName };
    });
  }, [orders, orderUsers]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white md:text-3xl">Rejected Orders</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Orders that have been rejected. Open an order to review notes, reasons, RAF, and items.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/70 px-3 py-1.5 text-xs text-neutral-300">
              <Filter size={14} />
              <span>Status:</span>
              <span className="font-medium text-rose-300">Rejected</span>
            </div>
            <span className="text-xs text-neutral-500">
              {totalRejected} rejected{" "}
              {meta ? `• page ${(meta as any).page} of ${(meta as any).totalPages}` : ""}
            </span>
          </div>
        </div>

        {/* List content (TABLE layout like Pending Orders page) */}
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
            No rejected orders found.
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
                    <th className="px-3 py-2 text-left font-medium">Priority</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map(({ order, reference, patientName, listUser, priority, totalMinor, productName }) => {
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
                            <span className="font-medium text-neutral-100">{reference}</span>
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
                            {order?.service_name || "—"}
                          </p>
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
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------- Detail Drawer (same style) ----------------------------- */}
      {showDetail && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={closeDetail} />
          <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-neutral-800 bg-neutral-950">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">Order reference</p>
                <p className="text-sm font-semibold text-white">
                  {selectedOrder ? (selectedOrder as any).reference || (selectedOrder as any)._id : "—"}
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
                        <span className="capitalize">
                          {String((selectedOrder as any).status).replace(/_/g, " ")}
                        </span>
                      </span>
                    )}

                    {(selectedOrder as any).payment_status && (
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                          paymentBadgeClasses(String((selectedOrder as any).payment_status)),
                        ].join(" ")}
                      >
                        <CreditCard className="h-3 w-3" />
                        <span className="capitalize">
                          {String((selectedOrder as any).payment_status).replace(/_/g, " ")}
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
                                  ? String((orderedByUser as any).gender).charAt(0).toUpperCase() +
                                    String((orderedByUser as any).gender).slice(1)
                                  : "Gender: —"
                                : "Gender: —"}
                            </span>
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <Hash className="h-3.5 w-3.5 text-neutral-500" />
                            <span>
                              DOB: {orderedByUser ? formatDateOnly((orderedByUser as any).dob) : "—"}
                              {orderedByUser &&
                              (orderedByUser as any).dob &&
                              calculateAgeFromDob((orderedByUser as any).dob) != null ? (
                                <span className="text-neutral-400">
                                  {" "}
                                  ({calculateAgeFromDob((orderedByUser as any).dob)} yrs)
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-300">
                          {(orderedByUser as any)?.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-neutral-500" />
                              <span className="break-all">{(orderedByUser as any).email}</span>
                            </span>
                          )}
                          {((orderedByUser as any)?.phone || (orderedByUser as any)?.phoneNumber) && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 text-neutral-500" />
                              <span>{(orderedByUser as any).phone || (orderedByUser as any).phoneNumber}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

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
                  </div>

                  {/* Order summary */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <p className="mb-2 text-xs font-semibold text-neutral-200">Order summary</p>

                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
                      <div>
                        <dt className="text-neutral-500">Reference</dt>
                        <dd className="text-neutral-100">
                          {(selectedOrder as any).reference || (selectedOrder as any)._id}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Service</dt>
                        <dd className="text-neutral-100">{(selectedOrder as any).service_name || "—"}</dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Created at</dt>
                        <dd className="text-neutral-100">
                          {formatDateTime((selectedOrder as any).createdAt || (selectedOrder as any).created_at)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Appointment</dt>
                        <dd className="text-neutral-100">
                          {formatDateTime(extractAppointmentStart(selectedOrder))}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Total incl. VAT</dt>
                        <dd className="text-neutral-100">{formatMoney(extractTotalMinor(selectedOrder))}</dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Payment</dt>
                        <dd className="text-neutral-100 capitalize">
                          {String((selectedOrder as any).payment_status || "—").replace(/_/g, " ")}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Items */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-neutral-300" />
                        <p className="text-xs font-semibold text-neutral-200">Items</p>
                        <span className="rounded-full border border-neutral-800 bg-neutral-950/60 px-2 py-0.5 text-[10px] text-neutral-400">
                          {extractOrderItems(selectedOrder).length}
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-400">
                        Total:{" "}
                        <span className="font-semibold text-neutral-100">
                          {formatMoney(extractTotalMinor(selectedOrder))}
                        </span>
                      </p>
                    </div>

                    {extractOrderItems(selectedOrder).length ? (
                      <div className="space-y-1">
                        {extractOrderItems(selectedOrder).map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-3 border-b border-neutral-800/60 py-2 last:border-none"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-neutral-100">{it.name}</p>
                              <p className="mt-0.5 text-[10px] text-neutral-500">
                                {it.variation || "Standard"}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-[10px] text-neutral-400">Qty: {it.qty}</p>
                              {it.totalMinor != null ? (
                                <p className="mt-0.5 text-[11px] font-semibold text-neutral-100">
                                  {formatMoney(it.totalMinor)}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-[10px] text-neutral-600">—</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-neutral-500">No items found on this order.</p>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <p className="mb-2 text-xs font-semibold text-neutral-200">Notes</p>

                    {adminNotes.length === 0 && consultationNotes.length === 0 && rejectionNotes.length === 0 ? (
                      <p className="text-[11px] text-neutral-500">No notes found for this order.</p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                          <p className="text-[11px] font-semibold text-neutral-200">Admin notes</p>
                          {adminNotes.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-neutral-200">
                              {adminNotes.map((n, idx) => (
                                <li key={idx} className="break-words">
                                  {n}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-[11px] text-neutral-500">No admin notes.</p>
                          )}
                        </div>

                        <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                          <p className="text-[11px] font-semibold text-neutral-200">Consultation notes</p>
                          {consultationNotes.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-neutral-200">
                              {consultationNotes.map((n, idx) => (
                                <li key={idx} className="break-words">
                                  {n}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-[11px] text-neutral-500">No consultation notes.</p>
                          )}
                        </div>

                        <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                          <p className="text-[11px] font-semibold text-neutral-200">Rejection notes</p>
                          {rejectionNotes.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-neutral-200">
                              {rejectionNotes.map((n, idx) => (
                                <li key={idx} className="break-words">
                                  {n}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-[11px] text-neutral-500">No rejection notes.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RAF */}
                  {getRafQAs(selectedOrder).length ? (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                      <p className="mb-2 text-xs font-semibold text-neutral-200">
                        RAF Questions &amp; Answers
                      </p>

                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {getRafQAs(selectedOrder).map((qa, idx) => (
                          <div
                            key={idx}
                            className="border-b border-neutral-800/60 pb-2 text-[11px] last:border-none"
                          >
                            <p className="font-medium text-neutral-400">
                              {idx + 1}. {qa.question}
                            </p>
                            <RafAnswer raw={qa.raw} answer={qa.answer} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                      <p className="text-[11px] text-neutral-400">No Risk Assessment data captured for this order.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-neutral-400">No order selected.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
