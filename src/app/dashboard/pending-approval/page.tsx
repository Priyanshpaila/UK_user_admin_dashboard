/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  updateOrderStatusApi, // ✅ use same API as approve/reject
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
  Pencil,
  Save,
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

/* ----------------- URL helper (same as Approved page) ----------------- */

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

function unwrapOrdersList(res: any): {
  orders: OrderDto[];
  meta: OrdersListMeta | null;
} {
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

  const raw =
    meta?.items ??
    meta?.lines ??
    order?.items ??
    [];

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
        toNumberOrNull(it?.totalMinor) ??
        toNumberOrNull(it?.total_minor) ??
        null;

      const totalMinor =
        totalMinorExplicit != null
          ? totalMinorExplicit
          : unitMinor != null
          ? unitMinor * qty
          : null;

      return { name, qty, variation, totalMinor, unitMinor };
    })
    .filter((x) => x.name.length > 0);
}

/* ----------------- RAF extraction + render (SAME AS APPROVED PAGE) ----------------- */

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

  const ra =
    meta?.riskAssessment ||
    meta?.raf ||
    order?.riskAssessment ||
    order?.raf ||
    null;

  if (Array.isArray(ra)) {
    return ra.map((it: any, idx: number) => {
      const question = String(
        it?.question || it?.key || it?.label || `Question ${idx + 1}`
      );
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
      raw: Array.isArray(v) && v.length && typeof v[0] === "object" ? v : null,
    }));
  }

  return [];
}

