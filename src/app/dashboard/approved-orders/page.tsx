/* eslint-disable @next/next/no-img-element */
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
  Mail,
  Phone,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { useRouter } from "next/navigation";

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

/** Normalises relative /upload/... URLs to full backend URLs. */
function resolveImageUrl(imagePath?: string | null): string {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;

  const baseWithApi = getBackendBase();
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");

  return `${cleanBase}${normalizedPath}`;
}

/* ----------------- API unwrap helpers (handles {data:...}) ----------------- */

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
  const orders =
    (res?.data ??
      res?.orders ??
      res?.items ??
      (Array.isArray(res) ? res : [])) as OrderDto[];
  const meta = (res?.meta ?? res?.pagination ?? null) as OrdersListMeta | null;
  return { orders: Array.isArray(orders) ? orders : [], meta };
}

function idOf(o: any): string {
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

/* ----------------- RAF extraction + render (supports files) ----------------- */

function getRafQAs(
  order: any
): Array<{ question: string; answer: string; raw?: any }> {
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
      <p className="mt-0.5 whitespace-pre-wrap text-neutral-100">{answer}</p>
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

/* ----------------- Patient Profile Card ----------------- */

function PatientProfileCard({
  user,
  priority,
  onPriorityChange,
  prioritySaving,
  priorityError,
}: {
  user: UserDto | null;
  priority?: string;
  onPriorityChange?: (p: string) => void;
  prioritySaving?: boolean;
  priorityError?: string | null;
}) {
  if (!user) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-4">
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

  const currentPriority = (priority ?? u.user_priority ?? "yellow") as string;

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800">
            <span className="text-sm font-semibold text-neutral-100">
              {getUserInitials(user)}
            </span>
          </div>
          <div>
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
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-neutral-300">
        {u.email && (
          <div className="inline-flex items-center gap-1">
            <Mail className="h-3 w-3 text-neutral-500" />
            <span className="break-all">{u.email}</span>
          </div>
        )}
        {(u.phone || u.phoneNumber) && (
          <div className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3 text-neutral-500" />
            <span>{u.phone || u.phoneNumber}</span>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
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
          <dd className="text-neutral-100">{u.postalcode || u.postcode || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Country</dt>
          <dd className="text-neutral-100">{u.country || "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-4 border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
        <span>
          Created: <span className="text-neutral-200">{formatDateOnly(createdAt)}</span>
        </span>
        <span>
          Updated: <span className="text-neutral-200">{formatDateOnly(updatedAt)}</span>
        </span>
      </div>

      {onPriorityChange && (
        <div className="space-y-2 border-t border-neutral-800 pt-3">
          <p className="text-[11px] text-neutral-400">Priority status</p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityBadgeClasses(
                currentPriority
              )}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {currentPriority}
            </span>

            <select
              className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-100 focus:border-emerald-500 focus:outline-none"
              disabled={prioritySaving}
              value={currentPriority}
              onChange={(e) => onPriorityChange(e.target.value)}
            >
              <option value="red">Red – High risk</option>
              <option value="yellow">Yellow – Medium</option>
              <option value="green">Green – Low</option>
            </select>

            {prioritySaving && (
              <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
            )}
          </div>

          {priorityError && <p className="text-[11px] text-rose-300">{priorityError}</p>}
        </div>
      )}
    </div>
  );
}

/* ----------------- Page (LIST VIEW) ----------------- */

export default function Page() {
  const router = useRouter();

  // Change these for your "other page"
  const STATUS = "approved"; // e.g. "pending" | "completed" | "rejected"
  const TITLE = "Approved Orders";
  const STATUS_LABEL = "Approved";

  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<OrdersListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderUsers, setOrderUsers] = useState<Record<string, UserDto | null>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // detail modal state
  const [showDetail, setShowDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // notes
  const [adminNotes, setAdminNotes] = useState<string[]>([]);
  const [newNote, setNewNote] = useState("");

  const [consultationNotesEdit, setConsultationNotesEdit] = useState<string[]>([]);
  const [newConsultNote, setNewConsultNote] = useState("");

  const [savingNotes, setSavingNotes] = useState(false);

  // selected order user
  const [orderedByUser, setOrderedByUser] = useState<UserDto | null>(null);

  // priority editing
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);

  const rejectionNotes = useMemo(() => {
    if (!selectedOrder) return [] as string[];
    const o: any = selectedOrder;
    const m: any = o.meta || {};

    const rawRoot =
      o.rejection_notes ??
      o.rejected_notes ??
      o.rejection_reason ??
      o.rejected_reason;
    const rawMeta =
      m.rejection_notes ??
      m.rejected_notes ??
      m.rejection_reason ??
      m.rejected_reason;

    const raw = rawRoot ?? rawMeta ?? [];
    const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    return arr.map((n) => String(n).trim()).filter((n) => n.length > 0);
  }, [selectedOrder]);

  function extractConsultationNotes(order: OrderDto): string[] {
    const o: any = order;
    const m: any = o.meta || {};

    const rawRoot =
      o.consultation_notes ?? o.consultant_notes ?? o.consultationNotes;
    const rawMeta =
      m.consultation_notes ??
      m.consultationNotes ??
      m.consultant_notes ??
      m.consultantNotes;

    const raw = rawRoot ?? rawMeta ?? [];
    const arr = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    return arr.map((n) => String(n).trim()).filter((n) => n.length > 0);
  }

  // Load list
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
          new Set(ordersList.map((o: any) => extractUserIdFromOrder(o)).filter(Boolean))
        ) as string[];

        const missing = uniqueUserIds.filter((id) => orderUsers[id] === undefined);

        if (missing.length) {
          const results = await Promise.all(
            missing.map(async (id) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const withComputed = orders.map((o: any) => {
      const userId = extractUserIdFromOrder(o);
      const u = userId ? orderUsers[userId] : null;

      const appointmentAt = extractAppointmentStart(o);
      const appointmentTs = appointmentAt ? new Date(appointmentAt).getTime() : 0;

      const patientName = getDisplayPatientName(o, u);
      const productName = extractProductName(o);

      return {
        order: o as OrderDto,
        user: u as UserDto | null,
        appointmentAt,
        appointmentTs,
        patientName,
        productName,
      };
    });

    const filtered =
      !q
        ? withComputed
        : withComputed.filter(({ order, user, patientName, productName }) => {
            const o: any = order;
            const u: any = user;
            const hay = [
              patientName,
              productName,
              o?.service_name,
              o?.service_slug,
              o?.reference,
              o?._id,
              o?.email,
              u?.email,
              u?.phone,
              u?.phoneNumber,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return hay.includes(q);
          });

    filtered.sort((a, b) =>
      sortDir === "desc" ? b.appointmentTs - a.appointmentTs : a.appointmentTs - b.appointmentTs
    );

    return filtered;
  }, [orders, orderUsers, searchTerm, sortDir]);

  async function handleViewDetails(id: string) {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedOrder(null);

    setAdminNotes([]);
    setConsultationNotesEdit([]);
    setNewNote("");
    setNewConsultNote("");

    setOrderedByUser(null);
    setPriorityError(null);
    setPrioritySaving(false);

    try {
      const oRes: any = await getOrderByIdApi(id);
      const order = unwrapOrder(oRes);

      setSelectedOrder(order);
      setAdminNotes(((order as any).admin_notes as string[]) || []);
      setConsultationNotesEdit(extractConsultationNotes(order));

      const userId = extractUserIdFromOrder(order);
      if (userId) {
        // use cache first
        if (orderUsers[userId] !== undefined) {
          setOrderedByUser(orderUsers[userId]);
        } else {
          try {
            const uRes = await getUserByIdApi(userId);
            setOrderedByUser(unwrapUser(uRes));
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

  async function handleSaveNotes() {
    if (!selectedOrder) return;

    setSavingNotes(true);
    setDetailError(null);

    try {
      const payload: any = {
        status: (selectedOrder as any).status, // keep status
        admin_notes: adminNotes,
        consultation_notes: consultationNotesEdit,
        consultant_notes: consultationNotesEdit,
      };

      const updatedRes: any = await updateOrderStatusApi((selectedOrder as any)._id, payload);
      const updated = unwrapOrder(updatedRes);

      setSelectedOrder(updated);
      setAdminNotes(((updated as any).admin_notes as string[]) || []);
      setConsultationNotesEdit(extractConsultationNotes(updated));

      // keep list in sync
      setOrders((prev) => prev.map((o: any) => (idOf(o) === idOf(updated) ? updated : o)));
    } catch (e: any) {
      setDetailError(e?.message || "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handlePriorityChange(newPriority: string) {
    if (!orderedByUser) return;

    const userId = (orderedByUser as any)._id;
    const prevPriority = (orderedByUser as any).user_priority || "yellow";

    setPrioritySaving(true);
    setPriorityError(null);

    try {
      // optimistic
      setOrderedByUser({
        ...(orderedByUser as any),
        user_priority: newPriority,
      } as any);

      const updatedUserRes: any = await updateUserApi(userId, {
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

  function handleStartConsultancy() {
    if (!selectedOrder) return;

    const serviceId = (selectedOrder as any).service_id as string | undefined;
    const orderId = (selectedOrder as any)._id;

    if (!serviceId || !orderId) {
      console.warn("Missing service_id or order_id for consultancy navigation");
      return;
    }

    if (typeof window !== "undefined") {
      try {
        const patientName = getDisplayPatientName(selectedOrder, orderedByUser);
        const patientEmail =
          (orderedByUser as any)?.email || (selectedOrder as any)?.email || null;
        const patientPhone =
          (orderedByUser as any)?.phone || (orderedByUser as any)?.phoneNumber || null;

        const payload = {
          orderId,
          serviceId,
          orderReference: (selectedOrder as any).reference,
          serviceSlug: (selectedOrder as any).service_slug,
          serviceName: (selectedOrder as any).service_name,
          appointmentAt: extractAppointmentStart(selectedOrder),
          patient: {
            id: orderedByUser?._id ?? null,
            name: patientName,
            email: patientEmail,
            phone: patientPhone,
            gender: (orderedByUser as any)?.gender ?? null,
            dob: (orderedByUser as any)?.dob ?? null,
            address: {
              line1:
                (orderedByUser as any)?.address_line1 ||
                (orderedByUser as any)?.addressLine1 ||
                null,
              line2:
                (orderedByUser as any)?.address_line2 ||
                (orderedByUser as any)?.addressLine2 ||
                null,
              city: (orderedByUser as any)?.city ?? null,
              county: (orderedByUser as any)?.county ?? null,
              postalcode: (orderedByUser as any)?.postalcode ?? null,
              country: (orderedByUser as any)?.country ?? null,
            },
            priority: (orderedByUser as any)?.user_priority ?? "yellow",
          },
        };

        window.localStorage.setItem("current_consult_patient", JSON.stringify(payload));
      } catch (err) {
        console.error("Failed to store consult patient data", err);
      }
    }

    const url = `/dashboard/consultations/start?service_id=${encodeURIComponent(
      serviceId
    )}&order_id=${encodeURIComponent(orderId)}`;

    setShowDetail(false);
    router.push(url);
  }

  const totalCount = (meta as any)?.total ?? filteredOrders.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">{TITLE}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            List view for faster scanning, searching, and opening details.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/70 px-3 py-1.5 text-xs text-neutral-300">
            <Filter size={14} />
            <span>Status:</span>
            <span className="font-medium text-emerald-400">{STATUS_LABEL}</span>
          </div>
          <span className="text-xs text-neutral-500">
            {totalCount} {STATUS_LABEL.toLowerCase()}{" "}
            {meta ? `• page ${(meta as any).page} of ${(meta as any).totalPages}` : ""}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by patient, reference, email, service…"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950 pl-9 pr-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setSortDir((p) => (p === "desc" ? "asc" : "desc"))}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-700 hover:bg-neutral-900"
          title="Toggle appointment sort"
        >
          <ArrowUpDown className="h-4 w-4 text-neutral-400" />
          Appointment {sortDir === "desc" ? "new → old" : "old → new"}
        </button>
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
      ) : filteredOrders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-center text-neutral-400">
          No orders found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900/70 text-xs text-neutral-400">
                <tr className="border-b border-neutral-800">
                  <th className="px-4 py-3 text-left font-semibold">Patient / Ref</th>
                  <th className="px-4 py-3 text-left font-semibold">Service / Item</th>
                  <th className="px-4 py-3 text-left font-semibold">Appointment</th>
                  <th className="px-4 py-3 text-left font-semibold">Total</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map(({ order, user, patientName, productName, appointmentAt }) => {
                  const o: any = order;
                  const totalMinor = extractTotalMinor(o);
                  const priority = ((user as any)?.user_priority as string | undefined) || undefined;

                  const status = String(o?.status || STATUS);
                  const payment = String(o?.payment_status || "pending");

                  return (
                    <tr
                      key={idOf(o)}
                      className="border-b border-neutral-900/70 hover:bg-neutral-900/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
                            <span className="text-xs font-semibold text-neutral-100">
                              {getUserInitials(user)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-semibold text-white">{patientName}</p>
                              {priority && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityBadgeClasses(
                                    priority
                                  )}`}
                                >
                                  <span className="h-2 w-2 rounded-full bg-current" />
                                  {priority}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-neutral-400">
                              Ref: <span className="font-mono">{o?.reference || o?._id}</span>
                              {(o?.email || (user as any)?.email) && (
                                <>
                                  {" "}
                                  • <span className="truncate">{o?.email || (user as any)?.email}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-100">
                          {o?.service_name || "—"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-400">
                          {productName}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-neutral-200">
                          <CalendarDays className="h-4 w-4 text-neutral-500" />
                          <span>{formatDateTime(appointmentAt)}</span>
                        </div>
                        {appointmentAt && o?.end_at ? (
                          <p className="mt-0.5 text-[11px] text-neutral-500">
                            End: {formatDateTime(o.end_at)}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{formatMoney(totalMinor)}</p>
                        <span
                          className={
                            "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                            paymentBadgeClasses(payment)
                          }
                        >
                          <CreditCard className="h-3 w-3" />
                          {payment.toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                            statusBadgeClasses(status)
                          }
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          {status.toUpperCase()}
                        </span>

                        <div className="mt-1">
                          {status === "approved" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Ready
                            </span>
                          ) : status === "pending" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                              <Clock className="h-3.5 w-3.5" />
                              Waiting
                            </span>
                          ) : status === "draft" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
                              <XCircle className="h-3.5 w-3.5" />
                              Draft
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(String(o?._id))}
                          className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-200 hover:border-emerald-500 hover:text-emerald-300"
                        >
                          View
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden">
            {filteredOrders.map(({ order, user, patientName, productName, appointmentAt }) => {
              const o: any = order;
              const totalMinor = extractTotalMinor(o);
              const priority = ((user as any)?.user_priority as string | undefined) || undefined;

              const status = String(o?.status || STATUS);
              const payment = String(o?.payment_status || "pending");

              return (
                <button
                  key={idOf(o)}
                  type="button"
                  onClick={() => handleViewDetails(String(o?._id))}
                  className="w-full border-b border-neutral-900/70 px-4 py-3 text-left hover:bg-neutral-900/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {patientName}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                        {productName} • Ref:{" "}
                        <span className="font-mono">{o?.reference || o?._id}</span>
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-300">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-neutral-500" />
                          {formatDateTime(appointmentAt)}
                        </span>
                        <span className="text-neutral-600">•</span>
                        <span className="font-semibold text-white">{formatMoney(totalMinor)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {priority && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityBadgeClasses(
                            priority
                          )}`}
                        >
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {priority}
                        </span>
                      )}

                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                          statusBadgeClasses(status)
                        }
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        {status.toUpperCase()}
                      </span>

                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                          paymentBadgeClasses(payment)
                        }
                      >
                        <CreditCard className="h-3 w-3" />
                        {payment.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 md:px-6">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">Order details</h2>
                </div>
                {selectedOrder && (
                  <p className="text-[11px] text-neutral-500">
                    Ref:{" "}
                    <span className="font-mono text-neutral-300">
                      {(selectedOrder as any).reference}
                    </span>
                  </p>
                )}
              </div>

              {selectedOrder && (
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                      statusBadgeClasses(String((selectedOrder as any).status || STATUS))
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {String((selectedOrder as any).status || STATUS).toUpperCase()}
                  </span>
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                      paymentBadgeClasses(String((selectedOrder as any).payment_status || "pending"))
                    }
                  >
                    <CreditCard className="h-3 w-3" />
                    {String((selectedOrder as any).payment_status || "pending").toUpperCase()}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="ml-4 rounded-full p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
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
                      <p className="font-mono text-sm text-white">
                        {(selectedOrder as any).reference}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        Service:{" "}
                        <span className="font-medium">
                          {(selectedOrder as any).service_name}
                        </span>{" "}
                        ({(selectedOrder as any).service_slug})
                      </p>
                    </div>
                  </div>

                  {/* Patient profile + appointment */}
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr,1.1fr]">
                    <PatientProfileCard
                      user={orderedByUser}
                      priority={
                        ((orderedByUser as any)?.user_priority as string | undefined) || "yellow"
                      }
                      onPriorityChange={handlePriorityChange}
                      prioritySaving={prioritySaving}
                      priorityError={priorityError}
                    />

                    <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-4">
                      <p className="mb-0.5 text-xs text-neutral-400">Appointment</p>
                      <p className="text-sm text-white">
                        {formatDateTime(extractAppointmentStart(selectedOrder))}
                      </p>
                      {(selectedOrder as any).end_at && extractAppointmentStart(selectedOrder) && (
                        <p className="text-xs text-neutral-400">
                          End: {formatDateTime((selectedOrder as any).end_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-neutral-300" />
                        <p className="text-xs font-semibold text-neutral-200">Items</p>
                      </div>
                      <p className="text-xs text-neutral-400">
                        Total:{" "}
                        <span className="font-semibold text-white">
                          {formatMoney(extractTotalMinor(selectedOrder))}
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
                              <span className="block text-[11px] text-neutral-400">
                                Qty: {it.qty}
                              </span>
                              <span className="block text-[11px] text-neutral-300">
                                {formatMoney(it.totalMinor)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">No items found on this order.</p>
                    )}
                  </div>

                  {/* RAF */}
                  {getRafQAs(selectedOrder).length ? (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
                      <p className="mb-2 text-xs font-semibold text-neutral-200">
                        RAF Questions &amp; Answers
                      </p>

                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {getRafQAs(selectedOrder).map((qa, idx) => (
                          <div
                            key={idx}
                            className="border-b border-neutral-800/60 pb-2 text-[11px] last:border-none"
                          >
                            <p className="font-medium text-neutral-400">{qa.question}</p>
                            <RafAnswer raw={qa.raw} answer={qa.answer} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Notes */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-neutral-200">Notes</p>

                      <button
                        type="button"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingNotes && <Loader2 className="h-3 w-3 animate-spin" />}
                        {savingNotes ? "Saving…" : "Save notes"}
                      </button>
                    </div>


                    {/* Admin notes */}
                    {adminNotes.length === 0 && (
                      <p className="mb-2 text-xs text-neutral-500">
                        No admin notes yet. Add your first note below.
                      </p>
                    )}

                    {adminNotes.length > 0 && (
                      <ul className="mb-3 space-y-2">
                        {adminNotes.map((note, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs">
                            <span className="mt-1 text-[10px] text-neutral-500">
                              #{idx + 1}
                            </span>
                            <div className="flex-1 rounded-md bg-neutral-800/70 px-2 py-1 text-neutral-100">
                              {note}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setAdminNotes((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-[11px] text-rose-400 hover:text-rose-300"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex gap-2">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add an admin note about this order…"
                        className="min-h-[60px] flex-1 resize-none rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const v = newNote.trim();
                          if (!v) return;
                          setAdminNotes((prev) => [...prev, v]);
                          setNewNote("");
                        }}
                        className="self-end rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Start consultancy */}
                  <div className="flex flex-col justify-between gap-3 pt-2 md:flex-row md:items-center">
                    <p className="text-xs text-neutral-500">
                      Ready to speak to the patient? Start a consultation session for this order.
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
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