function RafAnswer({ raw, answer }: { raw: any; answer: string }) {
  const isFileArray =
    Array.isArray(raw) &&
    raw.length > 0 &&
    typeof raw[0] === "object" &&
    (raw[0].url || raw[0].name);

  if (!isFileArray) {
    return (
      <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-neutral-100">
        {answer}
      </p>
    );
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

/* ----------------- Notes extraction (more robust) ----------------- */

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
    o?.rejection_reason ??
    o?.rejected_reason ??
    m?.rejection_notes ??
    m?.rejected_notes ??
    m?.rejection_reason ??
    m?.rejected_reason ??
    [];
  return normaliseStringArray(raw);
}

/* ----------------- NEW: Safe meta item editing helpers ----------------- */

function deepClone<T>(v: T): T {
  if (v == null) return v;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
}

function computeUnitMinorFallback(it: any): number {
  const qty = Math.max(1, Math.floor(toNumberOrNull(it?.qty ?? it?.quantity) ?? 1));
  const totalMinor =
    toNumberOrNull(it?.totalMinor) ??
    toNumberOrNull(it?.total_minor) ??
    null;
  if (totalMinor != null) return Math.max(0, Math.round(totalMinor / qty));
  const priceMajor = toNumberOrNull(it?.price) ?? null;
  if (priceMajor != null) return Math.max(0, Math.round(priceMajor * 100));
  return 0;
}

function normalizeEditableItem(it: any, idx: number) {
  const qty = Math.max(1, Math.floor(toNumberOrNull(it?.qty ?? it?.quantity) ?? 1));
  const unitMinor =
    Math.max(
      0,
      Math.floor(
        toNumberOrNull(it?.unitMinor ?? it?.unit_minor ?? it?.priceMinor ?? it?.price_minor) ??
          computeUnitMinorFallback(it)
      )
    ) || 0;

  const totalMinor = unitMinor * qty;
  const variation = String(it?.variation || it?.strength || "Standard").trim();
  const name = String(it?.name || it?.title || it?.medicine_name || "Item").trim();

  return {
    ...it,
    __key: String(it?.sku || it?._id || it?.id || idx),
    name,
    variation,
    qty,
    unitMinor,
    totalMinor,
    unit_minor: unitMinor,
    total_minor: totalMinor,
    price: unitMinor / 100,
    line_total: totalMinor / 100,
  };
}

function getMetaItemsSource(order: any): { source: "items" | "lines" | "none"; arr: any[] } {
  const meta: any = order?.meta || {};
  const items = Array.isArray(meta?.items) ? meta.items : [];
  const lines = Array.isArray(meta?.lines) ? meta.lines : [];
  if (items.length) return { source: "items", arr: items };
  if (lines.length) return { source: "lines", arr: lines };
  return { source: "none", arr: [] };
}

function calcTotalsFromEditableItems(items: any[], baseMeta: any) {
  const subtotalMinor = items.reduce((sum, it) => {
    const qty = Math.max(1, Math.floor(toNumberOrNull(it?.qty) ?? 1));
    const unitMinor = Math.max(0, Math.floor(toNumberOrNull(it?.unitMinor) ?? 0));
    return sum + qty * unitMinor;
  }, 0);

  const feesMinor =
    toNumberOrNull(baseMeta?.feesMinor) ??
    toNumberOrNull(baseMeta?.fees_minor) ??
    0;

  const totalMinor = subtotalMinor + feesMinor;

  return {
    subtotalMinor,
    feesMinor,
    totalMinor,
    subtotal: subtotalMinor / 100,
    fees: feesMinor / 100,
    total: totalMinor / 100,
  };
}

/* ----------------------------- Page ----------------------------- */

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

  // detail drawer state
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
  const [existingRejectionNotes, setExistingRejectionNotes] = useState<string[]>([]);
  const [newRejectionNotes, setNewRejectionNotes] = useState<string[]>([]);
  const [rejectionNoteInput, setRejectionNoteInput] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // approve / reject action state
  const [statusAction, setStatusAction] = useState<"approved" | "rejected" | null>(null);

  // verification buttons state
  const [verifyingField, setVerifyingField] = useState<"scr_verified" | "id_verified" | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // priority editing state
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);

  // previous orders state
  const [previousOrders, setPreviousOrders] = useState<OrderDto[]>([]);
  const [previousOrdersMeta, setPreviousOrdersMeta] = useState<OrdersListMeta | null>(null);
  const [previousOrdersLoading, setPreviousOrdersLoading] = useState(false);
  const [previousOrdersError, setPreviousOrdersError] = useState<string | null>(null);

  // ✅ NEW: item editing state (safe meta merge)
  const [itemsEditing, setItemsEditing] = useState(false);
  const [itemsDraft, setItemsDraft] = useState<any[]>([]);
  const [itemsSaveLoading, setItemsSaveLoading] = useState(false);
  const [itemsSaveError, setItemsSaveError] = useState<string | null>(null);

  // global stats actions (for sidebar badges)
  const { applyStatusChange, refresh: refreshStats } = useOrdersStats();

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
        if (cancelled) return;

        const { orders: ordersList, meta: metaRes } = unwrapOrdersList(res);

        setOrders(ordersList);
        setMeta(metaRes);

        // fetch users for all distinct user_ids in list
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

        await refreshStats();
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
  }, [refreshStats]);

  // helper to reset notes state when opening a different order
  function hydrateNotes(order: OrderDto) {
    setAdminNotes(extractAdminNotes(order));
    setNewAdminNote("");

    setConsultationNotes(extractConsultationNotes(order));
    setNewConsultationNote("");

    const existingRejection = extractRejectionNotes(order);
    setExistingRejectionNotes(existingRejection);
    setNewRejectionNotes([]);
    setRejectionNoteInput("");
    setRejectError(null);
  }

  // ✅ NEW: hydrate items draft (from meta.items or meta.lines), preserving full object fields
  function hydrateItems(order: OrderDto) {
    const { arr } = getMetaItemsSource(order);
    const cloned = deepClone(arr);
    const normalized = (Array.isArray(cloned) ? cloned : []).map((it: any, idx: number) =>
      normalizeEditableItem(it, idx)
    );
    setItemsDraft(normalized);
    setItemsEditing(false);
    setItemsSaveError(null);
    setItemsSaveLoading(false);
  }

  async function fetchPreviousOrdersForUser(userId: string, excludeId?: string) {
    setPreviousOrdersLoading(true);
    setPreviousOrdersError(null);
    setPreviousOrders([]);
    setPreviousOrdersMeta(null);

    try {
      const res: any = await getOrdersApi({
        user_id: userId,
        page: 1,
        limit: 20,
      });

      const { orders: list, meta: m } = unwrapOrdersList(res);

      const filtered = excludeId ? list.filter((o) => idOf(o) !== excludeId) : list;

      filtered.sort((a: any, b: any) => {
        const ta = new Date(
          extractAppointmentStart(a) || a?.createdAt || a?.created_at || 0
        ).getTime();
        const tb = new Date(
          extractAppointmentStart(b) || b?.createdAt || b?.created_at || 0
        ).getTime();
        return tb - ta;
      });

      setPreviousOrders(filtered);
      setPreviousOrdersMeta(m);
    } catch (e: any) {
      setPreviousOrdersError(e?.message || "Failed to load previous orders.");
    } finally {
      setPreviousOrdersLoading(false);
    }
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

    setPreviousOrders([]);
    setPreviousOrdersMeta(null);
    setPreviousOrdersError(null);
    setPreviousOrdersLoading(false);

    // ✅ reset item editing state
    setItemsEditing(false);
    setItemsDraft([]);
    setItemsSaveError(null);
    setItemsSaveLoading(false);

    try {
      const orderRes = await getOrderByIdApi(id);
      const order = unwrapOrder(orderRes);

      setSelectedOrder(order);
      hydrateNotes(order);
      hydrateItems(order);

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

        await fetchPreviousOrdersForUser(userId, idOf(order));
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

    setPreviousOrders([]);
    setPreviousOrdersMeta(null);
    setPreviousOrdersError(null);
    setPreviousOrdersLoading(false);

    // ✅ reset item editing state
    setItemsEditing(false);
    setItemsDraft([]);
    setItemsSaveError(null);
    setItemsSaveLoading(false);
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

  function bumpMetaAfterRemove() {
    setMeta((prev) => {
      if (!prev) return prev;
      const next: any = { ...prev };
      if (typeof next.total === "number") next.total = Math.max(0, next.total - 1);
      if (typeof next.totalItems === "number")
        next.totalItems = Math.max(0, next.totalItems - 1);
      return next;
    });
  }

  // ✅ NEW: start/cancel item edit
  function startItemsEdit() {
    if (!selectedOrder) return;
    const { arr } = getMetaItemsSource(selectedOrder);
    if (!arr.length) return;
    setItemsSaveError(null);
    setItemsEditing(true);
  }

  function cancelItemsEdit() {
    if (!selectedOrder) {
      setItemsEditing(false);
      setItemsDraft([]);
      return;
    }
    hydrateItems(selectedOrder);
  }

  // ✅ NEW: update draft row helpers
  function updateDraftRow(idx: number, patch: Partial<any>) {
    setItemsDraft((prev) => {
      const next = [...prev];
      const current = next[idx] || {};
      const merged = { ...current, ...patch };
      next[idx] = normalizeEditableItem(merged, idx);
      return next;
    });
  }

  function removeDraftRow(idx: number) {
    setItemsDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  // ✅ NEW: save edited items safely into meta WITHOUT losing other meta keys
  async function saveItemsEdit() {
    if (!selectedOrder) return;

    const selectedId = idOf(selectedOrder);
    const baseMeta: any = deepClone((selectedOrder as any)?.meta || {});
    const baseItems: any[] = Array.isArray(baseMeta?.items) ? deepClone(baseMeta.items) : [];
    const baseLines: any[] = Array.isArray(baseMeta?.lines) ? deepClone(baseMeta.lines) : [];

    if (!itemsDraft.length) {
      setItemsSaveError("No items to save.");
      return;
    }

    setItemsSaveLoading(true);
    setItemsSaveError(null);
    setDetailError(null);

    try {
      // normalize each draft item (keeps unknown fields), and ensure totals
      const normalizedDraft = itemsDraft.map((it: any, idx: number) =>
        normalizeEditableItem(it, idx)
      );

      // update meta.items by index (preserve existing fields where possible)
      const updatedItems = normalizedDraft.map((it: any, idx: number) => {
        const prev = baseItems[idx] || {};
        const merged = { ...prev, ...it };
        // strip internal key
        const { __key, ...clean } = merged;
        return clean;
      });

      // update meta.lines by index (preserve existing fields where possible)
      const updatedLines = normalizedDraft.map((it: any, idx: number) => {
        const prev = baseLines[idx] || {};
        const merged = {
          ...prev,
          index: prev?.index ?? idx,
          name: it.name,
          qty: it.qty,
          variation: it.variation,
          unitMinor: it.unitMinor,
          totalMinor: it.totalMinor,
          unit_minor: it.unitMinor,
          total_minor: it.totalMinor,
          price: it.unitMinor / 100,
          line_total: it.totalMinor / 100,
          sku: it?.sku || prev?.sku,
        };
        const { __key, ...clean } = merged as any;
        return clean;
      });

      // recompute totals (subtotal/total) but keep feesMinor untouched
      const totals = calcTotalsFromEditableItems(normalizedDraft, baseMeta);

      // update selectedProduct (keep other keys)
      const first = normalizedDraft[0];
      const nextSelectedProduct = {
        ...(baseMeta?.selectedProduct || {}),
        name: first?.name,
        variation: first?.variation,
        strength: (first?.strength ?? first?.variation) || (baseMeta?.selectedProduct?.strength ?? null),
        qty: first?.qty,
        unitMinor: first?.unitMinor,
        totalMinor: first?.totalMinor,
        price: first?.unitMinor / 100,
        line_total: first?.totalMinor / 100,
        currency: baseMeta?.currency || (baseMeta?.selectedProduct?.currency ?? "GBP"),
      };

      // ✅ IMPORTANT: send FULL meta object so nothing vanishes
      const nextMeta = {
        ...baseMeta,
        items: updatedItems,
        lines: updatedLines,
        subtotalMinor: totals.subtotalMinor,
        totalMinor: totals.totalMinor,
        subtotal: totals.subtotal,
        total: totals.total,
        // keep feesMinor/fees as-is, but also normalize if missing
        feesMinor:
          toNumberOrNull(baseMeta?.feesMinor) ??
          toNumberOrNull(baseMeta?.fees_minor) ??
          totals.feesMinor,
        fees:
          toNumberOrNull(baseMeta?.fees) ??
          (toNumberOrNull(baseMeta?.feesMinor) ?? toNumberOrNull(baseMeta?.fees_minor) ?? totals.feesMinor) / 100,
        selectedProduct: nextSelectedProduct,
      };

      // ✅ Use SAME update API
      const updatedRes = await updateOrderStatusApi(selectedId, {
        meta: nextMeta,
      });

      const updated = unwrapOrder(updatedRes);

      // update drawer order + list row
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o: any) => (idOf(o) === selectedId ? updated : o)));

      // refresh draft from returned order
      hydrateItems(updated);

      setItemsEditing(false);
    } catch (e: any) {
      setItemsSaveError(e?.message || "Failed to save items.");
    } finally {
      setItemsSaveLoading(false);
    }
  }

  // approve (FIXED: only remove selected order, not all)
  async function handleApprove() {
    if (!selectedOrder) return;

    // ✅ prevent approving while items edit is open (avoids accidental losing edits)
    if (itemsEditing) {
      setDetailError("Please save or cancel item edits before approving.");
      return;
    }

    const selectedId = idOf(selectedOrder);
    const prevStatus = String((selectedOrder as any).status || "pending");

    setStatusAction("approved");
    setDetailError(null);

    try {
      const payload: any = {
        status: "approved",
        admin_notes: adminNotes,
        consultation_notes: consultationNotes,
        consultant_notes: consultationNotes,
      };

      if (loggedInUserId) payload.approved_by = loggedInUserId;
      payload.approved_at = new Date().toISOString();

      const updatedRes = await updateOrderStatusApi(selectedId, payload);
      const updated = unwrapOrder(updatedRes);

      applyStatusChange(prevStatus, String((updated as any).status || "approved"));

      setOrders((prev) => prev.filter((o: any) => idOf(o) !== selectedId));
      bumpMetaAfterRemove();

      await refreshStats();
      closeDetail();
    } catch (e: any) {
      setDetailError(e?.message || "Failed to update order status");
    } finally {
      setStatusAction(null);
    }
  }

  // open reject dialog
  function openRejectDialog() {
    // ✅ prevent reject while items edit is open
    if (itemsEditing) {
      setDetailError("Please save or cancel item edits before rejecting.");
      return;
    }
    setShowRejectDialog(true);
    setRejectError(null);
  }

  // confirm reject (with rejection notes)
  async function confirmReject() {
    if (!selectedOrder) return;

    const selectedId = idOf(selectedOrder);

    const finalNotes = [
      ...existingRejectionNotes,
      ...newRejectionNotes,
      ...(rejectionNoteInput.trim() ? [rejectionNoteInput.trim()] : []),
    ];

    if (!finalNotes.length) {
      setRejectError("Please add at least one rejection note.");
      return;
    }

    const prevStatus = String((selectedOrder as any).status || "pending");

    setStatusAction("rejected");
    setRejectError(null);

    try {
      const payload: any = {
        status: "rejected",
        admin_notes: adminNotes,
        consultation_notes: consultationNotes,
        consultant_notes: consultationNotes,
        rejection_notes: finalNotes,
      };
      if (loggedInUserId) payload.rejected_by = loggedInUserId;
      payload.rejected_at = new Date().toISOString();

      const updatedRes = await updateOrderStatusApi(selectedId, payload);
      const updated = unwrapOrder(updatedRes);

      applyStatusChange(prevStatus, String((updated as any).status || "rejected"));

      setOrders((prev) => prev.filter((o: any) => idOf(o) !== selectedId));
      bumpMetaAfterRemove();

      setShowRejectDialog(false);
      await refreshStats();
      closeDetail();
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
      String((selectedOrder as any).service_slug).toLowerCase() === "weight-management") ||
      ((selectedOrder as any).service_name &&
        String((selectedOrder as any).service_name).toLowerCase() === "weight management"));

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

  const totalPending = (meta as any)?.total ?? orders.length;

  const rows = useMemo(() => {
    return orders.map((order: any) => {
      const userId = extractUserIdFromOrder(order) || undefined;
      const listUser =
        userId && orderUsers[userId] !== undefined ? orderUsers[userId] : null;

      const patientName = getDisplayPatientName(order, listUser);
      const priority =
        ((listUser as any)?.user_priority as string | undefined) || "yellow";

      const totalMinor =
        order?.total_minor ??
        order?.meta?.totalMinor ??
        order?.meta?.total_minor ??
        null;

      const appointmentAt = extractAppointmentStart(order);

      const productName = extractProductName(order);

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

  // ✅ computed totals for draft (used in edit UI)
  const itemsDraftTotals = useMemo(() => {
    const baseMeta: any = (selectedOrder as any)?.meta || {};
    return calcTotalsFromEditableItems(itemsDraft, baseMeta);
  }, [itemsDraft, selectedOrder]);

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
                    <th className="px-3 py-2 text-left font-medium">Reference</th>
                    <th className="px-3 py-2 text-left font-medium">Patient</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Product / Service
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Priority</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
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
                      productName,
                    }) => {
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
                    {selectedOrder ? (selectedOrder as any).service_name || "Service" : "—"}
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
                              DOB:{" "}
                              {orderedByUser ? formatDateOnly((orderedByUser as any).dob) : "—"}
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
                              <span>
                                {(orderedByUser as any).phone || (orderedByUser as any).phoneNumber}
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
                              ((orderedByUser as any)?.user_priority as string) || "yellow"
                            ),
                          ].join(" ")}
                        >
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {String(((orderedByUser as any)?.user_priority as string) || "yellow").toLowerCase()}
                        </span>

                        <select
                          value={String(((orderedByUser as any)?.user_priority as string) || "yellow").toLowerCase()}
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
                            <p className="text-[11px] text-rose-200">{verificationError}</p>
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
                          {(selectedOrder as any).reference || (selectedOrder as any)._id}
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
                            (selectedOrder as any).createdAt || (selectedOrder as any).created_at
                          )}
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
                        <dd className="text-neutral-100">
                          {formatMoney(extractTotalMinor(selectedOrder))}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-neutral-500">Payment</dt>
                        <dd className="text-neutral-100 capitalize">
                          {String((selectedOrder as any).payment_status || "—").replace(/_/g, " ")}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* ✅ Items (editable, safe meta merge) */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-neutral-300" />
                        <p className="text-xs font-semibold text-neutral-200">Items</p>
                        <span className="rounded-full border border-neutral-800 bg-neutral-950/60 px-2 py-0.5 text-[10px] text-neutral-400">
                          {itemsEditing ? itemsDraft.length : extractOrderItems(selectedOrder).length}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-neutral-400">
                          Total:{" "}
                          <span className="font-semibold text-neutral-100">
                            {itemsEditing
                              ? formatMoney(itemsDraftTotals.totalMinor)
                              : formatMoney(extractTotalMinor(selectedOrder))}
                          </span>
                        </p>

                        {!itemsEditing ? (
                          <button
                            type="button"
                            onClick={startItemsEdit}
                            disabled={!getMetaItemsSource(selectedOrder).arr.length}
                            className="inline-flex h-7 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100 disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={cancelItemsEdit}
                              disabled={itemsSaveLoading}
                              className="inline-flex h-7 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={saveItemsEdit}
                              disabled={itemsSaveLoading}
                              className="inline-flex h-7 items-center gap-2 rounded-md border border-emerald-600 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-500 disabled:opacity-60"
                            >
                              {itemsSaveLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              Save
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {itemsSaveError && (
                      <div className="mb-2 rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
                        {itemsSaveError}
                      </div>
                    )}

                    {!itemsEditing ? (
                      extractOrderItems(selectedOrder).length ? (
                        <div className="space-y-1">
                          {extractOrderItems(selectedOrder).map((it, idx) => (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-3 border-b border-neutral-800/60 py-2 last:border-none"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold text-neutral-100">
                                  {it.name}
                                </p>
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
                      )
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-[11px] text-neutral-300">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-neutral-400">Subtotal:</span>
                            <span className="font-semibold text-neutral-100">
                              {formatMoney(itemsDraftTotals.subtotalMinor)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-neutral-400">Fees:</span>
                            <span className="font-semibold text-neutral-100">
                              {formatMoney(itemsDraftTotals.feesMinor)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-neutral-400">Total:</span>
                            <span className="font-semibold text-neutral-100">
                              {formatMoney(itemsDraftTotals.totalMinor)}
                            </span>
                          </div>
                        </div>

                        {itemsDraft.map((it, idx) => (
                          <div
                            key={String(it.__key || idx)}
                            className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold text-neutral-100">
                                  {it.name}
                                </p>

                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                  <div>
                                    <p className="text-[10px] text-neutral-500">Variation</p>
                                    <input
                                      value={String(it.variation || "")}
                                      onChange={(e) => updateDraftRow(idx, { variation: e.target.value })}
                                      className="mt-1 h-8 w-full rounded-md border border-neutral-700 bg-neutral-950/60 px-2 text-[11px] text-neutral-100 outline-none focus:border-emerald-500"
                                      placeholder="e.g., 100 mg"
                                    />
                                  </div>

                                  <div>
                                    <p className="text-[10px] text-neutral-500">Qty</p>
                                    <input
                                      type="number"
                                      min={1}
                                      value={Number(it.qty || 1)}
                                      onChange={(e) =>
                                        updateDraftRow(idx, { qty: Math.max(1, Math.floor(Number(e.target.value || 1))) })
                                      }
                                      className="mt-1 h-8 w-full rounded-md border border-neutral-700 bg-neutral-950/60 px-2 text-[11px] text-neutral-100 outline-none focus:border-emerald-500"
                                    />
                                  </div>

                                  <div>
                                    <p className="text-[10px] text-neutral-500">Unit price (£)</p>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min={0}
                                      value={Number(((Number(it.unitMinor || 0) || 0) / 100).toFixed(2))}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        const minor = Number.isFinite(v) ? Math.max(0, Math.round(v * 100)) : 0;
                                        updateDraftRow(idx, { unitMinor: minor });
                                      }}
                                      className="mt-1 h-8 w-full rounded-md border border-neutral-700 bg-neutral-950/60 px-2 text-[11px] text-neutral-100 outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                </div>

                                <p className="mt-2 text-[10px] text-neutral-400">
                                  Line total:{" "}
                                  <span className="font-semibold text-neutral-100">
                                    {formatMoney(Number(it.totalMinor || 0))}
                                  </span>
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeDraftRow(idx)}
                                disabled={itemsSaveLoading}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/60 text-neutral-300 hover:border-rose-500/70 hover:text-rose-200 disabled:opacity-50"
                                title="Remove item"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
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
                      <p className="text-[11px] text-neutral-400">
                        No Risk Assessment data captured for this order.
                      </p>
                    </div>
                  )}

                  {/* Previous orders */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-neutral-200">
                        Previous orders of this patient
                      </p>
                      {previousOrdersMeta && (
                        <span className="text-[11px] text-neutral-500">
                          {(previousOrdersMeta as any).total ?? previousOrders.length} order
                          {((previousOrdersMeta as any).total ?? previousOrders.length) === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    {previousOrdersLoading ? (
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Loading previous orders…</span>
                      </div>
                    ) : previousOrdersError ? (
                      <p className="text-[11px] text-rose-300">{previousOrdersError}</p>
                    ) : previousOrders.length === 0 ? (
                      <p className="text-[11px] text-neutral-500">
                        No previous orders found for this patient.
                      </p>
                    ) : (
                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {previousOrders.map((o: any) => {
                          const name = extractProductName(o);
                          const when = extractAppointmentStart(o) || o?.createdAt || o?.created_at;
                          const total = extractTotalMinor(o);
                          const st = String(o?.status || "—");
                          const pay = String(o?.payment_status || "—");

                          return (
                            <div
                              key={idOf(o)}
                              className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold text-neutral-100">
                                    {name}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-neutral-400">
                                    {formatDateTime(String(when || ""))}
                                  </p>
                                  <p className="mt-1 text-[10px] text-neutral-500">
                                    Ref:{" "}
                                    <span className="text-neutral-200">
                                      {o?.reference || o?._id}
                                    </span>
                                  </p>
                                </div>

                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <div className="flex gap-1">
                                    <span
                                      className={[
                                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                        statusBadgeClasses(st),
                                      ].join(" ")}
                                    >
                                      {st}
                                    </span>
                                    <span
                                      className={[
                                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                        paymentBadgeClasses(pay),
                                      ].join(" ")}
                                    >
                                      {pay}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-neutral-300">
                                    Total:{" "}
                                    <span className="font-semibold text-neutral-100">
                                      {formatMoney(total)}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <p className="mb-2 text-xs font-semibold text-neutral-200">Notes</p>

                    <div className="grid gap-4 md:grid-cols-1">
                      {/* Admin notes */}
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                        <p className="text-[11px] font-semibold text-neutral-200">Admin notes</p>

                        <div className="mt-2 space-y-2">
                          {adminNotes.length === 0 ? (
                            <p className="text-[11px] text-neutral-500">No admin notes yet.</p>
                          ) : (
                            adminNotes.map((n, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-2 py-1"
                              >
                                <p className="text-[11px] text-neutral-100">{n}</p>
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
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRejectDialog(false)} />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">Reject order</p>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Add one or more rejection notes. These will be saved with the order.
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
                  <p className="text-[11px] text-neutral-500">No rejection notes added yet.</p>
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
