// app/dashboard/orders/page.tsx
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  getUserByIdApi,
  getBackendBase,
  sendEmailApi,
  type OrderDto,
  type OrdersListMeta,
  type UserDto,
  getCurrentUserApi,
  getDynamicHomePageApi,
} from "../../../../api";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  ArrowRight,
  X,
  ClipboardList,
  Mail,
  Phone,
  Download,
  Send,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ----------------- Helpers ----------------- */
type OrderedItemRow = {
  name: string;
  variation?: string;
  qty: number;
  unitPriceMinor?: number | null;
  totalMinor?: number | null;
};
function toMinorCurrency(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;

  // If your backend already stores minor units (common), it will be integer.
  // If it stores decimal currency, convert cautiously.
  if (Number.isInteger(n)) return n;
  return Math.round(n * 100);
}
function extractOrderedItems(order: any): OrderedItemRow[] {
  const candidates =
    order?.items ??
    order?.order_items ??
    order?.orderItems ??
    order?.lines ??
    order?.products ??
    order?.medicines ??
    order?.medicine_items ??
    order?.medicineItems ??
    order?.cart?.items ??
    [];

  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((it: any) => {
      const name =
        it?.medicine_name ||
        it?.medicineName ||
        it?.product_name ||
        it?.productName ||
        it?.name ||
        it?.title ||
        it?.medicine?.name ||
        it?.product?.name ||
        "";

      const variation =
        it?.variation_title ||
        it?.variationTitle ||
        it?.variation_name ||
        it?.variationName ||
        it?.variation?.title ||
        it?.variant ||
        it?.strength ||
        it?.dose ||
        "";

      const qtyRaw = it?.qty ?? it?.quantity ?? it?.count ?? it?.units ?? 1;
      const qty = Math.max(1, Number(qtyRaw) || 1);

      const unitMinor =
        toMinorCurrency(
          it?.unit_price_minor ??
            it?.unitPriceMinor ??
            it?.unit_price ??
            it?.unitPrice ??
            it?.price_minor ??
            it?.priceMinor ??
            it?.price
        ) ?? null;

      const totalMinor =
        unitMinor !== null ? Math.round(unitMinor * qty) : null;

      const cleanName = String(name).trim();
      if (!cleanName) return null;

      return {
        name: cleanName,
        variation: String(variation || "").trim() || undefined,
        qty,
        unitPriceMinor: unitMinor,
        totalMinor,
      } as OrderedItemRow;
    })
    .filter(Boolean) as OrderedItemRow[];
}
function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 4.5
) {
  const lines = doc.splitTextToSize(text || "—", maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function formatMoneyFromMinorSafe(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "—";

  // If you already have formatMoneyFromMinor, use that instead.
  // return formatMoneyFromMinor(minor);

  const pounds = (minor / 100).toFixed(2);
  return `£${pounds}`;
}

type PdfBranding = {
  logoDataUrl: string | null; // derived from logoAlt
  rawLogoUrl: string | null;
  rawLogoAlt: string | null;
};

let cachedPdfBranding: PdfBranding | null | undefined = undefined;

function sanitizeHeaderName(alt?: string | null) {
  const s = (alt || "").trim();
  if (!s) return "Pharmacy Express";
  // Optional cleanup: "Middlestown pharmacy Logo" -> "Middlestown pharmacy"
  return s.replace(/\s*logo\s*$/i, "").trim() || "Pharmacy Express";
}

async function getPdfBranding(): Promise<PdfBranding> {
  const DEFAULT_HEADER_NAME = "Pharmacy Express";

  const DEFAULT_PDF_LOGO_DATA_URL =
    "data:image/svg+xml;base64," +
    [
      "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdo",
      "dD0iNDAiIHZpZXdCb3g9IjAgMCAxNjAgNDAiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50",
      "IGlkPSJnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0i",
      "MCIgc3RvcC1jb2xvcj0iIzEwYjk4MSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29s",
      "b3I9IiMyMmM1NWUiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHg9",
      "IjIiIHk9IjIiIHdpZHRoPSIzNiIgaGVpZ2h0PSIzNiIgcng9IjEwIiBmaWxsPSJ1cmwoI2cpIi8+",
      "CiAgPHBhdGggZD0iTTIwIDEwYy00LjQgMC08IDMuNi04IDh2MTBoNnYtNmg0YzQuNCAwIDgtMy42",
      "IDgtOHMtMy42LTQtMTAtNHptMiA4aC00di0yYzAtMS4xLjktMiAyLTJoMmMxLjEgMCAyIC45IDIg",
      "MiAwIDEuMS0uOSAyLTIgMnoiIGZpbGw9IiMwYjEyMjAiIG9wYWNpdHk9Ii45Ii8+CiAgPHRleHQg",
      "eD0iNDgiIHk9IjI2IiBmb250LWZhbWlseT0iSW50ZXIsU2Vnb2UgVUksQXJpYWwiIGZvbnQtc2l6",
      "ZT0iMTYiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiMwYjEyMjAiPlBoYXJtYWN5PC90ZXh0Pgog",
      "IDx0ZXh0IHg9IjEyMCIgeT0iMjYiIGZvbnQtZmFtaWx5PSJJbnRlcixTZWdvZSBVSSxBcmlhbCIg",
      "Zm9udC1zaXplPSIxNiIgZm9udC13ZWVpZ2h0PSI3MDAiIGZpbGw9IiMwYjEyMjAiIG9wYWNpdHk9Ii",
      "43NSI+RXhwcmVzczwvdGV4dD4KPC9zdmc+",
    ].join("");

  const fallback: PdfBranding = {
    logoDataUrl: DEFAULT_PDF_LOGO_DATA_URL,
    rawLogoUrl: null,
    rawLogoAlt: null,
  };

  if (cachedPdfBranding !== undefined) return cachedPdfBranding ?? fallback;

  if (typeof window === "undefined" || typeof FileReader === "undefined") {
    cachedPdfBranding = fallback;
    return cachedPdfBranding;
  }

  try {
    const home = await getDynamicHomePageApi("home");

    const rawLogoUrl = home?.navbar?.logoUrl ?? null;
    const rawLogoAlt = home?.navbar?.logoAlt ?? null;

    const rawHeader =
      (home as any)?.navbar?.headerName ??
      (home as any)?.navbar?.brandName ??
      rawLogoAlt;

    const headerName = sanitizeHeaderName(rawHeader) || DEFAULT_HEADER_NAME;

    // No logo from CMS → keep fallback logo but still allow headerName
    if (!rawLogoUrl) {
      cachedPdfBranding = {
        logoDataUrl: DEFAULT_PDF_LOGO_DATA_URL,
        rawLogoUrl: null,
        rawLogoAlt,
      };
      return cachedPdfBranding;
    }

    // If backend already gives data URL
    if (typeof rawLogoUrl === "string" && rawLogoUrl.startsWith("data:")) {
      cachedPdfBranding = {
        logoDataUrl: rawLogoUrl,
        rawLogoUrl,
        rawLogoAlt,
      };
      return cachedPdfBranding;
    }

    // ✅ Use the SAME resolver pattern as your RAF <img> rendering
    const resolvedLogoUrl = resolveImageUrl(String(rawLogoUrl));

    // ✅ Use the SAME fetch->dataURL path as your PDF image handling
    const logoDataUrl =
      (await fetchImageAsDataUrl(resolvedLogoUrl)) || DEFAULT_PDF_LOGO_DATA_URL;

    cachedPdfBranding = {
      logoDataUrl,
      rawLogoUrl: resolvedLogoUrl,
      rawLogoAlt,
    };
    return cachedPdfBranding;
  } catch {
    cachedPdfBranding = null;
    return fallback;
  }
}

function pharmacistDisplayName(p?: UserDto | null) {
  if (!p) return "—";
  const full = `${(p as any).firstName || ""} ${
    (p as any).lastName || ""
  }`.trim();
  return (
    full || (p as any).name || (p as any).fullName || (p as any).email || "—"
  );
}

function pharmacistGphc(p?: UserDto | null) {
  if (!p) return "—";
  return String(
    (p as any).gphc_number ||
      (p as any).gphcNumber ||
      (p as any).registrationNumber ||
      (p as any).registration_number ||
      "—"
  );
}

function getBackendOrigin(): string {
  const base = getBackendBase();
  try {
    return new URL(base).origin;
  } catch {
    return base.replace(/\/api\/?$/, "");
  }
}

/**
 * Build an absolute URL for assets like "/api/assets/xxxx"
 * using backend origin (NOT window.location.origin).
 */
function resolveBackendAssetUrl(maybePath: string) {
  const s = String(maybePath || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;

  const origin = getBackendOrigin();
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${origin}${path}`;
}

// cache so repeated PDF generation doesn't refetch image each time
const _dataUrlCache = new Map<string, string>();

function isBackendUrl(url: string): boolean {
  try {
    const backendOrigin = getBackendOrigin();
    return new URL(url).origin === backendOrigin;
  } catch {
    return false;
  }
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  const clean = String(url || "").trim();
  if (!clean) return null;

  if (_dataUrlCache.has(clean)) return _dataUrlCache.get(clean)!;

  try {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("session_token")
        : null;

    const headers: HeadersInit | undefined =
      token && isBackendUrl(clean)
        ? { Authorization: `Bearer ${token}` }
        : undefined;

    const res = await fetch(clean, { method: "GET", headers });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "image/png";
    const blob = await res.blob();

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("file-reader-failed"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(blob);
    });

    const finalUrl = dataUrl.startsWith("data:")
      ? dataUrl
      : `data:${contentType};base64,${dataUrl}`;

    _dataUrlCache.set(clean, finalUrl);
    return finalUrl;
  } catch (e) {
    console.error("fetchImageAsDataUrl failed:", e);
    return null;
  }
}

async function getPharmacistSignatureDataUrl(pharmacist?: UserDto | null) {
  const path = (pharmacist as any)?.signature_image;
  if (!path) return null;
  const abs = resolveBackendAssetUrl(path);
  return await fetchImageAsDataUrl(abs);
}

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

  const anyOrder: any = order;
  const meta: any = anyOrder.meta || {};

  if (anyOrder.patient_name) return anyOrder.patient_name;
  if (meta.patient_name) return meta.patient_name;

  const patient =
    meta.patient ||
    meta.patientDetails ||
    meta.patient_details ||
    meta.personalDetails ||
    meta.personal_details ||
    meta.demographics;

  if (patient) {
    const p: any = patient;
    const fromPatientStruct =
      p.name ||
      `${p.first_name || p.firstName || ""} ${
        p.last_name || p.lastName || ""
      }`.trim();
    if (fromPatientStruct) return fromPatientStruct;
  }

  const fromOrder = `${anyOrder.first_name || ""} ${
    anyOrder.last_name || ""
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

/* ----------------- Shared pharmacy + media helpers ----------------- */

const PHARMACY_INFO = {
  name: "Pharmacy Express",
  addressLines: [
    "Unit 4, The Office Campus",
    "Paragon Business Park,",
    "Wakefield, West Yorkshire",
    "WF1 2UY",
  ],
  tel: "01924 971414",
  email: "info@pharmacy-express.co.uk",
  vatNo: "274797643",
};

type RafFileRef = {
  url: string;
  name?: string | null;
  mimeType?: string | null;
};

function formatFieldValue(value: any): string {
  if (value == null) return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  if (Array.isArray(value)) {
    const txt = value
      .map((v) =>
        typeof v === "string" || typeof v === "number" ? String(v) : ""
      )
      .filter(Boolean)
      .join(", ");
    return txt || "—";
  }
  return "—";
}

function resolveImageUrl(imagePath?: string | null): string {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;
  const baseWithApi = getBackendBase(); // often ends with /api
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");
  return `${cleanBase}${normalizedPath}`;
}

/* ----------------- Risk Assessment helpers (USE meta.riskAssessment) ----------------- */

type RiskAssessmentItem = {
  key?: string;
  question?: string;
  value?: any;
};

function getRiskAssessmentItems(order: OrderDto): RiskAssessmentItem[] {
  const meta: any = (order as any)?.meta || {};
  const ra = meta?.riskAssessment;
  if (Array.isArray(ra)) return ra as RiskAssessmentItem[];
  return [];
}

function uniqueJoin(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const s = String(p ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.join(", ");
}

function normaliseRiskValue(value: any): { text: string; files: RafFileRef[] } {
  const files: RafFileRef[] = [];
  const textParts: string[] = [];

  function collect(v: any) {
    if (v == null) return;

    if (Array.isArray(v)) {
      v.forEach(collect);
      return;
    }

    const t = typeof v;

    if (t === "string" || t === "number" || t === "boolean") {
      const s = String(v).trim();
      if (s && s !== "[object Object]") textParts.push(s);
      return;
    }

    if (t === "object") {
      const obj: any = v;
      const url: string | undefined = obj.url || obj.href || obj.path;
      const name: string | undefined =
        obj.name ||
        obj.filename ||
        (url ? String(url).split("/").pop() : undefined);
      const mimeType: string | undefined =
        obj.type || obj.mimetype || obj.mimeType;

      if (url) {
        files.push({ url, name, mimeType });
      }
    }
  }

  collect(value);

  let text = uniqueJoin(textParts).trim();

  if (!text && files.length) {
    const names = files
      .map((f) => f.name || f.url)
      .filter(Boolean)
      .map(String);
    text =
      files.length === 1
        ? `Attached file: ${uniqueJoin(names)}`
        : `Attached file(s): ${uniqueJoin(names)}`;
  }

  if (!text) text = "—";
  return { text, files };
}

function rafFileLooksLikeImage(file: RafFileRef): boolean {
  const mt = (file.mimeType || "").toLowerCase();
  if (mt && mt.startsWith("image/")) return true;
  const url = file.url || "";
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(url);
}

function guessImageFormat(dataUrlOrUrl: string): "PNG" | "JPEG" | "WEBP" {
  const s = dataUrlOrUrl || "";
  if (s.startsWith("data:image/png")) return "PNG";
  if (s.startsWith("data:image/jpeg") || s.startsWith("data:image/jpg"))
    return "JPEG";
  if (s.startsWith("data:image/webp")) return "WEBP";
  if (/\.(jpe?g)(\?|$)/i.test(s)) return "JPEG";
  if (/\.(webp)(\?|$)/i.test(s)) return "WEBP";
  return "PNG";
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    if (!url) return null;
    if (String(url).startsWith("data:image")) return String(url);

    // Prefer backend origin for relative asset paths
    const full = /^https?:\/\//i.test(url) ? url : resolveBackendAssetUrl(url);

    // Use token-aware fetch
    return await fetchImageAsDataUrl(full);
  } catch {
    return null;
  }
}

/* ----------------- PDF Helpers ----------------- */
// function drawDocWatermark(
//   doc: jsPDF,
//   text: string,
//   opts?: { opacity?: number; fontSize?: number }
// ) {
//   const pageW = getPageWidth(doc);
//   const pageH = getPageHeight(doc);

//   const opacity = opts?.opacity ?? 0.02; // ✅ very low opacity
//   const fontSize = opts?.fontSize ?? 60;

//   // If jsPDF GState exists, use real opacity
//   let usedGState = false;
//   try {
//     const GStateCtor = (doc as any).GState;
//     if (GStateCtor && (doc as any).setGState) {
//       const gs = new GStateCtor({ opacity });
//       (doc as any).setGState(gs);
//       usedGState = true;
//     }
//   } catch {
//     usedGState = false;
//   }

//   doc.setFont("helvetica", "bold");
//   doc.setFontSize(fontSize);

//   // If no opacity support, make the color extremely light
//   if (!usedGState) doc.setTextColor(245, 247, 250);
//   else doc.setTextColor(235, 238, 242);

//   (doc as any).text(text, pageW / 2, pageH / 2, {
//     align: "center",
//     angle: 35,
//   } as any);

//   // Reset best-effort
//   if (usedGState) {
//     try {
//       const GStateCtor = (doc as any).GState;
//       if (GStateCtor && (doc as any).setGState) {
//         const gs = new GStateCtor({ opacity: 1 });
//         (doc as any).setGState(gs);
//       }
//     } catch {
//       // ignore
//     }
//   }
// }
function getPrivateRxDateSource(order: OrderDto) {
  const meta: any = (order as any).meta || {};
  return (
    (order as any).completed_at ||
    (order as any).completedAt ||
    meta?.appointment_start_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString()
  );
}

function writePharmacistDeclarationBlock(
  doc: jsPDF,
  cursor: PdfCursor,
  pharmacistName: string | null | undefined,
  pharmacistGphc: string | null | undefined,
  declarationDate: string,
  signatureDataUrl: string | null | undefined
) {
  const pageW = getPageWidth(doc);
  const boxX = MARGIN_X;
  const boxW = pageW - 2 * MARGIN_X;

  const pad = 6;
  const radius = 2.5;

  // Estimate height (safe), add page if needed
  const estimatedH = 65;
  ensureSpace(doc, cursor, estimatedH);

  // Outer rounded box
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, cursor.y, boxW, estimatedH, radius, radius, "FD");

  // Top green rule
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.line(boxX + 0.8, cursor.y + 3, boxX + boxW - 0.8, cursor.y + 3);

  let y = cursor.y + pad + 2;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(22, 163, 74);
  doc.text("Pharmacist Declaration", boxX + pad, y);
  y += 7;

  // Declaration text (exact)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.4);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

  const declaration =
    "I confirm that the above named patient has been clinically assessed and supplied medication in accordance with the service protocol. The supply is appropriate, counselling has been provided, and relevant records have been completed.";

  const lines = doc.splitTextToSize(declaration, boxW - pad * 2);
  lines.forEach((l: string) => {
    doc.text(l, boxX + pad, y);
    y += 4.1;
  });
  y += 2;

  // Rows
  const labelX = boxX + pad;
  const valueX = boxX + pad + 34;

  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.2);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text(label, labelX, y);

    doc.setFont("helvetica", "normal");
    doc.text(value || "—", valueX, y);
    y += 5.1;
  };

  row("Pharmacist Name:", pharmacistName || "—");
  row("GPhC Number:", pharmacistGphc || "—");
  row("Date:", declarationDate || "—");

  // Signature row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
  doc.text("Signature:", labelX, y);

  // line + signature image
  const sigLineX1 = valueX;
  const sigLineX2 = boxX + boxW - pad;
  const sigY = y + 1.2;

  doc.setDrawColor(203, 213, 225);

  if (signatureDataUrl) {
    try {
      const imgW = 55;
      const imgH = 16;
      doc.addImage(
        signatureDataUrl,
        guessImageFormat(signatureDataUrl),
        sigLineX1,
        sigY,
        imgW,
        imgH
      );
    } catch {
      // ignore
    }
  }

  // Advance cursor to below the box
  cursor.y += estimatedH + 10;
}

type PdfCursor = { y: number };
type PdfExportMode = "download" | "file";

const MARGIN_X = 18;
const TOP_CONTENT_Y = 48;

const PDF_BRAND_GREEN = { r: 34, g: 197, b: 94 };
const PDF_TEXT_DARK = { r: 31, g: 41, b: 55 };
const PDF_TEXT_MUTED = { r: 100, g: 116, b: 139 };
const PDF_BORDER = { r: 209, g: 213, b: 219 };
const PDF_CARD_BG = { r: 248, g: 250, b: 252 };

const PDF_LOGO_SRC =
  process.env.NEXT_PUBLIC_PDF_LOGO_URL || "/images/pharmacy-express-logo.png";

let cachedPdfLogoDataUrl: string | null | undefined;

async function getPdfLogoDataUrl(): Promise<string | null> {
  const b = await getPdfBranding();
  return b.logoDataUrl;
}
let _pdfHeaderNamePromise: Promise<string | null> | null = null;

function pickFirstNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string") {
      const s = v.trim();
      if (s) return s;
    }
  }
  return null;
}

/**
 * Returns a stable "brand/header name" for PDFs.
 * - Memoized: prevents duplicate network calls.
 * - Safe: never throws.
 */
async function getPdfHeaderName(opts?: {
  fallback?: string; // e.g. "Pharmacy Express"
  useHostnameFallback?: boolean;
}): Promise<string | null> {
  const fallback = pickFirstNonEmptyString(opts?.fallback) ?? null;
  const useHostnameFallback = opts?.useHostnameFallback ?? true;

  if (_pdfHeaderNamePromise) return _pdfHeaderNamePromise;

  _pdfHeaderNamePromise = (async () => {
    try {
      const home = await getDynamicHomePageApi("home");

      const name = pickFirstNonEmptyString(
        home?.navbar?.logoAlt,
        home?.header?.title,
        home?.meta?.title,
        home?.siteName
      );

      if (name) return name;

      if (useHostnameFallback && typeof window !== "undefined") {
        const host = window.location?.hostname || "";
        const pretty = host
          .replace(/^www\./, "")
          .split(".")
          .filter(Boolean)[0]
          ?.replace(/[-_]+/g, " ")
          ?.trim();

        if (pretty)
          return pretty
            .split(" ")
            .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
            .join(" ");
      }

      return fallback;
    } catch {
      if (useHostnameFallback && typeof window !== "undefined") {
        const host = window.location?.hostname || "";
        const short = host
          .replace(/^www\./, "")
          .split(".")[0]
          ?.trim();
        if (short) return short;
      }
      return fallback;
    }
  })();

  return _pdfHeaderNamePromise;
}

function getPageWidth(doc: jsPDF) {
  return (
    (doc.internal as any).pageSize?.getWidth?.() ??
    (doc.internal as any).pageSize?.width ??
    210
  );
}
function getPageHeight(doc: jsPDF) {
  return (
    (doc.internal as any).pageSize?.getHeight?.() ??
    (doc.internal as any).pageSize?.height ??
    297
  );
}

type PdfHeaderState = {
  title: string;
  subtitle?: string;
  logoDataUrl?: string | null;
  brandName?: string;
};

function drawPdfHeader(doc: jsPDF, header: PdfHeaderState) {
  const pageWidth = getPageWidth(doc);
  const headerY = 18;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, getPageHeight(doc), "F");

  // ✅ ADD THIS (watermark behind content)
  const wm = (doc as any).__pe_watermark as string | undefined;
  if (wm) {
    try {
      const op = (doc as any).__pe_watermark_opacity as number | undefined;
      drawDocWatermark(doc, wm, { opacity: op ?? 0.02, fontSize: 60 });
    } catch {
      // ignore
    }
  }
  // ✅ END ADD

  if (header.logoDataUrl) {
    try {
      doc.addImage(
        header.logoDataUrl,
        guessImageFormat(header.logoDataUrl),
        MARGIN_X,
        headerY - 6,
        46,
        12
      );
    } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

  // ✅ use dynamic brandName (fallback to PHARMACY_INFO.name)

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(String(header.title || "").toUpperCase(), MARGIN_X, headerY + 10);

  if (header.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
    doc.text(header.subtitle, MARGIN_X, headerY + 14);
  }

  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, headerY + 18, pageWidth - MARGIN_X, headerY + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
}

function addPageWithHeader(doc: jsPDF, cursor: PdfCursor) {
  doc.addPage();
  const hdr = (doc as any).__pe_header as PdfHeaderState | undefined;
  if (hdr) drawPdfHeader(doc, hdr);
  cursor.y = TOP_CONTENT_Y;
}

function ensureSpace(doc: jsPDF, cursor: PdfCursor, extra = 6) {
  const pageHeight = getPageHeight(doc);
  const bottomMargin = 18;

  if (cursor.y + extra > pageHeight - bottomMargin) {
    addPageWithHeader(doc, cursor);
  }
}

function createPdfBaseDoc(
  title: string,
  subtitle?: string,
  logoDataUrl?: string | null,
  watermarkText?: string,
  watermarkOpacity?: number,
  brandName?: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  (doc as any).__pe_header = {
    title,
    subtitle,
    logoDataUrl,
    brandName, // ✅ store
  } as PdfHeaderState;

  if (watermarkText) {
    (doc as any).__pe_watermark = watermarkText;
    (doc as any).__pe_watermark_opacity = watermarkOpacity ?? 0.02;
  }

  drawPdfHeader(doc, { title, subtitle, logoDataUrl, brandName }); // ✅ pass
  return doc;
}

function writeSectionTitle(doc: jsPDF, cursor: PdfCursor, title: string) {
  ensureSpace(doc, cursor, 10);
  const pageWidth = getPageWidth(doc);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(title, MARGIN_X, cursor.y);

  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, cursor.y + 1.5, pageWidth - MARGIN_X, cursor.y + 1.5);

  cursor.y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
}

/* ----------------- Record table helpers ----------------- */

function buildRemainingRecordRows(recordFields: Record<string, any>) {
  const shouldSkipKey = (k: string) => {
    const key = String(k || "")
      .trim()
      .toLowerCase();
    if (key === "date provided") return true;
    if (/^(item|medicine)\s*[a-z]$/.test(key)) return true;
    if (/^item\s*variation\s*[a-z]$/.test(key)) return true;
    if (/^(quantity|qty)\s*[a-z]$/.test(key)) return true;
    if (/^(strength|dose)\s*[a-z]$/.test(key)) return true;
    return false;
  };

  return Object.entries(recordFields || {})
    .filter(([k]) => !shouldSkipKey(k))
    .map(([k, v]) => ({ label: String(k || "—"), value: formatFieldValue(v) }))
    .filter((r) => r.value !== "—");
}

function drawKeyValueTable(
  doc: jsPDF,
  cursor: PdfCursor,
  title: string,
  rows: { label: string; value: string }[]
) {
  const pageWidth = getPageWidth(doc);
  const x = MARGIN_X;
  const w = pageWidth - 2 * MARGIN_X;

  const colLabelW = w * 0.38;
  const colValueW = w - colLabelW;

  const headerH = 8;
  const lineH = 4.2;
  const padY = 2.5;
  const padX = 2.2;

  const drawHeader = () => {
    ensureSpace(doc, cursor, headerH);

    doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
    doc.setFillColor(PDF_CARD_BG.r, PDF_CARD_BG.g, PDF_CARD_BG.b);
    doc.rect(x, cursor.y, w, headerH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

    const ty = cursor.y + 5.4;
    doc.text(title, x + padX, ty);

    doc.setLineWidth(0.3);
    doc.line(x + colLabelW, cursor.y, x + colLabelW, cursor.y + headerH);

    cursor.y += headerH;
  };

  if (!rows.length) return;

  drawHeader();

  rows.forEach((r, idx) => {
    const label = String(r.label || "—");
    const value = String(r.value || "—");

    const labelLines = doc.splitTextToSize(label, colLabelW - padX * 2);
    const valueLines = doc.splitTextToSize(value, colValueW - padX * 2);

    const maxLines = Math.max(labelLines.length, valueLines.length);
    const rowH = padY + maxLines * lineH + padY;

    const pageHeight = getPageHeight(doc);
    if (cursor.y + rowH > pageHeight - 18) {
      addPageWithHeader(doc, cursor);
      drawHeader();
    }

    doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
    if (idx % 2 === 0) doc.setFillColor(255, 255, 255);
    else doc.setFillColor(248, 250, 252);

    doc.rect(x, cursor.y, w, rowH, "FD");

    doc.setLineWidth(0.3);
    doc.line(x + colLabelW, cursor.y, x + colLabelW, cursor.y + rowH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

    const textTop = cursor.y + padY + 3.2;

    labelLines.forEach((ln: string, i: number) => {
      doc.text(ln, x + padX, textTop + i * lineH);
    });

    valueLines.forEach((ln: string, i: number) => {
      doc.text(ln, x + colLabelW + padX, textTop + i * lineH);
    });

    cursor.y += rowH;
  });

  cursor.y += 6;
}

/* ----------------- Ordered items normalisation (for PDFs) ----------------- */

type PdfOrderedItem = {
  name: string;
  variation?: string;
  qty: string;
};

function coerceQty(v: any): string {
  if (v == null) return "1";
  if (typeof v === "number") return String(v);
  const s = String(v).trim();
  return s || "1";
}

function getOrderedItemsForPdf(order: OrderDto): PdfOrderedItem[] {
  const anyOrder: any = order as any;
  const meta: any = anyOrder?.meta || {};

  const candidates: any[] = [
    ...(Array.isArray(meta.items) ? meta.items : []),
    ...(Array.isArray(meta.lines) ? meta.lines : []),
    ...(Array.isArray(meta.orderItems) ? meta.orderItems : []),
    ...(Array.isArray(anyOrder.items) ? anyOrder.items : []),
    ...(Array.isArray(anyOrder.lines) ? anyOrder.lines : []),
  ];

  const out: PdfOrderedItem[] = [];

  for (const it of candidates) {
    if (!it) continue;

    const name =
      it.name ||
      it.title ||
      it.product_name ||
      it.productName ||
      it.medicine_name ||
      it.medicineName ||
      it.label ||
      it.item ||
      "";

    const variation =
      it.variation ||
      it.variations ||
      it.strength ||
      it.dose ||
      it.option ||
      it.variant ||
      it.packSize ||
      it.pack_size ||
      "";

    const qty = coerceQty(
      it.qty ?? it.quantity ?? it.count ?? it.units ?? it.unitQty ?? 1
    );

    const cleanName = String(name || "").trim();
    const cleanVar = String(variation || "").trim();
    if (!cleanName && !cleanVar) continue;

    out.push({
      name: cleanName || "Item",
      variation: cleanVar || undefined,
      qty,
    });
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.name}__${x.variation || ""}__${x.qty}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ----------------- Advice extraction (REMOVES "Checkbox xxxx") ----------------- */

type AdvicePoint = string;
const ADVICE_LIST_STYLE: "bullets" | "numbered" = "bullets"; // or "numbered"

function extractAdvicePoints(order: OrderDto): AdvicePoint[] {
  const meta: any = (order as any).meta || {};
  const advice = meta.pharmacistAdvice;
  const adviceState: Record<string, any[]> = advice?.adviceState || {};

  const points: string[] = [];

  const isCheckboxLine = (line: string) => /^checkbox\b/i.test(line.trim());

  const stripPrefix = (line: string) =>
    line
      .replace(/^[•\u2022-]\s*/g, "")
      .replace(/^\(?\d+[\).\]]\s*/g, "")
      .trim();

  for (const arr of Object.values(adviceState || {})) {
    for (const raw of arr || []) {
      const s = String(raw ?? "")
        .replace(/\r/g, "")
        .trim();
      if (!s) continue;

      const lines = s
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => !isCheckboxLine(x))
        .map(stripPrefix)
        .filter(Boolean);

      points.push(...lines);
    }
  }

  const seen = new Set<string>();
  return points.filter((p) => {
    const k = p.trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function writeAdviceSection(doc: jsPDF, cursor: PdfCursor, order: OrderDto) {
  const points = extractAdvicePoints(order);

  writeSectionTitle(doc, cursor, "Pharmacist Advice");

  if (!points.length) {
    ensureSpace(doc, cursor, 6);
    doc.text(
      "No Pharmacist Advice has been recorded for this order.",
      MARGIN_X,
      cursor.y
    );
    cursor.y += 6;
    return;
  }

  const pageWidth = getPageWidth(doc);
  const maxW = pageWidth - 2 * MARGIN_X;
  const lineH = 4.3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  const intro = doc.splitTextToSize(
    "The following advice points were selected during the consultation:",
    maxW
  );
  intro.forEach((l: string) => {
    ensureSpace(doc, cursor, lineH);
    doc.text(l, MARGIN_X, cursor.y);
    cursor.y += lineH;
  });
  cursor.y += 3;

  const drawPoint = (label: string, text: string) => {
    const labelW = doc.getTextWidth(label);
    const labelX = MARGIN_X;
    const textX = MARGIN_X + labelW + 2;
    const wrapW = maxW - (textX - MARGIN_X);

    const lines = doc.splitTextToSize(text, wrapW);

    ensureSpace(doc, cursor, lineH);
    doc.text(label, labelX, cursor.y);
    doc.text(lines[0] || "", textX, cursor.y);
    cursor.y += lineH;

    for (let i = 1; i < lines.length; i++) {
      ensureSpace(doc, cursor, lineH);
      doc.text(lines[i], textX, cursor.y);
      cursor.y += lineH;
    }

    cursor.y += 1.2;
  };

  points.forEach((p, idx) => {
    const label = ADVICE_LIST_STYLE === "numbered" ? `${idx + 1}.` : "•";
    drawPoint(label, p);
  });

  cursor.y += 2;
}

/* ----------------- Record of supply item extraction (A..Z) ----------------- */

function extractItemsFromRecordFieldsForPdf(
  recordFields: Record<string, any>
): PdfOrderedItem[] {
  if (!recordFields || typeof recordFields !== "object") return [];

  const keyMap = new Map<string, string>();
  for (const k of Object.keys(recordFields)) {
    keyMap.set(String(k).toLowerCase().trim(), k);
  }

  const pick = (...cands: string[]) => {
    for (const c of cands) {
      const realKey = keyMap.get(c.toLowerCase().trim());
      if (!realKey) continue;
      const v = recordFields[realKey];
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return "";
  };

  const items: PdfOrderedItem[] = [];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  for (const L of letters) {
    const name = pick(
      `Item ${L}`,
      `Item ${L.toLowerCase()}`,
      `Item name ${L}`,
      `Item name ${L.toLowerCase()}`,
      `Medicine ${L}`,
      `Medicine ${L.toLowerCase()}`
    );

    const variation = pick(
      `Item variation ${L}`,
      `Item Variation ${L}`,
      `Item variation ${L.toLowerCase()}`,
      `Strength ${L}`,
      `Strength ${L.toLowerCase()}`,
      `Dose ${L}`,
      `Dose ${L.toLowerCase()}`
    );

    const qty = pick(
      `Quantity ${L}`,
      `Quantity ${L.toLowerCase()}`,
      `Qty ${L}`,
      `Qty ${L.toLowerCase()}`
    );

    if (!name && !variation && !qty) continue;

    items.push({
      name: name || "Item",
      variation: variation || undefined,
      qty: coerceQty(qty || "1"),
    });
  }

  return items;
}

/* ----------------- PDF: Items supplied table ----------------- */

function drawItemsSuppliedTable(
  doc: jsPDF,
  cursor: PdfCursor,
  items: PdfOrderedItem[]
) {
  const pageWidth = getPageWidth(doc);
  const x = MARGIN_X;
  const w = pageWidth - 2 * MARGIN_X;

  const colItemW = w * 0.52;
  const colVarW = w * 0.33;
  const colQtyW = w - colItemW - colVarW;

  const headerH = 8;
  const lineH = 4.2;
  const padY = 2.5;
  const padX = 2.2;

  const drawHeader = () => {
    ensureSpace(doc, cursor, headerH);

    doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
    doc.setFillColor(PDF_CARD_BG.r, PDF_CARD_BG.g, PDF_CARD_BG.b);
    doc.rect(x, cursor.y, w, headerH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

    const ty = cursor.y + 5.4;
    doc.text("Item", x + padX, ty);
    doc.text("Variation / Strength", x + colItemW + padX, ty);
    doc.text("Qty", x + colItemW + colVarW + padX, ty);

    doc.setLineWidth(0.3);
    doc.line(x + colItemW, cursor.y, x + colItemW, cursor.y + headerH);
    doc.line(
      x + colItemW + colVarW,
      cursor.y,
      x + colItemW + colVarW,
      cursor.y + headerH
    );

    cursor.y += headerH;
  };

  if (!items.length) {
    ensureSpace(doc, cursor, 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No items were recorded for this supply.", x, cursor.y);
    cursor.y += 6;
    return;
  }

  drawHeader();

  items.forEach((it, idx) => {
    const itemText = `${String.fromCharCode(65 + (idx % 26))}. ${
      it.name || "—"
    }`;
    const varText = it.variation || "—";
    const qtyText = it.qty || "—";

    const itemLines = doc.splitTextToSize(itemText, colItemW - padX * 2);
    const varLines = doc.splitTextToSize(varText, colVarW - padX * 2);
    const qtyLines = doc.splitTextToSize(qtyText, colQtyW - padX * 2);

    const maxLines = Math.max(
      itemLines.length,
      varLines.length,
      qtyLines.length
    );
    const rowH = padY + maxLines * lineH + padY;

    const pageHeight = getPageHeight(doc);
    if (cursor.y + rowH > pageHeight - 18) {
      addPageWithHeader(doc, cursor);
      drawHeader();
    }

    doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
    if (idx % 2 === 0) doc.setFillColor(255, 255, 255);
    else doc.setFillColor(248, 250, 252);
    doc.rect(x, cursor.y, w, rowH, "FD");

    doc.setLineWidth(0.3);
    doc.line(x + colItemW, cursor.y, x + colItemW, cursor.y + rowH);
    doc.line(
      x + colItemW + colVarW,
      cursor.y,
      x + colItemW + colVarW,
      cursor.y + rowH
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

    const textTop = cursor.y + padY + 3.2;

    itemLines.forEach((ln: string, i: number) => {
      doc.text(ln, x + padX, textTop + i * lineH);
    });

    varLines.forEach((ln: string, i: number) => {
      doc.text(ln, x + colItemW + padX, textTop + i * lineH);
    });

    qtyLines.forEach((ln: string, i: number) => {
      doc.text(ln, x + colItemW + colVarW + padX, textTop + i * lineH);
    });

    cursor.y += rowH;
  });

  cursor.y += 6;
}

/* ----------------- Patient + Order blocks for PDFs ----------------- */

function writeLabelValueRow(
  doc: jsPDF,
  cursor: PdfCursor,
  label: string,
  value: string,
  x: number,
  maxWidth = 80
) {
  ensureSpace(doc, cursor, 7);
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
  doc.text(label.toUpperCase(), x, cursor.y);
  cursor.y += 3.5;

  doc.setFontSize(10);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

  const lines = doc.splitTextToSize(value || "—", maxWidth);
  lines.forEach((line: string) => {
    ensureSpace(doc, cursor);
    doc.text(line, x, cursor.y);
    cursor.y += 4.2;
  });
}
function writePatientOrderBlock(
  doc: jsPDF,
  cursor: PdfCursor,
  order: OrderDto,
  user: UserDto | null
) {
  const pageWidth = getPageWidth(doc);
  const colGap = 8;
  const colWidth = (pageWidth - 2 * MARGIN_X - colGap) / 2;

  const leftX = MARGIN_X;
  const rightX = MARGIN_X + colWidth + colGap;

  ensureSpace(doc, cursor, 40);
  const leftCursor: PdfCursor = { y: cursor.y };
  const rightCursor: PdfCursor = { y: cursor.y };

  const patientName = getDisplayPatientName(order, user || undefined);
  const u: any = user || {};
  const dob = formatDobWithAge(u.dob);
  const gender =
    u.gender && typeof u.gender === "string"
      ? u.gender.charAt(0).toUpperCase() + u.gender.slice(1)
      : null;

  const addr1 =
    u.address_line1 || u.addressLine1 || u.address_line_1 || u.address1;
  const city = u.city;
  const county = u.county;
  const postcode = u.postalcode || u.postcode;
  const country = u.country;
  const addrParts = [addr1, city, county, postcode, country].filter(Boolean);

  doc.setFontSize(9);
  doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
  doc.setFont("helvetica", "bold");
  doc.text("PATIENT DETAILS", leftX, leftCursor.y);
  leftCursor.y += 5;

  doc.setFont("helvetica", "normal");
  writeLabelValueRow(doc, leftCursor, "Name", patientName, leftX);
  if (dob) writeLabelValueRow(doc, leftCursor, "Date of birth", dob, leftX);
  if (gender) writeLabelValueRow(doc, leftCursor, "Gender", gender, leftX);
  if (addrParts.length)
    writeLabelValueRow(doc, leftCursor, "Address", addrParts.join(", "), leftX);

  doc.setFontSize(9);
  doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
  doc.setFont("helvetica", "bold");
  doc.text("ORDER DETAILS", rightX, rightCursor.y);
  rightCursor.y += 5;

  doc.setFont("helvetica", "normal");
  writeLabelValueRow(
    doc,
    rightCursor,
    "Reference",
    (order as any).reference || (order as any)._id,
    rightX
  );
  writeLabelValueRow(
    doc,
    rightCursor,
    "Service",
    `${(order as any).service_name || "Service"} (${
      (order as any).service_slug || "N/A"
    })`,
    rightX
  );

  const appointmentAt =
    (order as any)?.meta?.appointment_start_at ||
    (order as any)?.start_at ||
    null;
  if (appointmentAt)
    writeLabelValueRow(
      doc,
      rightCursor,
      "Appointment",
      formatDateTime(appointmentAt),
      rightX
    );

  if ((order as any)?.status || (order as any)?.payment_status) {
    writeLabelValueRow(
      doc,
      rightCursor,
      "Status",
      `${String((order as any).status || "").toUpperCase()} / ${String(
        (order as any).payment_status || "N/A"
      ).toUpperCase()}`,
      rightX
    );
  }

  const blockBottom = Math.max(leftCursor.y, rightCursor.y);
  cursor.y = blockBottom + 6;
}
/* ===========================
   Private Rx: Subtle top info cards (Pharmacy + Patient)
   =========================== */

type PdfInfoRow = { label: string; value: string };

function measureInfoCardHeight(
  doc: jsPDF,
  cardWidth: number,
  rows: PdfInfoRow[]
) {
  const padX = 4;
  const padY = 4;
  const titleBlockH = 9; // title + underline spacing
  const labelW = 22;
  const lineH = 4.2;
  const rowGap = 1.6;

  const valueW = Math.max(10, cardWidth - padX * 2 - labelW);

  let rowsH = 0;
  for (const r of rows) {
    const v = String(r.value || "—");
    const lines = doc.splitTextToSize(v, valueW);
    rowsH += Math.max(1, lines.length) * lineH + rowGap;
  }

  return padY + titleBlockH + rowsH + padY;
}

function drawInfoCard(
  doc: jsPDF,
  x: number,
  y: number,
  cardWidth: number,
  title: string,
  rows: PdfInfoRow[]
) {
  const padX = 4;
  const padY = 4;
  const titleBlockH = 9;
  const labelW = 22;
  const lineH = 4.2;
  const rowGap = 1.6;

  const valueW = Math.max(10, cardWidth - padX * 2 - labelW);
  const cardH = measureInfoCardHeight(doc, cardWidth, rows);

  // Card container (subtle)
  doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, cardWidth, cardH, 2, 2, "FD");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(title, x + padX, y + padY + 3.2);

  // Underline
  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.35);
  doc.line(x + padX, y + padY + 5.2, x + cardWidth - padX, y + padY + 5.2);

  // Rows
  let cy = y + padY + titleBlockH;

  for (const r of rows) {
    const label = String(r.label || "").trim();
    const value = String(r.value || "—");

    // label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text(`${label}:`, x + padX, cy);

    // value (wrapped)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

    const lines = doc.splitTextToSize(value, valueW);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], x + padX + labelW, cy + i * lineH);
    }

    cy += Math.max(1, lines.length) * lineH + rowGap;
  }

  return y + cardH;
}
function formatPharmacyAddressLines(loggedInUser?: UserDto | null): string[] {
  const u: any = loggedInUser || {};

  // Try common shapes: user.address, user.pharmacy.address, user.tenant.address, etc.
  const a: any =
    u.pharmacy_address ||
    u.pharmacyAddress ||
    u.pharmacy?.address ||
    u.tenant?.address ||
    u.organisation?.address ||
    u.organization?.address ||
    u.address ||
    {};

  const line1 =
    a.line1 || a.address1 || a.addressLine1 || u.addressLine1 || u.line1;
  const line2 =
    a.line2 || a.address2 || a.addressLine2 || u.addressLine2 || u.line2;
  const city = a.city || a.town || a.locality || u.city;
  const county = a.county || a.state || a.region || u.county || u.state;
  const postcode =
    a.postcode || a.postalCode || a.zip || a.pincode || u.postcode;
  const country = a.country || u.country;

  return [line1, line2, city, county, postcode, country]
    .filter(Boolean)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

function writePrivateRxTopCards(
  doc: jsPDF,
  cursor: PdfCursor,
  order: OrderDto,
  user: UserDto | null, // patient user (as you already had)
  loggedInUser: UserDto | null // NEW: logged-in user for left card
) {
  const pageWidth = getPageWidth(doc);
  const gap = 8;
  const cardW = (pageWidth - 2 * MARGIN_X - gap) / 2;

  // ---------------- Patient (right card) ----------------
  const u: any = user || {};
  const patientName = getDisplayPatientName(order, user || undefined);

  const patientAddrLines = formatPatientAddressLines(user, order);
  const patientEmail =
    u.email || (order as any)?.email || (order as any)?.patient_email || "—";
  const patientPhone = u.phone || u.phoneNumber || (order as any)?.phone || "—";
  const contact = [patientEmail, patientPhone].filter(Boolean).join(" | ");

  const dob = u.dob ? formatDateOnly(u.dob) || "—" : "—";

  const rightRows: PdfInfoRow[] = [
    { label: "Name", value: patientName || "—" },
    { label: "DOB", value: dob },
    {
      label: "Address",
      value: patientAddrLines.length ? patientAddrLines.join(", ") : "—",
    },
    { label: "Contact", value: contact || "—" },
  ];

  // ---------------- Logged-in user (left card) ----------------
  const lu: any = loggedInUser || {};

  const pharmacyName =
    lu.pharmacy_name ||
    lu.pharmacyName ||
    lu.tenant?.name ||
    lu.firstName ||
    lu.companyName ||
    lu.organisationName ||
    lu.organizationName ||
    "—";

  const pharmacyAddrLines = formatPharmacyAddressLines(loggedInUser);
  const pharmacyAddress = pharmacyAddrLines.length
    ? pharmacyAddrLines.join(", ")
    : (PHARMACY_INFO.addressLines || []).join(", ") || "—";

  const pharmacyTel =
    lu.tel ||
    lu.phone ||
    lu.phoneNumber ||
    lu.mobile ||
    PHARMACY_INFO.tel ||
    "—";

  const pharmacyEmail = lu.email || PHARMACY_INFO.email || "—";

  const leftRows: PdfInfoRow[] = [
    { label: "Name", value: pharmacyName },
    { label: "Address", value: pharmacyAddress },
    { label: "Tel", value: pharmacyTel },
    { label: "Email", value: pharmacyEmail },
  ];

  // Measure first so we can ensure space before drawing
  const h1 = measureInfoCardHeight(doc, cardW, leftRows);
  const h2 = measureInfoCardHeight(doc, cardW, rightRows);
  const maxH = Math.max(h1, h2);

  ensureSpace(doc, cursor, maxH + 6);

  const y = cursor.y;
  const leftBottom = drawInfoCard(
    doc,
    MARGIN_X,
    y,
    cardW,
    "Pharmacy Details",
    leftRows
  );
  const rightBottom = drawInfoCard(
    doc,
    MARGIN_X + cardW + gap,
    y,
    cardW,
    "Patient Information",
    rightRows
  );

  cursor.y = Math.max(leftBottom, rightBottom) + 10;
}
/* ----------------- Risk Assessment PDF section (uses meta.riskAssessment) ----------------- */

async function writeRiskAssessmentSection(
  doc: jsPDF,
  cursor: PdfCursor,
  order: OrderDto
) {
  const items = getRiskAssessmentItems(order);

  writeSectionTitle(doc, cursor, "Risk Assessment Form (RAF)");

  if (!items.length) {
    ensureSpace(doc, cursor);
    doc.text(
      "No Risk Assessment data captured for this order.",
      MARGIN_X,
      cursor.y
    );
    cursor.y += 6;
    return;
  }

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx] || {};
    const q = String(it.question || it.key || `Question ${idx + 1}`);
    const { text: ans, files } = normaliseRiskValue(it.value);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const qLines = doc.splitTextToSize(
      `${idx + 1}. ${q}`,
      getPageWidth(doc) - 2 * MARGIN_X
    );
    qLines.forEach((line: string) => {
      ensureSpace(doc, cursor);
      doc.text(line, MARGIN_X, cursor.y);
      cursor.y += 4.6;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const aLines = doc.splitTextToSize(
      `Answer: ${ans}`,
      getPageWidth(doc) - 2 * MARGIN_X - 4
    );
    aLines.forEach((line: string) => {
      ensureSpace(doc, cursor);
      doc.text(line, MARGIN_X + 4, cursor.y);
      cursor.y += 4.3;
    });

    const imageFiles = files.filter(rafFileLooksLikeImage);
    for (const file of imageFiles) {
      const dataUrl = await fetchImageDataUrl(file.url);
      if (!dataUrl) continue;

      const pageW = getPageWidth(doc);
      const maxWidth = pageW - 2 * MARGIN_X;
      const imgWidth = Math.min(90, maxWidth);
      const imgHeight = imgWidth * 0.75;

      ensureSpace(doc, cursor, imgHeight + 8);
      try {
        doc.addImage(
          dataUrl,
          guessImageFormat(dataUrl || file.url),
          MARGIN_X,
          cursor.y,
          imgWidth,
          imgHeight
        );
        cursor.y += imgHeight + 4;
      } catch {
        // ignore
      }
    }

    const nonImage = files.filter((f) => !rafFileLooksLikeImage(f));
    if (nonImage.length) {
      const names = nonImage
        .map((f) => f.name || f.url)
        .filter(Boolean)
        .map(String);
      const line = `Attachment(s): ${uniqueJoin(names) || "—"}`;
      const lns = doc.splitTextToSize(
        line,
        getPageWidth(doc) - 2 * MARGIN_X - 4
      );
      lns.forEach((l: string) => {
        ensureSpace(doc, cursor);
        doc.setFontSize(9);
        doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
        doc.text(l, MARGIN_X + 4, cursor.y);
        doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
        cursor.y += 4.0;
      });
    }

    cursor.y += 3;
  }
}

/* ----------------- Declaration / Record sections ----------------- */

async function getSignatureDataUrl(order: OrderDto): Promise<string | null> {
  try {
    const meta: any = (order as any).meta || {};
    const declaration = meta.pharmacistDeclaration;
    const url: string | undefined = declaration?.signatureUrl;
    if (!url) return null;
    return fetchImageDataUrl(url);
  } catch {
    return null;
  }
}

function writeDeclarationSection(
  doc: jsPDF,
  cursor: PdfCursor,
  order: OrderDto,
  signatureDataUrl?: string | null
) {
  const meta: any = (order as any).meta || {};
  const declaration = meta.pharmacistDeclaration;

  writeSectionTitle(doc, cursor, "Pharmacist Declaration");

  if (!declaration) {
    ensureSpace(doc, cursor);
    doc.text(
      "No Pharmacist Declaration has been recorded.",
      MARGIN_X,
      cursor.y
    );
    cursor.y += 6;
    return;
  }

  const fields: Record<string, string> = declaration.fields || {};
  const entries = Object.entries(fields);

  if (!entries.length) {
    ensureSpace(doc, cursor);
    doc.text("No declaration fields were filled.", MARGIN_X, cursor.y);
    cursor.y += 6;
  } else {
    entries.forEach(([key, value]) => {
      const labelLines = doc.splitTextToSize(`${key}:`, 60);
      const valueLines = doc.splitTextToSize(
        value || "—",
        getPageWidth(doc) - MARGIN_X - 60 - 10
      );

      const numLines = Math.max(labelLines.length, valueLines.length);
      for (let i = 0; i < numLines; i++) {
        ensureSpace(doc, cursor);
        const l = labelLines[i] || "";
        const v = valueLines[i] || "";
        if (l) {
          doc.setFontSize(9);
          doc.setTextColor(
            PDF_TEXT_MUTED.r,
            PDF_TEXT_MUTED.g,
            PDF_TEXT_MUTED.b
          );
          doc.text(l, MARGIN_X, cursor.y);
        }
        if (v) {
          doc.setFontSize(10);
          doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
          doc.text(v, MARGIN_X + 60, cursor.y);
        }
        cursor.y += 4.2;
      }
      cursor.y += 2;
    });
  }

  cursor.y += 4;

  if (signatureDataUrl) {
    ensureSpace(doc, cursor, 20);
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
    doc.text("Pharmacist signature", MARGIN_X, cursor.y);
    cursor.y += 4;

    try {
      const imgWidth = 40;
      const imgHeight = 18;
      doc.addImage(
        signatureDataUrl,
        guessImageFormat(signatureDataUrl),
        MARGIN_X,
        cursor.y,
        imgWidth,
        imgHeight
      );
      cursor.y += imgHeight + 4;
    } catch {
      ensureSpace(doc, cursor);
      doc.setTextColor(148, 163, 184);
      doc.text("Signature recorded in system.", MARGIN_X, cursor.y);
      cursor.y += 5;
    }
  } else if (declaration?.signatureUrl) {
    ensureSpace(doc, cursor);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Signature recorded in system.", MARGIN_X, cursor.y);
    cursor.y += 5;
  }

  if (declaration?.saved_at) {
    ensureSpace(doc, cursor);
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
    doc.text("Saved at:", MARGIN_X, cursor.y);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text(formatDateTime(declaration.saved_at), MARGIN_X + 20, cursor.y);
    cursor.y += 5;
  }
}

function writeRecordSection(doc: jsPDF, cursor: PdfCursor, order: OrderDto) {
  const meta: any = (order as any).meta || {};
  const record = meta.recordOfSupply;

  writeSectionTitle(doc, cursor, "Record of Supply");

  if (!record) {
    ensureSpace(doc, cursor);
    doc.text("No Record of Supply has been captured.", MARGIN_X, cursor.y);
    cursor.y += 6;
    return;
  }

  const recordFields: Record<string, any> = (record?.fields as any) || {};

  const recordDateStr =
    recordFields["Date provided"] ||
    recordFields["Date Provided"] ||
    formatDateOnly(
      (order as any).completed_at ||
        (order as any).completedAt ||
        (order as any).createdAt ||
        (order as any).created_at ||
        new Date().toISOString()
    );

  const itemsFromRecordFields =
    extractItemsFromRecordFieldsForPdf(recordFields);
  const orderedItems = itemsFromRecordFields.length
    ? itemsFromRecordFields
    : getOrderedItemsForPdf(order);

  ensureSpace(doc, cursor, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
  doc.text(
    `Date provided: ${String(recordDateStr || "—")}`,
    MARGIN_X,
    cursor.y
  );
  cursor.y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
  doc.text("Items supplied", MARGIN_X, cursor.y);
  cursor.y += 5;

  drawItemsSuppliedTable(doc, cursor, orderedItems);

  const remainingRows = buildRemainingRecordRows(recordFields);

  if (remainingRows.length) {
    drawKeyValueTable(doc, cursor, "Additional details", remainingRows);
  } else {
    ensureSpace(doc, cursor, 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No additional record details were captured.", MARGIN_X, cursor.y);
    cursor.y += 6;
  }
}

function finalisePdf(
  doc: jsPDF,
  filename: string,
  mode: PdfExportMode
): File | void {
  if (mode === "file") {
    const blob = doc.output("blob");
    return new File([blob], filename, { type: "application/pdf" });
  }
  doc.save(filename);
  return;
}

/* ----------------- Invoice PDF ----------------- */

function getLoginUrl() {
  if (typeof window === "undefined")
    return "https://pharmacy-express.co.uk/account";
  return `${window.location.origin}/account`;
}

async function exportInvoicePdf(
  order: OrderDto,
  user: UserDto | null, // ✅ patient (as you already use)
  loggedInUser: UserDto | null, // ✅ pharmacist (logged-in)
  mode: PdfExportMode = "download"
) {
  const invoiceNo = `#INV-${(order as any).reference || (order as any)._id}`;
  const invoiceDate = formatDateOnly(
    (order as any).completed_at ||
      (order as any).completedAt ||
      (order as any).createdAt ||
      (order as any).created_at ||
      new Date().toISOString()
  );

  const subtitle = `Invoice No: ${invoiceNo}  |  VAT No: ${PHARMACY_INFO.vatNo}  |  Date: ${invoiceDate}`;

  const [logoDataUrl, brandName] = await Promise.all([
    getPdfLogoDataUrl(),
    getPdfHeaderName(),
  ]);

  const doc = createPdfBaseDoc(
    "Invoice",
    subtitle,
    logoDataUrl,
    undefined,
    undefined,
    brandName || undefined
  );

  const pageWidth = getPageWidth(doc);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  // ---------------- Patient (Bill To) ----------------
  const patientName = getDisplayPatientName(order, user || undefined);
  const u: any = user || {};
  const dobLabel = u.dob ? formatDateOnly(u.dob) : null;

  const patientAddrParts = [
    u.address_line1 || u.addressLine1 || u.address_line_1 || u.address1,
    u.address_line2 || u.addressLine2 || u.address_line_2 || u.address2,
    u.city,
    u.county,
    u.postalcode || u.postcode,
    u.country,
  ].filter(Boolean);
  const patientAddress = patientAddrParts.join(", ");

  const patientEmail = u.email || (order as any).email || "";
  const patientPhone = u.phone || u.phoneNumber || (order as any).phone || "";
  const patientContactParts: string[] = [];
  if (patientEmail) patientContactParts.push(patientEmail);
  if (patientPhone) patientContactParts.push(patientPhone);
  const patientContact = patientContactParts.join(" | ");

  // ---------------- Pharmacist (From) = Logged-in user ----------------
  const p: any = loggedInUser || {};

  const pharmacistName =
    p.name ||
    p.fullName ||
    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
    PHARMACY_INFO.name;

  const pharmacistAddrParts = [
    p.address_line1 || p.addressLine1 || p.address_line_1 || p.address1,
    p.address_line2 || p.addressLine2 || p.address_line_2 || p.address2,
    p.city,
    p.county,
    p.postalcode || p.postcode,
    p.country,
  ].filter(Boolean);
  const pharmacistAddress = pharmacistAddrParts.length
    ? pharmacistAddrParts.join(", ")
    : PHARMACY_INFO.addressLines.join(", ");

  const pharmacistTel =
    p.phone || p.phoneNumber || p.mobile || PHARMACY_INFO.tel;

  const pharmacistEmail = p.email || PHARMACY_INFO.email;

  // ---------------- Cards ----------------
  const cardGap = 6;
  const cardWidth = (pageWidth - 2 * MARGIN_X - cardGap) / 2;

  const drawInfoCard = (
    x: number,
    y: number,
    width: number,
    title: string,
    rows: { label: string; value: string }[]
  ): number => {
    const labelWidth = 22;
    const contentWidth = width - labelWidth - 10;
    const lineHeight = 4;

    const prepared = rows.map((row) => {
      const value = row.value || "—";
      const lines = doc.splitTextToSize(value, contentWidth);
      const height = Math.max(1, lines.length) * lineHeight;
      return { ...row, lines, height };
    });

    let innerHeight = 0;
    prepared.forEach((r) => (innerHeight += r.height + 1));
    const cardHeight = 10 + innerHeight + 6;

    doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
    doc.setFillColor(PDF_CARD_BG.r, PDF_CARD_BG.g, PDF_CARD_BG.b);
    doc.roundedRect(x, y, width, cardHeight, 2, 2, "FD");

    let cy = y + 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
    doc.text(title, x + 4, cy);

    cy += 2.5;
    doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
    doc.setLineWidth(0.3);
    doc.line(x + 4, cy + 1, x + width - 4, cy + 1);
    cy += 4;

    prepared.forEach((row) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
      doc.text(row.label, x + 4, cy);

      doc.setFont("helvetica", "normal");
      row.lines.forEach((line: string, idx: number) => {
        const ly = cy + idx * lineHeight;
        doc.text(line, x + 4 + labelWidth, ly);
      });

      cy += row.height + 2;
    });

    return y + cardHeight;
  };

  // ✅ FROM = logged-in pharmacist
  const leftBottom = drawInfoCard(MARGIN_X, cursor.y, cardWidth, "From", [
    { label: "Name:", value: pharmacistName },
    { label: "Address:", value: pharmacistAddress || "—" },
    { label: "Tel:", value: pharmacistTel || "—" },
    { label: "Email:", value: pharmacistEmail || "—" },
  ]);

  // ✅ BILL TO = patient
  const rightBottom = drawInfoCard(
    MARGIN_X + cardWidth + cardGap,
    cursor.y,
    cardWidth,
    "Bill To",
    [
      { label: "Patient:", value: patientName },
      { label: "DOB:", value: dobLabel || "—" },
      { label: "Address:", value: patientAddress || "—" },
      { label: "Contact:", value: patientContact || "—" },
    ]
  );

  cursor.y = Math.max(leftBottom, rightBottom) + 10;

  // ---------- rest of your invoice unchanged ----------
  writeSectionTitle(doc, cursor, "Invoice Details");

  const items = ((order as any).meta?.items || []) as any[];

  if (!items.length) {
    ensureSpace(doc, cursor);
    doc.text("No items found for this order.", MARGIN_X, cursor.y);
    cursor.y += 6;
  } else {
    const tableX = MARGIN_X;
    const tableWidth = pageWidth - 2 * MARGIN_X;
    const colDescX = tableX;
    const colQtyX = tableX + tableWidth * 0.6;
    const colUnitX = tableX + tableWidth * 0.78;
    const colNetX = tableX + tableWidth * 0.9;

    ensureSpace(doc, cursor, 8);
    const headerY = cursor.y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text("Description", colDescX, headerY);
    doc.text("Qty", colQtyX, headerY);
    doc.text("Unit Price", colUnitX, headerY);
    doc.text("Net", colNetX, headerY);
    cursor.y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);

    items.forEach((it) => {
      const qty = it.qty ?? 1;
      const unitMinor = it.unitMinor ?? null;
      const totalMinor = it.totalMinor ?? null;
      const variation = it.variation || it.variations || it.strength || "";
      const desc = variation ? `${it.name} | ${variation}` : it.name || "Item";

      const descLines = doc.splitTextToSize(desc, colQtyX - colDescX - 4);
      const rowY = cursor.y;
      const rowHeight = descLines.length * 4.2 + 3;

      ensureSpace(doc, cursor, rowHeight);

      descLines.forEach((line: string, lineIdx: number) => {
        doc.text(line, colDescX, rowY + lineIdx * 4.2);
      });

      const numY = rowY;
      doc.text(String(qty), colQtyX, numY);
      if (unitMinor != null)
        doc.text((unitMinor / 100).toFixed(2), colUnitX, numY);
      if (totalMinor != null)
        doc.text((totalMinor / 100).toFixed(2), colNetX, numY);

      cursor.y = rowY + rowHeight;
    });
  }

  cursor.y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const total = (order as any).meta?.totalMinor ?? null;
  const totalText = `Total incl. VAT ${formatMoney(total)}`;
  ensureSpace(doc, cursor);
  doc.text(totalText, MARGIN_X, cursor.y);
  cursor.y += 8;

  writeSectionTitle(doc, cursor, "Payment Information");

  const paymentStatus =
    String((order as any).payment_status || "").toUpperCase() || "N/A";

  const paidAtSource =
    (order as any).paid_at ||
    (order as any).meta?.paid_at ||
    (order as any).completed_at ||
    (order as any).completedAt ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const paidDate = formatDateOnly(paidAtSource);
  const paymentLine = `Status: ${paymentStatus}  |  Date: ${paidDate}`;
  ensureSpace(doc, cursor);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(paymentLine, MARGIN_X, cursor.y);
  cursor.y += 6;

  const filename = `Invoice_${
    (order as any).reference || (order as any)._id
  }.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- RAF PDF ----------------- */

async function exportRafPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const serviceName = (order as any).service_name || "Service";
  const meta: any = (order as any).meta || {};
  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const [logoDataUrl, brandName] = await Promise.all([
    getPdfLogoDataUrl(),
    getPdfHeaderName(),
  ]);
  const doc = createPdfBaseDoc(
    "Risk Assessment Form",
    subtitle,
    logoDataUrl,
    undefined,
    undefined,
    brandName || undefined
  );
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);
  await writeRiskAssessmentSection(doc, cursor, order);

  const filename = `RAF_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- Advice PDF ----------------- */

async function exportAdvicePdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const serviceName = (order as any).service_name || "Service";
  const meta: any = (order as any).meta || {};

  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const [logoDataUrl, brandName] = await Promise.all([
    getPdfLogoDataUrl(),
    getPdfHeaderName(),
  ]);
  const doc = createPdfBaseDoc(
    "Pharmacist Advice",
    subtitle,
    logoDataUrl,
    undefined,
    undefined,
    brandName || undefined
  );

  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);
  writeAdviceSection(doc, cursor, order);

  const filename = `Advice_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- Declaration PDF (FIXED: pharmacist passed in) ----------------- */

async function exportDeclarationPdf(
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const serviceName = (order as any).service_name || "Service";
  const meta: any = (order as any).meta || {};
  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const [logoDataUrl, brandName] = await Promise.all([
    getPdfLogoDataUrl(),
    getPdfHeaderName(),
  ]);
  const signatureDataUrl = await getPharmacistSignatureDataUrl(pharmacist);

  const doc = createPdfBaseDoc(
    "Pharmacist Declaration",
    subtitle,
    logoDataUrl,
    undefined,
    undefined,
    brandName || undefined
  );

  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);
  writeDeclarationSection(doc, cursor, order, signatureDataUrl);

  const filename = `Declaration_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- Record of Supply PDF ----------------- */

async function exportRecordPdf(
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const meta: any = (order as any).meta || {};
  const record = meta.recordOfSupply;
  const recordFields: Record<string, any> = (record?.fields as any) || {};

  const recordDateStr =
    recordFields["Date provided"] ||
    recordFields["Date Provided"] ||
    formatDateOnly(
      (order as any).completed_at ||
        (order as any).completedAt ||
        (order as any).createdAt ||
        (order as any).created_at ||
        new Date().toISOString()
    );

  const subtitle = `Reference: ${reference}  |  Date: ${recordDateStr}`;
  const [logoDataUrl, brandName] = await Promise.all([
    getPdfLogoDataUrl(),
    getPdfHeaderName(),
  ]);
  const doc = createPdfBaseDoc(
    "Record of Supply",
    subtitle,
    logoDataUrl,
    undefined,
    undefined,
    brandName || undefined
  );

  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePrivateRxTopCards(doc, cursor, order, user, pharmacist);
  writeRecordSection(doc, cursor, order);

  const filename = `RecordOfSupply_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- Private Prescription PDF (RESTORED: branded header + patient/order + pharmacist details) ----------------- */

function buildPrivatePrescriptionSubtitle(order: OrderDto, copyLabel: string) {
  const meta: any = (order as any).meta || {};

  const dateSource =
    (order as any).completed_at ||
    (order as any).completedAt ||
    meta?.appointment_start_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const reference = (order as any).reference || (order as any)._id;

  return `Reference: ${reference}  |  Date: ${
    formatDateOnly(dateSource) || "—"
  }  |  Copy: ${copyLabel}`;
}

async function buildPrivatePrescriptionDoc(
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null,
  copyLabel: string
) {
  const reference = (order as any).reference || (order as any)._id;

  const [logoDataUrl, brandName] = await Promise.all([
    getPdfLogoDataUrl(),
    getPdfHeaderName(),
  ]);
  const subtitle = buildPrivatePrescriptionSubtitle(order, copyLabel);
  const declarationDate = formatDateOnly(getPrivateRxDateSource(order)) || "—";

  // ✅ If patient copy => watermark behind content
  const watermarkText = copyLabel.toLowerCase().includes("patient")
    ? "DO NOT DISPENSE"
    : undefined;

  // Use same branded header style as your other PDFs
  const doc = createPdfBaseDoc(
    "Private Prescription",
    subtitle,
    logoDataUrl,
    watermarkText,
    undefined,
    brandName || undefined
  );
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  // ✅ Restore patient + order details block
  writePrivateRxTopCards(doc, cursor, order, user, pharmacist);

  // ✅ Medicines
  writeSectionTitle(doc, cursor, "Medicine Prescribed");
  const items = getOrderedItemsForPdf(order);
  drawItemsSuppliedTable(doc, cursor, items);

  // ✅ Prescriber section (pharmacist details + signature)
  // writeSectionTitle(doc, cursor, "Prescriber");

  const pharmacistName = getPharmacistNameForPdf(order, pharmacist);
  const pharmacistGphc = getPharmacistGphcForPdf(order, pharmacist);

  // ensureSpace(doc, cursor, 18);

  // doc.setFont("helvetica", "normal");
  // doc.setFontSize(10);
  // doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

  // doc.text(`Name: ${pharmacistName || "—"}`, MARGIN_X, cursor.y);
  // cursor.y += 5;

  // doc.text(`GPhC Number: ${pharmacistGphc || "—"}`, MARGIN_X, cursor.y);
  // cursor.y += 7;

  // Prefer pharmacist profile signature image; fallback to declaration signatureUrl
  const signatureDataUrl =
    (await getPharmacistSignatureDataUrl(pharmacist)) ||
    (await getSignatureDataUrl(order));

  // doc.setFontSize(9.5);
  // doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
  // doc.text("Signature:", MARGIN_X, cursor.y);
  // cursor.y += 4;

  // if (signatureDataUrl) {
  //   try {
  //     const imgW = 55;
  //     const imgH = 18;
  //     ensureSpace(doc, cursor, imgH + 6);
  //     doc.addImage(signatureDataUrl, guessImageFormat(signatureDataUrl), MARGIN_X, cursor.y, imgW, imgH);
  //     cursor.y += imgH + 4;
  //   } catch {
  //     doc.setTextColor(148, 163, 184);
  //     doc.text("Signature recorded in system.", MARGIN_X, cursor.y);
  //     cursor.y += 5;
  //   }
  // } else {
  //   doc.setTextColor(148, 163, 184);
  //   doc.text("Signature not available.", MARGIN_X, cursor.y);
  //   cursor.y += 5;
  // }

  writePharmacistDeclarationBlock(
    doc,
    cursor,
    pharmacistName,
    pharmacistGphc,
    declarationDate,
    signatureDataUrl
  );

  // ✅ Footer contact line (restores professional finish)
  ensureSpace(doc, cursor, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);

  const footer = `For queries contact your pharmacist.`;
  const footerLines = doc.splitTextToSize(
    footer,
    getPageWidth(doc) - 2 * MARGIN_X
  );
  footerLines.forEach((l: string) => {
    ensureSpace(doc, cursor, 5);
    doc.text(l, MARGIN_X, cursor.y);
    cursor.y += 4.2;
  });

  return { doc, reference };
}

function drawDocWatermark(
  doc: jsPDF,
  text: string,
  opts?: { opacity?: number; fontSize?: number }
) {
  const pageW = getPageWidth(doc);
  const pageH = getPageHeight(doc);

  const opacity = opts?.opacity ?? 0.1; // Slightly more visible
  const fontSize = opts?.fontSize ?? 60;

  // Apply watermark using jsPDF's opacity (with GState)
  let usedGState = false;
  try {
    const GStateCtor = (doc as any).GState;
    if (GStateCtor && (doc as any).setGState) {
      const gs = new GStateCtor({ opacity });
      (doc as any).setGState(gs);
      usedGState = true;
    }
  } catch (err) {
    usedGState = false;
  }

  // Set watermark font and text color
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);

  if (!usedGState) {
    // Use a light color for watermark if opacity isn't supported
    doc.setTextColor(245, 247, 250); // Light grey
  } else {
    doc.setTextColor(235, 238, 242); // Slightly darker grey
  }

  // Add watermark text diagonally at a 35-degree angle
  doc.text(text, pageW / 2, pageH / 2, {
    align: "center",
    angle: 35, // Watermark angle
  });

  // Reset opacity
  if (usedGState) {
    try {
      const GStateCtor = (doc as any).GState;
      if (GStateCtor && (doc as any).setGState) {
        const gs = new GStateCtor({ opacity: 1 });
        (doc as any).setGState(gs);
      }
    } catch (err) {
      // Handle errors silently
    }
  }
}

async function exportPrivatePrescriptionPdf(
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const { doc, reference } = await buildPrivatePrescriptionDoc(
    order,
    user,
    pharmacist,
    "Dispense"
  );

  // Get the width and height of the page
  const pageW = getPageWidth(doc);
  const pageH = getPageHeight(doc);

  // Set the position for the text at the bottom
  const margin = 10; // Margin from bottom
  const startX = margin;
  const startY = pageH - margin - 20; // Position it 20 units from the bottom

  // Add the "DO NOT DISPENSE" text at the bottom in light grey color
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(200, 200, 200); // Light grey color
  doc.text("DO NOT DISPENSE", pageW / 2, startY, { align: "center" });

  const filename = `PrivatePrescription_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

async function exportPrivatePrescriptionPatientPdf(
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const { doc, reference } = await buildPrivatePrescriptionDoc(
    order,
    user,
    pharmacist,
    "Patient"
  );
  const filename = `PrivatePrescription_Patient_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ===========================
   1) LocalStorage helpers (optional)
   =========================== */

function readJsonFromLocalStorage(keys: string[]): any | null {
  if (typeof window === "undefined") return null;
  for (const k of keys) {
    try {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // ignore
    }
  }
  return null;
}

function getUserDisplayName(u?: any | null): string {
  if (!u) return "—";
  return (
    u.name ||
    u.fullName ||
    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
    u.email ||
    "—"
  );
}

function pickFirstTruthy(...vals: any[]): string {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function getPharmacistNameForPdf(order: OrderDto, pharmacist?: UserDto | null) {
  const meta: any = (order as any).meta || {};
  const decl = meta.pharmacistDeclaration;
  const fields: Record<string, any> = (decl?.fields as any) || {};

  const fromUser = getUserDisplayName(pharmacist as any);
  if (fromUser && fromUser !== "—") return fromUser;

  return (
    pickFirstTruthy(
      fields["Pharmacist Name"],
      fields["Pharmacist name"],
      fields["Pharmacist"],
      (decl as any)?.pharmacistName
    ) || "—"
  );
}

function getPharmacistGphcForPdf(order: OrderDto, pharmacist?: UserDto | null) {
  const meta: any = (order as any).meta || {};
  const decl = meta.pharmacistDeclaration;
  const fields: Record<string, any> = (decl?.fields as any) || {};

  const pu: any = pharmacist || {};
  const fromUser =
    pickFirstTruthy(
      pu.gphcNumber,
      pu.gphc_number,
      pu.registrationNumber,
      pu.registration_number,
      pu.regNumber,
      pu.reg_number
    ) || "";

  if (fromUser) return fromUser;

  return (
    pickFirstTruthy(
      fields["GPhC Number"],
      fields["GPhC number"],
      fields["GPhC"],
      (decl as any)?.gphcNumber
    ) || "—"
  );
}

function formatPatientAddressLines(user: UserDto | null, order?: OrderDto) {
  const u: any = user || {};
  const meta: any = (order as any)?.meta || {};

  const p =
    meta.patient ||
    meta.patientDetails ||
    meta.patient_details ||
    meta.personalDetails ||
    meta.personal_details ||
    meta.demographics ||
    {};

  const addr1 =
    u.address_line1 ||
    u.addressLine1 ||
    u.address_line_1 ||
    u.address1 ||
    p.address_line1 ||
    p.addressLine1 ||
    p.address1;

  const addr2 =
    u.address_line2 ||
    u.addressLine2 ||
    u.address_line_2 ||
    u.address2 ||
    p.address_line2 ||
    p.addressLine2 ||
    p.address2;

  const city = u.city || p.city;
  const county = u.county || p.county;
  const postcode = u.postalcode || u.postcode || p.postcode || p.postalcode;
  const country = u.country || p.country;

  return [addr1, addr2, city, county, postcode, country]
    .filter(Boolean)
    .map(String);
}

type PdfBuilder = (
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null,
  mode: PdfExportMode
) => Promise<File | void>;

// One canonical map for everything
const PDF_BUILDERS: Record<PdfKind, PdfBuilder> = {
  full: (o, u, p, mode) => exportAllClinicalPdf(o, u, p, mode),
  raf: (o, u, _p, mode) => exportRafPdf(o, u, mode) as any,
  advice: (o, u, _p, mode) => exportAdvicePdf(o, u, mode) as any,
  declaration: (o, u, p, mode) => exportDeclarationPdf(o, u, p, mode) as any,
  record: (o, u, p, mode) => exportRecordPdf(o, u, p, mode) as any,
  invoice: (o, u, p, mode) => exportInvoicePdf(o, u, p, mode) as any,
  private_rx: (o, u, p, mode) =>
    exportPrivatePrescriptionPdf(o, u, p, mode) as any,
  private_rx_patient: (o, u, p, mode) =>
    exportPrivatePrescriptionPatientPdf(o, u, p, mode) as any,
  treatment_notice: (o, u, p, mode) =>
    exportNotificationOfTreatmentPdf(o, u, p, mode) as any,
};

async function buildOrderPdf(
  kind: PdfKind,
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null,
  mode: PdfExportMode
): Promise<File | null> {
  const builder = PDF_BUILDERS[kind];
  if (!builder) return null;

  const result = await builder(order, user, pharmacist, mode);
  return mode === "file" ? (result as File) : null;
}

async function downloadOrderPdf(
  kind: PdfKind,
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null
) {
  await buildOrderPdf(kind, order, user, pharmacist, "download");
}

async function generateOrderPdfFile(
  kind: PdfKind,
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null
): Promise<File | null> {
  return await buildOrderPdf(kind, order, user, pharmacist, "file");
}

/* ===========================
   2) Watermark helper
   =========================== */

function addWatermarkToAllPages(doc: jsPDF, text: string) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);

    const pageW = getPageWidth(doc);
    const pageH = getPageHeight(doc);

    (doc as any).saveGraphicsState?.();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(54);
    doc.setTextColor(235, 238, 242);

    (doc as any).text(text, pageW / 2, pageH / 2, {
      align: "center",
      angle: 35,
    } as any);

    (doc as any).restoreGraphicsState?.();
  }

  doc.setPage(1);
}

/* ===========================
   3) Patient copy + Treatment Notice PDFs
   =========================== */

async function exportNotificationOfTreatmentPdf(
  order: OrderDto,
  patientUser: UserDto | null,
  pharmacistUser: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const x = MARGIN_X;

  const reference = (order as any).reference || (order as any)._id;
  const meta: any = (order as any).meta || {};
  const dateSource =
    (order as any).completed_at ||
    (order as any).completedAt ||
    meta?.appointment_start_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();
  const letterDate = formatDateOnly(dateSource) || "—";

  const patientName = getDisplayPatientName(order, patientUser || undefined);
  const pu: any = patientUser || {};
  const dob = pu.dob ? formatDateOnly(pu.dob) : "—";
  const patientAddrLines = formatPatientAddressLines(patientUser, order);
  const patientEmail =
    pu.email || (order as any).email || (order as any).patient_email || "";
  const patientPhone = pu.phone || pu.phoneNumber || (order as any).phone || "";

  const pharmacistName = getPharmacistNameForPdf(order, pharmacistUser);
  const pharmacistGphc = getPharmacistGphcForPdf(order, pharmacistUser);

  const items = getOrderedItemsForPdf(order);

  // Prefer pharmacist profile signature image; fallback to declaration signatureUrl
  const signatureDataUrl =
    (await getPharmacistSignatureDataUrl(pharmacistUser)) ||
    (await getSignatureDataUrl(order));

  // -------------------- NEW: header uses logged-in pharmacist --------------------
  const ph: any = pharmacistUser || {};

  const pick = (...vals: any[]) =>
    vals.find((v) => typeof v === "string" && v.trim());

  const pharmacistHeaderName = pick(
    ph.pharmacy_name,
    ph.pharmacyName,
    ph.organisation_name,
    ph.organisationName,
    ph.company_name,
    ph.companyName,
    ph.name,
    ph.fullName,
    [ph.firstName, ph.lastName].filter(Boolean).join(" "),
    PHARMACY_INFO.name
  ) as string;

  const pharmacistHeaderEmail = pick(ph.email, PHARMACY_INFO.email) as string;
  const pharmacistHeaderTel = pick(
    ph.phone,
    ph.phoneNumber,
    ph.mobile,
    PHARMACY_INFO.tel
  ) as string;

  const pharmacistAddrParts = [
    pick(ph.address_line1, ph.addressLine1, ph.address_line_1, ph.address1),
    pick(ph.address_line2, ph.addressLine2, ph.address_line_2, ph.address2),
    pick(ph.address_line3, ph.addressLine3, ph.address_line_3, ph.address3),
    pick(ph.city),
    pick(ph.county),
    pick(ph.postalcode, ph.postcode),
    pick(ph.country),
  ].filter(Boolean) as string[];

  const headerAddressLines =
    pharmacistAddrParts.length > 0
      ? pharmacistAddrParts
      : PHARMACY_INFO.addressLines;

  // ------------------------------------------------------------------------------

  let y = 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  // ✅ Header block now driven by pharmacist user (fallback to PHARMACY_INFO)
  const topLines = [
    pharmacistHeaderName,
    ...headerAddressLines,
    [pharmacistHeaderEmail, pharmacistHeaderTel].filter(Boolean).join(" | "),
  ].filter(Boolean);

  // Wrap lines safely so long text doesn't overflow
  topLines.forEach((ln) => {
    const wrapped = doc.splitTextToSize(String(ln), pageWidth - 2 * x);
    wrapped.forEach((w: string) => {
      doc.text(w, x, y);
      y += 4.6;
    });
  });

  y += 2;
  doc.text(`Date ${letterDate}`, x, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Notification of Treatment Issued", x, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const patientBlock = [
    `${patientName}${pu.dob ? `, ${dob}` : ""}`,
    ...patientAddrLines,
    [patientEmail, patientPhone].filter(Boolean).join(" | "),
  ].filter(Boolean);

  patientBlock.forEach((ln) => {
    const lines = doc.splitTextToSize(ln, pageWidth - 2 * x);
    lines.forEach((l: string) => {
      doc.text(l, x, y);
      y += 4.8;
    });
  });

  y += 8;

  const writePara = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * x);
    lines.forEach((l: string) => {
      if (y > pageHeight - 22) {
        doc.addPage();
        y = 18;
      }
      doc.text(l, x, y);
      y += 4.8;
    });
    y += 3;
  };

  const writeBullets = (bullets: string[]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const maxW = pageWidth - 2 * x;
    const bulletIndent = 6;

    bullets.forEach((b) => {
      const wrapped = doc.splitTextToSize(b, maxW - bulletIndent);
      if (y > pageHeight - 22) {
        doc.addPage();
        y = 18;
      }
      doc.text("•", x, y);
      doc.text(wrapped[0] || "", x + bulletIndent, y);
      y += 4.8;
      for (let i = 1; i < wrapped.length; i++) {
        if (y > pageHeight - 22) {
          doc.addPage();
          y = 18;
        }
        doc.text(wrapped[i], x + bulletIndent, y);
        y += 4.8;
      }
    });

    y += 3;
  };

  writePara("Dear Doctor or To whom it may concern");

  writePara(
    "This patient received an assessment from our clinical team on the date shown above for weight management and was supplied the treatment ordered through our service. The patient informed us that you are their regular GP so we are sharing this update for your awareness."
  );

  writePara(
    "The treatment was issued after an online consultation confirmed suitability for private prescribing. We reviewed medical history, current medicines, allergies, BMI and previous efforts to reduce weight."
  );

  writePara(
    "We follow strict clinical standards and national guidance to ensure safe and responsible prescribing:"
  );

  writeBullets([
    "We follow the medicine information sheets and all relevant safety criteria",
    "We request photographic evidence of weight and body shape at the start and at regular intervals",
    "We initiate treatment only when BMI meets required thresholds (including adjusted thresholds where applicable) and when clinically appropriate",
    "We require GP details for every order and do not prescribe if GP details are withheld",
    "We review patients at appropriate intervals for ongoing eligibility and safety",
    "We request updated photographic evidence of weight and eligibility every three to six months or more often when clinically needed",
  ]);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Medication supplied", x, y);
  y += 6;

  if (!items.length) {
    doc.setFont("helvetica", "normal");
    doc.text("—", x, y);
    y += 6;
  } else {
    const meds = items.map((it) => {
      const v = it.variation ? ` ${it.variation}` : "";
      return `${it.qty || "1"} x ${it.name || "Item"}${v}`;
    });
    writeBullets(meds);
  }

  writePara(
    "The patient has been advised on correct use and effects, lifestyle guidance including diet and physical activity, and when urgent medical help is needed. They have been invited to contact us with any questions or concerns about their treatment."
  );

  writePara(
    "This treatment is provided privately and you are not expected to assume responsibility for prescribing it. We will continue to assess any further requests from the patient as part of their ongoing care."
  );

  writePara(
    "For air travel we kindly request that the patient is permitted to carry this medication in hand luggage to avoid freezing damage. Additional items such as needles or syringes may be placed in hold luggage."
  );

  y += 2;
  doc.setFont("helvetica", "normal");
  doc.text("Kind regards", x, y);
  y += 10;

  if (signatureDataUrl) {
    try {
      doc.addImage(
        signatureDataUrl,
        guessImageFormat(signatureDataUrl),
        x,
        y - 6,
        55,
        18
      );
      y += 14;
    } catch {
      // ignore
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(pharmacistName || "—", x, y);
  y += 5;
  doc.text(`GPHC Number ${pharmacistGphc || "—"}`, x, y);

  const filename = `NotificationOfTreatment_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- Full Clinical PDF (FIXED: jsPDF only) ----------------- */

async function exportAllClinicalPdf(
  order: OrderDto,
  user: UserDto | null,
  pharmacist: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const serviceName = (order as any).service_name || "Service";
  const meta: any = (order as any).meta || {};

  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).completedAt ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const [logoDataUrl, brandName] = await Promise.all([
    getPdfLogoDataUrl(),
    getPdfHeaderName(),
  ]);

  const doc = createPdfBaseDoc(
    "Clinical Documentation",
    subtitle,
    logoDataUrl,
    undefined,
    undefined,
    brandName || undefined
  );

  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  // Keep existing top cards
  writePrivateRxTopCards(doc, cursor, order, user, pharmacist);

  // RAF items (your existing normaliser)
  const items = normaliseRafItems(getRiskAssessmentItems(order), order);

  if (!items.length) {
    ensureSpace(doc, cursor, 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text(
      "No RAF / Clinical Assessment has been recorded for this order.",
      MARGIN_X,
      cursor.y
    );
    cursor.y += 6;

    const filename = `Clinical_${reference}.pdf`;
    return finalisePdf(doc, filename, mode);
  }

  // Render RAF as sectioned Q/A tables (jsPDF)
  await writeRafOnlySection(doc, cursor, items);
  writeRecordSection(doc, cursor, order);

  const filename = `Clinical_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ---------------- RAF-only rendering (Question | Answer tables) ---------------- */

// type RafItem = {
//   section: string;
//   question: string;
//   answer: string;
// };

function getContentWidth(doc: jsPDF) {
  return getPageWidth(doc) - 2 * MARGIN_X;
}

function writeGreenTitle(doc: jsPDF, cursor: PdfCursor, text: string) {
  ensureSpace(doc, cursor, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(text, MARGIN_X, cursor.y);

  const pageW = getPageWidth(doc);
  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, cursor.y + 2.2, pageW - MARGIN_X, cursor.y + 2.2);

  cursor.y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
}

function writeGreenSubTitle(doc: jsPDF, cursor: PdfCursor, text: string) {
  ensureSpace(doc, cursor, 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(text, MARGIN_X, cursor.y);

  const pageW = getPageWidth(doc);
  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.45);
  doc.line(MARGIN_X, cursor.y + 2.0, pageW - MARGIN_X, cursor.y + 2.0);

  cursor.y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
}

/* ---------------- RAF-only rendering (Question | Answer tables) ---------------- */

type RafItem = {
  section: string;
  question: string;
  answer: string;
  images?: RafFileRef[]; // ✅ image attachments to render in PDF (RAF only)
};

function normaliseRafItems(raw: any[], order: OrderDto): RafItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: RafItem[] = [];

  for (const it of arr) {
    const section =
      (it?.section ||
        it?.group ||
        it?.category ||
        it?.block ||
        it?.title ||
        "Clinical Assessment") + "";

    const question =
      (it?.question || it?.q || it?.label || it?.name || "") + "";
    const answerVal = it?.answer ?? it?.a ?? it?.value ?? it?.response;

    if (!question.trim()) continue;

    // ✅ Use the same RAF normaliser so files (incl images) are detected
    let { text, files } = normaliseRiskValue(answerVal);

    // ✅ If backend stores direct image URL as string, convert to file ref
    if (typeof answerVal === "string") {
      const s = answerVal.trim();
      if (s && /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(s)) {
        const already = files.some((f) => String(f.url) === s);
        if (!already) files.push({ url: s, name: s.split("/").pop() });
      }
    }

    const imageFiles = files.filter(rafFileLooksLikeImage);
    const nonImage = files.filter((f) => !rafFileLooksLikeImage(f));

    // ✅ If the "answer" is only an image upload, do NOT show filename/url
    const looksLikeAutoAttachmentText = /^attached file/i.test(
      String(text || "").trim()
    );
    if (
      (text === "—" || looksLikeAutoAttachmentText) &&
      imageFiles.length &&
      !nonImage.length
    ) {
      text = imageFiles.length === 1 ? "Image attached" : "Images attached";
    }

    // keep non-image attachments readable (optional), without affecting images
    if (nonImage.length) {
      const names = nonImage
        .map((f) => f.name || f.url)
        .filter(Boolean)
        .map(String);
      const att = `Attachment(s): ${uniqueJoin(names) || "—"}`;
      text = text && text !== "—" ? `${text} | ${att}` : att;
    }

    out.push({
      section: section.trim() || "Clinical Assessment",
      question: question.trim(),
      answer:
        String(text || "No response provided").trim() || "No response provided",
      images: imageFiles.length ? imageFiles : undefined,
    });
  }

  return out;
}

// async function writeRafOnlySection(doc: jsPDF, cursor: PdfCursor, items: RafItem[]) {
//   writeGreenTitle(doc, cursor, "Clinical Assessment");
//   cursor.y += 2;

//   const sections: { title: string; rows: RafItem[] }[] = [];
//   const seen = new Map<string, number>();

//   for (const it of items) {
//     const key = (it.section || "Clinical Assessment").trim() || "Clinical Assessment";
//     const idx = seen.get(key);
//     if (idx === undefined) {
//       seen.set(key, sections.length);
//       sections.push({ title: key, rows: [it] });
//     } else {
//       sections[idx].rows.push(it);
//     }
//   }

//   for (const sec of sections) {
//     writeGreenSubTitle(doc, cursor, sec.title);
//     await drawQaTable(doc, cursor, sec.rows); // ✅ await for image rendering
//     cursor.y += 8;
//   }
// }

async function drawQaTable(doc: jsPDF, cursor: PdfCursor, rows: RafItem[]) {
  const pageW = getPageWidth(doc);
  const pageH = getPageHeight(doc);

  const x = MARGIN_X;
  const tableW = pageW - 2 * MARGIN_X;

  const border = PDF_BORDER;
  const headerBg = { r: 232, g: 245, b: 233 };

  const colQ = tableW * 0.62;
  const colA = tableW - colQ;

  const padX = 2.2;
  const padY = 2.5;
  const lineH = 4.2;
  const headerH = 8;

  const bottomMargin = 18;

  const drawHeader = () => {
    ensureSpace(doc, cursor, headerH + 2);

    doc.setFillColor(headerBg.r, headerBg.g, headerBg.b);
    doc.rect(x, cursor.y, tableW, headerH, "F");

    doc.setDrawColor(border.r, border.g, border.b);
    doc.setLineWidth(0.35);
    doc.rect(x, cursor.y, tableW, headerH, "S");

    doc.line(x + colQ, cursor.y, x + colQ, cursor.y + headerH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text("Question", x + padX, cursor.y + 5.6);
    doc.text("Answer", x + colQ + padX, cursor.y + 5.6);

    cursor.y += headerH;
  };

  if (!rows.length) return;

  drawHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.8);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

  for (const r of rows) {
    const q = String(r.question || "—").trim() || "—";
    const a =
      String(r.answer || "No response provided").trim() ||
      "No response provided";

    const qLines = doc.splitTextToSize(q, colQ - padX * 2) as string[];
    const aLines = doc.splitTextToSize(a, colA - padX * 2) as string[];

    const totalLines = Math.max(qLines.length, aLines.length, 1);
    let lineIndex = 0;

    while (lineIndex < totalLines) {
      const remainingH = pageH - bottomMargin - cursor.y;

      if (remainingH < padY * 2 + lineH + 2) {
        addPageWithHeader(doc, cursor);
        drawHeader();
        continue;
      }

      const maxLinesThisPage = Math.max(
        1,
        Math.floor((remainingH - padY * 2) / lineH)
      );

      const segQ = qLines.slice(lineIndex, lineIndex + maxLinesThisPage);
      const segA = aLines.slice(lineIndex, lineIndex + maxLinesThisPage);
      const segLines = Math.max(segQ.length, segA.length, 1);

      const rowH = padY * 2 + segLines * lineH;

      doc.setDrawColor(border.r, border.g, border.b);
      doc.setLineWidth(0.35);
      doc.setFillColor(255, 255, 255);
      doc.rect(x, cursor.y, tableW, rowH, "FD");

      doc.line(x + colQ, cursor.y, x + colQ, cursor.y + rowH);

      const textTop = cursor.y + padY + 3.2;

      for (let i = 0; i < segLines; i++) {
        const qTxt = segQ[i] || "";
        const aTxt = segA[i] || "";

        if (qTxt) doc.text(qTxt, x + padX, textTop + i * lineH);
        if (aTxt) doc.text(aTxt, x + colQ + padX, textTop + i * lineH);
      }

      cursor.y += rowH;
      lineIndex += maxLinesThisPage;
    }

    // ✅ Render RAF images (if any) directly under the row, aligned to Answer column.
    if (r.images?.length) {
      const imgX = x + colQ + padX;
      const maxImgW = Math.max(30, colA - padX * 2);
      const imgW = Math.min(68, maxImgW); // fits Answer column on A4
      const imgH = imgW * 0.75;

      for (const f of r.images) {
        const dataUrl = await fetchImageDataUrl(f.url);
        if (!dataUrl) continue;

        ensureSpace(doc, cursor, imgH + 6);
        try {
          doc.addImage(
            dataUrl,
            guessImageFormat(dataUrl || f.url),
            imgX,
            cursor.y,
            imgW,
            imgH
          );
          cursor.y += imgH + 4;
        } catch {
          // ignore
        }
      }
    }

    cursor.y += 2;
  }

  cursor.y += 6;
}

async function writeRafOnlySection(
  doc: jsPDF,
  cursor: PdfCursor,
  items: RafItem[]
) {
  writeGreenTitle(doc, cursor, "Clinical Assessment");
  cursor.y += 2;

  // Group by section (preserve order of first appearance)
  const sections: { title: string; rows: RafItem[] }[] = [];
  const seen = new Map<string, number>();

  for (const it of items) {
    const key =
      (it.section || "Clinical Assessment").trim() || "Clinical Assessment";
    const idx = seen.get(key);
    if (idx === undefined) {
      seen.set(key, sections.length);
      sections.push({ title: key, rows: [it] });
    } else {
      sections[idx].rows.push(it);
    }
  }

  for (const sec of sections) {
    writeGreenSubTitle(doc, cursor, sec.title);

    // ✅ IMPORTANT: wait for image fetches + rendering to finish
    await drawQaTable(doc, cursor, sec.rows);

    cursor.y += 8;
  }
}

// function drawQaTable(doc: jsPDF, cursor: PdfCursor, rows: RafItem[]) {
//   const pageW = getPageWidth(doc);
//   const pageH = getPageHeight(doc);

//   const x = MARGIN_X;
//   const tableW = pageW - 2 * MARGIN_X;

//   const border = PDF_BORDER;
//   const headerBg = { r: 232, g: 245, b: 233 }; // light green tint

//   const colQ = tableW * 0.62;
//   const colA = tableW - colQ;

//   const padX = 2.2;
//   const padY = 2.5;
//   const lineH = 4.2;
//   const headerH = 8;

//   const drawHeader = () => {
//     ensureSpace(doc, cursor, headerH + 2);

//     // background
//     doc.setFillColor(headerBg.r, headerBg.g, headerBg.b);
//     doc.rect(x, cursor.y, tableW, headerH, "F");

//     // border
//     doc.setDrawColor(border.r, border.g, border.b);
//     doc.setLineWidth(0.35);
//     doc.rect(x, cursor.y, tableW, headerH, "S");

//     // vertical divider
//     doc.line(x + colQ, cursor.y, x + colQ, cursor.y + headerH);

//     // text
//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(9.5);
//     doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
//     doc.text("Question", x + padX, cursor.y + 5.6);
//     doc.text("Answer", x + colQ + padX, cursor.y + 5.6);

//     cursor.y += headerH;
//   };

//   if (!rows.length) return;

//   drawHeader();

//   doc.setFont("helvetica", "normal");
//   doc.setFontSize(9.8);
//   doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

//   const bottomMargin = 18;

//   for (const r of rows) {
//     const q = String(r.question || "—").trim() || "—";
//     const a = String(r.answer || "No response provided").trim() || "No response provided";

//     const qLines = doc.splitTextToSize(q, colQ - padX * 2) as string[];
//     const aLines = doc.splitTextToSize(a, colA - padX * 2) as string[];

//     // If a single row is too tall, split it into multiple row blocks
//     const totalLines = Math.max(qLines.length, aLines.length, 1);
//     let lineIndex = 0;

//     while (lineIndex < totalLines) {
//       const remainingH = pageH - bottomMargin - cursor.y;

//       // If not enough space for at least one line, go next page and repeat header
//       if (remainingH < padY * 2 + lineH + 2) {
//         addPageWithHeader(doc, cursor);
//         drawHeader();
//         continue;
//       }

//       const maxLinesThisPage = Math.max(
//         1,
//         Math.floor((remainingH - padY * 2) / lineH)
//       );

//       const segQ = qLines.slice(lineIndex, lineIndex + maxLinesThisPage);
//       const segA = aLines.slice(lineIndex, lineIndex + maxLinesThisPage);
//       const segLines = Math.max(segQ.length, segA.length, 1);

//       const rowH = padY * 2 + segLines * lineH;

//       // row rect
//       doc.setDrawColor(border.r, border.g, border.b);
//       doc.setLineWidth(0.35);
//       doc.setFillColor(255, 255, 255);
//       doc.rect(x, cursor.y, tableW, rowH, "FD");

//       // divider
//       doc.line(x + colQ, cursor.y, x + colQ, cursor.y + rowH);

//       // text
//       const textTop = cursor.y + padY + 3.2;

//       for (let i = 0; i < segLines; i++) {
//         const qTxt = segQ[i] || "";
//         const aTxt = segA[i] || "";

//         if (qTxt) doc.text(qTxt, x + padX, textTop + i * lineH);
//         if (aTxt) doc.text(aTxt, x + colQ + padX, textTop + i * lineH);
//       }

//       cursor.y += rowH;
//       lineIndex += maxLinesThisPage;
//     }
//   }

//   cursor.y += 6;
// }

// function normaliseRafItems(raw: any[], order: OrderDto): RafItem[] {
//   // Primary: whatever your getRiskAssessmentItems(order) returns
//   const arr = Array.isArray(raw) ? raw : [];

//   const out: RafItem[] = [];
//   for (const it of arr) {
//     const section =
//       (it?.section ||
//         it?.group ||
//         it?.category ||
//         it?.block ||
//         it?.title ||
//         "Clinical Assessment") + "";

//     const question = (it?.question || it?.q || it?.label || it?.name || "") + "";
//     const answerVal = it?.answer ?? it?.a ?? it?.value ?? it?.response;

//     if (!question.trim()) continue;

//     out.push({
//       section: section.trim() || "Clinical Assessment",
//       question: question.trim(),
//       answer: stringifyRafAnswer(answerVal),
//     });
//   }

//   // If your RAF is stored differently, you can extend this fallback later,
//   // but do NOT change your current pipeline unless you need it.
//   return out;
// }

function stringifyRafAnswer(v: any): string {
  if (v === null || v === undefined) return "No response provided";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : "No response provided";
  }
  if (Array.isArray(v)) {
    const parts = v
      .map(stringifyRafAnswer)
      .map((x) => x.trim())
      .filter(Boolean);
    return parts.length ? parts.join(", ") : "No response provided";
  }
  if (typeof v === "object") {
    // common cases: {label,value}, {name}, mongo objects, etc.
    if (typeof v.label === "string" && v.label.trim()) return v.label.trim();
    if (typeof v.value === "string" && v.value.trim()) return v.value.trim();
    if (typeof v.name === "string" && v.name.trim()) return v.name.trim();
    try {
      const s = JSON.stringify(v);
      return s && s !== "{}" ? s : "No response provided";
    } catch {
      return "No response provided";
    }
  }
  return "No response provided";
}

/* ----------------- UI: Patient card ----------------- */

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

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {fullName}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            {gender ? gender : "Gender: —"}
            {dobLabel && (
              <>
                {" "}
                • <span className="text-neutral-300">{dobLabel}</span>
              </>
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-300">
            {u.email && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Mail className="h-3 w-3 text-neutral-500" />
                <span className="break-all">{u.email}</span>
              </span>
            )}
            {(u.phone || u.phoneNumber) && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-neutral-500" />
                <span className="break-all">{u.phone || u.phoneNumber}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-neutral-500">Address line 1</dt>
          <dd className="break-words text-neutral-100">
            {u.address_line1 || u.addressLine1 || "—"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-neutral-500">Address line 2</dt>
          <dd className="break-words text-neutral-100">
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
          <dd className="text-neutral-100">
            {u.postalcode || u.postcode || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Country</dt>
          <dd className="text-neutral-100">{u.country || "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-4 border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
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

function OrderItemsListCard({ order }: { order: OrderDto }) {
  const items = useMemo(() => getOrderedItemsForPdf(order), [order]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
      <p className="mb-2 text-xs font-semibold text-neutral-200">
        Items in this order
      </p>

      {items.length === 0 ? (
        <p className="text-[11px] text-neutral-500">
          No items were recorded for this order.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <div className="grid grid-cols-12 bg-neutral-900/70 px-2 py-2 text-[10px] uppercase tracking-wide text-neutral-500">
            <div className="col-span-6">Item</div>
            <div className="col-span-4">Variation</div>
            <div className="col-span-2 text-right">Qty</div>
          </div>

          <div className="divide-y divide-neutral-800 bg-neutral-950/40">
            {items.map((it, idx) => (
              <div
                key={`${it.name}-${it.variation || ""}-${it.qty}-${idx}`}
                className="grid grid-cols-12 px-2 py-2 text-[11px] text-neutral-200"
              >
                <div className="col-span-6 min-w-0 pr-2">
                  <p className="break-words text-neutral-100">{it.name}</p>
                </div>
                <div className="col-span-4 min-w-0 pr-2 text-neutral-300">
                  <span className="break-words">{it.variation || "—"}</span>
                </div>
                <div className="col-span-2 text-right text-neutral-100">
                  {it.qty || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function AdviceChecklistCard({ order }: { order: OrderDto }) {
  const points = useMemo(() => extractAdvicePoints(order), [order]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
      <p className="mb-2 text-xs font-semibold text-neutral-200">
        Pharmacist advice (selected)
      </p>

      {points.length === 0 ? (
        <p className="text-[11px] text-neutral-500">
          No Pharmacist Advice has been recorded for this order.
        </p>
      ) : (
        <div className="space-y-2">
          {points.map((p, idx) => (
            <label
              key={`${p}-${idx}`}
              className="flex items-start gap-2 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2"
            >
              {/* read-only checked checkbox (display only) */}
              <input
                type="checkbox"
                checked
                readOnly
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <span className="text-[12px] leading-relaxed text-neutral-200">
                {p}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------- Types for clinical section tabs ----------------- */

type DetailSection = "raf" | "advice" | "declaration" | "record";
type PdfKind =
  | "full"
  | "raf"
  | "advice"
  | "declaration"
  | "record"
  | "invoice"
  | "private_rx"
  | "private_rx_patient"
  | "treatment_notice";

function getPdfLabel(kind: PdfKind): string {
  switch (kind) {
    case "full":
      return "Full Consultation Record";
    case "raf":
      return "Risk Assessment Form (RAF)";
    case "advice":
      return "Pharmacist Advice";
    case "declaration":
      return "Pharmacist Declaration";
    case "record":
      return "Record of Supply";
    case "invoice":
      return "Invoice";
    case "private_rx":
      return "Private Prescription";
    case "private_rx_patient":
      return "Private Prescription (Patient Copy)";
    case "treatment_notice":
      return "Notification of Treatment Issued";
    default:
      return kind;
  }
}

const DEFAULT_PAGE_SIZE = 25;

function useOnClickOutside<T extends HTMLElement>(
  refs: React.RefObject<T | null>[],
  handler: () => void,
  when: boolean
) {
  useEffect(() => {
    if (!when) return;

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      for (const r of refs) {
        if (r.current && r.current.contains(target)) return;
      }
      handler();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [refs, handler, when]);
}

/* ----------------- Page ----------------- */

export default function Page() {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<OrdersListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderUsers, setOrderUsers] = useState<Record<string, UserDto | null>>(
    {}
  );

  const [showDetail, setShowDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [orderedByUser, setOrderedByUser] = useState<UserDto | null>(null);

  const [activeSection, setActiveSection] = useState<DetailSection>("raf");

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [emailPdfMenuOpen, setEmailPdfMenuOpen] = useState(false);
  const [emailPdfSending, setEmailPdfSending] = useState(false);
  const [emailPdfStatus, setEmailPdfStatus] = useState<string | null>(null);

  const [emailPeopleOpen, setEmailPeopleOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [emailPeopleSending, setEmailPeopleSending] = useState(false);
  const [emailPeopleError, setEmailPeopleError] = useState<string | null>(null);

  const [loggedInPharmacist, setLoggedInPharmacist] = useState<UserDto | null>(
    null
  );

  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  const pageSize = DEFAULT_PAGE_SIZE;

  // Menus refs
  const downloadRef = useRef<HTMLDivElement | null>(null);
  const emailPdfRef = useRef<HTMLDivElement | null>(null);

  useOnClickOutside(
    [downloadRef],
    () => setDownloadMenuOpen(false),
    downloadMenuOpen
  );
  useOnClickOutside(
    [emailPdfRef],
    () => setEmailPdfMenuOpen(false),
    emailPdfMenuOpen
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await getCurrentUserApi();
        if (!cancelled) setLoggedInPharmacist(me as any);
      } catch (e) {
        console.error("Failed to load current user (pharmacist):", e);
        if (!cancelled) setLoggedInPharmacist(null);

        // optional localStorage fallback
        try {
          const stored =
            readJsonFromLocalStorage([
              "user",
              "auth_user",
              "currentUser",
              "me",
            ]) || null;
          if (stored && !cancelled) setLoggedInPharmacist(stored as any);
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOrdersApi({
          page,
          limit: pageSize, // IMPORTANT: backend typically expects `limit` not `pageSize`
          status: "completed",
          search: search || undefined,
        } as any);

        const list =
          (res as any)?.data ??
          (res as any)?.orders ??
          (Array.isArray(res) ? res : []);
        const metaRes = (res as any)?.meta ?? null;

        if (!cancelled) {
          setOrders(list || []);
          setMeta(metaRes);
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(
          err?.message ||
            "Failed to load orders. Please try again or refresh the page."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, search]);

  useEffect(() => {
    async function fetchUsersForOrders() {
      if (!orders.length) return;

      const allIds = Array.from(
        new Set(
          orders
            .map((o: any) =>
              String(o.user_id || o.userId || o.patient_user_id || "")
            )
            .filter(Boolean)
        )
      );

      const missingIds = allIds.filter((id) => orderUsers[id] === undefined);
      if (!missingIds.length) return;

      try {
        const results = await Promise.all(
          missingIds.map(async (id) => {
            try {
              const res = await getUserByIdApi(id);
              const user =
                (res as any)?.data ?? (res as any)?.user ?? (res as any);
              return { id, user: (user as UserDto) || null };
            } catch (err) {
              console.error("Failed to fetch user for order", id, err);
              return { id, user: null as UserDto | null };
            }
          })
        );

        setOrderUsers((prev) => {
          const next = { ...prev };
          for (const { id, user } of results) {
            if (next[id] === undefined) next[id] = user;
          }
          return next;
        });
      } catch (err) {
        console.error("Error prefetching users for orders", err);
      }
    }

    fetchUsersForOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const openOrderDetail = async (order: OrderDto) => {
    setShowDetail(true);
    setSelectedOrder(order);
    setOrderedByUser(null);
    setDetailError(null);
    setDetailLoading(true);
    setActiveSection("raf");
    setDownloadMenuOpen(false);
    setEmailPdfMenuOpen(false);
    setEmailPdfStatus(null);

    try {
      const userId =
        (order as any).user_id ||
        (order as any).userId ||
        (order as any).patient_user_id;

      const promises: Promise<any>[] = [
        getOrderByIdApi((order as any)._id) as any,
      ];
      if (userId && !orderUsers[String(userId)])
        promises.push(getUserByIdApi(String(userId)) as any);

      const [orderRes, maybeUserRes] = await Promise.all(promises);

      const fullOrder =
        (orderRes as any)?.data ??
        (orderRes as any)?.order ??
        orderRes ??
        order;
      setSelectedOrder(fullOrder);

      if (userId) {
        let user: UserDto | null = null;
        if (maybeUserRes)
          user =
            (maybeUserRes as any)?.data ??
            (maybeUserRes as any)?.user ??
            maybeUserRes;
        else user = orderUsers[String(userId)] ?? null;

        if (user) {
          setOrderedByUser(user);
          setOrderUsers((prev) => ({ ...prev, [String(userId)]: user }));
        }
      }
    } catch (err: any) {
      setDetailError(
        err?.message || "Unable to load full order details at this time."
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedOrder(null);
    setOrderedByUser(null);
    setDetailError(null);
    setDownloadMenuOpen(false);
    setEmailPdfMenuOpen(false);
  };

  const handleDownloadPdf = async (kind: PdfKind) => {
    if (!selectedOrder) return;
    try {
      const order = selectedOrder;
      const user = orderedByUser;

      switch (kind) {
        case "full":
          await exportAllClinicalPdf(
            order,
            user,
            loggedInPharmacist,
            "download"
          );
          break;
        case "raf":
          await exportRafPdf(order, user, "download");
          break;
        case "advice":
          await exportAdvicePdf(order, user, "download");
          break;
        case "declaration":
          await exportDeclarationPdf(
            order,
            user,
            loggedInPharmacist,
            "download"
          );
          break;
        case "record":
          await exportRecordPdf(order, user, loggedInPharmacist, "download");
          break;
        case "invoice":
          await exportInvoicePdf(order, user, loggedInPharmacist, "download");
          break;
        case "private_rx":
          await exportPrivatePrescriptionPdf(
            order,
            user,
            loggedInPharmacist,
            "download"
          );
          break;
        case "private_rx_patient":
          await exportPrivatePrescriptionPatientPdf(
            order,
            user,
            loggedInPharmacist,
            "download"
          );
          break;
        case "treatment_notice":
          await exportNotificationOfTreatmentPdf(
            order,
            user,
            loggedInPharmacist,
            "download"
          );
          break;
      }
    } catch (err) {
      console.error("PDF download failed", err);
    }
  };

  const generatePdfFile = async (kind: PdfKind): Promise<File | null> => {
    if (!selectedOrder) return null;
    const order = selectedOrder;
    const user = orderedByUser;

    switch (kind) {
      case "full":
        return (await exportAllClinicalPdf(
          order,
          user,
          loggedInPharmacist,
          "file"
        )) as File;
      case "raf":
        return (await exportRafPdf(order, user, "file")) as File;
      case "advice":
        return (await exportAdvicePdf(order, user, "file")) as File;
      case "declaration":
        return (await exportDeclarationPdf(
          order,
          user,
          loggedInPharmacist,
          "file"
        )) as File;
      case "record":
        return (await exportRecordPdf(
          order,
          user,
          loggedInPharmacist,
          "file"
        )) as File;
      case "invoice":
        return (await exportInvoicePdf(
          order,
          user,
          loggedInPharmacist,
          "file"
        )) as File;
      case "private_rx":
        return (await exportPrivatePrescriptionPdf(
          order,
          user,
          loggedInPharmacist,
          "file"
        )) as File;
      case "private_rx_patient":
        return (await exportPrivatePrescriptionPatientPdf(
          order,
          user,
          loggedInPharmacist,
          "file"
        )) as File;
      case "treatment_notice":
        return (await exportNotificationOfTreatmentPdf(
          order,
          user,
          loggedInPharmacist,
          "file"
        )) as File;
      default:
        return null;
    }
  };

  const handleEmailPdf = async (kind: PdfKind) => {
    if (!selectedOrder) return;

    const order = selectedOrder;
    const patientName = getDisplayPatientName(
      order,
      orderedByUser ?? undefined
    );
    const u: any = orderedByUser || {};
    const email =
      u.email || (order as any).email || (order as any).patient_email || "";

    if (!email) {
      setEmailPdfStatus("No email address found for this patient/order.");
      return;
    }

    setEmailPdfSending(true);
    setEmailPdfStatus(null);

    try {
      const file = await generatePdfFile(kind);
      if (!file) throw new Error("Failed to generate PDF.");

      const subject = `${getPdfLabel(kind)} - ${
        (order as any).service_name || "Order"
      } (${(order as any).reference || (order as any)._id})`;

      const message =
        `Dear ${patientName || "Patient"},\n\n` +
        `Please find attached your ${getPdfLabel(
          kind
        ).toLowerCase()} for your recent consultation (${
          (order as any).service_name || "service"
        }) with ${PHARMACY_INFO.name}.\n\n` +
        `If you have any questions, please contact us on ${PHARMACY_INFO.tel} or reply to this email.\n\n` +
        `Kind regards,\n${PHARMACY_INFO.name}`;

      const loginUrl = getLoginUrl();

      await sendEmailApi({
        to: email,
        subject,
        template: "welcome",
        context: {
          subject,
          name: patientName || "Patient",
          email,
          loginUrl,
          supportEmail: PHARMACY_INFO.email,
          year: new Date().getFullYear(),
          message,
        },
        attachments: [file],
      } as any);

      setEmailPdfStatus(`Sent ${getPdfLabel(kind)} to ${email}.`);
    } catch (err: any) {
      console.error("Email PDF failed", err);
      setEmailPdfStatus(
        err?.message || "Unable to send email. Please try again."
      );
    } finally {
      setEmailPdfSending(false);
    }
  };

  const openEmailComposer = () => {
    if (!selectedOrder) return;

    const order = selectedOrder;
    const patientName = getDisplayPatientName(
      order,
      orderedByUser ?? undefined
    );
    const u: any = orderedByUser || {};
    const email =
      u.email || (order as any).email || (order as any).patient_email || "";

    setEmailTo(email || "");
    setEmailCc("");
    setEmailBcc("");
    setEmailSubject(
      `Your consultation documents - ${
        (order as any).service_name || "Pharmacy Express"
      }`
    );
    setEmailMessage(
      `Dear ${patientName || "Patient"},\n\n` +
        `Please find attached your documents for your recent consultation (${
          (order as any).service_name || "service"
        }) with ${PHARMACY_INFO.name}.\n\n` +
        `If anything does not look correct, or you have questions, please contact us on ${PHARMACY_INFO.tel} or reply to this email.\n\n` +
        `Kind regards,\n${PHARMACY_INFO.name}`
    );
    setEmailAttachments([]);
    setEmailPeopleError(null);
    setEmailPeopleOpen(true);
  };

  const handleAttachPdfToEmail = async (kind: PdfKind) => {
    try {
      const file = await generatePdfFile(kind);
      if (!file) return;
      setEmailAttachments((prev) => {
        const already = prev.find(
          (f) => f.name === file.name && f.size === file.size
        );
        if (already) return prev;
        return [...prev, file];
      });
      setEmailPeopleError(null);
    } catch (err: any) {
      setEmailPeopleError(
        err?.message || "Unable to attach PDF. Please try again."
      );
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setEmailAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachmentAt = (idx: number) => {
    setEmailAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  function parseEmails(raw: string): string[] {
    return raw
      .split(/[,\n; ]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  const handleSendEmailPeople = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailPeopleError(null);

    const toList = parseEmails(emailTo);

    if (!toList.length) {
      setEmailPeopleError(
        "Please enter at least one recipient in the To field."
      );
      return;
    }
    if (!emailSubject.trim()) {
      setEmailPeopleError("Please enter an email subject.");
      return;
    }

    try {
      setEmailPeopleSending(true);

      const order = selectedOrder;
      const patientName = order
        ? getDisplayPatientName(order, orderedByUser ?? undefined)
        : "";
      const friendlyName = patientName || "Customer";
      const loginUrl = getLoginUrl();

      const ccList = parseEmails(emailCc);
      const bccList = parseEmails(emailBcc);

      await sendEmailApi({
        to: toList,
        cc: ccList.length ? ccList : undefined,
        bcc: bccList.length ? bccList : undefined,
        subject: emailSubject.trim(),
        template: "welcome",
        context: {
          subject: emailSubject.trim(),
          name: friendlyName,
          email: toList.join(", "),
          loginUrl,
          supportEmail: PHARMACY_INFO.email,
          year: new Date().getFullYear(),
          message: emailMessage,
        },
        attachments: emailAttachments,
      } as any);

      setEmailPeopleSending(false);
      setEmailPeopleOpen(false);
      setEmailPdfStatus(`Email sent to ${toList.join(", ")}.`);
    } catch (err: any) {
      console.error("Email send failed", err);
      setEmailPeopleSending(false);
      setEmailPeopleError(
        err?.message || "Unable to send email. Please try again."
      );
    }
  };

  /* ---- Clinical detail render helper ---- */
  const renderClinicalSection = () => {
    if (!selectedOrder) return null;
    const riskItems = getRiskAssessmentItems(selectedOrder);

    if (activeSection === "raf") {
      if (!riskItems.length) {
        return (
          <p className="text-xs text-neutral-400">
            No Risk Assessment data captured for this order.
          </p>
        );
      }

      return (
        <ol className="space-y-3">
          {riskItems.map((it: any, idx: number) => {
            const q = String(it.question || it.key || `Question ${idx + 1}`);
            const { text, files } = normaliseRiskValue(it.value);
            const imageFiles = files.filter(rafFileLooksLikeImage);
            const otherFiles = files.filter((f) => !rafFileLooksLikeImage(f));

            return (
              <li
                key={`${it.key || idx}`}
                className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2"
              >
                <p className="text-xs font-medium text-neutral-100">
                  {idx + 1}. {q}
                </p>

                <p className="mt-1 break-words text-[11px] text-neutral-300">
                  <span className="font-semibold text-neutral-400">
                    Answer:
                  </span>{" "}
                  {text}
                </p>

                {imageFiles.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {imageFiles.map((f, i) => (
                      <a
                        key={i}
                        href={resolveImageUrl(f.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/40"
                        title={f.name || `Attachment ${i + 1}`}
                      >
                        <img
                          src={resolveImageUrl(f.url)}
                          alt={f.name || `Attachment ${i + 1}`}
                          className="h-24 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                        <div className="px-2 py-1 text-[10px] text-neutral-400">
                          {f.name || `Image ${i + 1}`}
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {otherFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {otherFiles.map((f, i) => (
                      <a
                        key={i}
                        href={resolveImageUrl(f.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-sky-400 underline underline-offset-2"
                      >
                        {f.name || `Attachment ${i + 1}`}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      );
    }

    if (activeSection === "advice") {
      const points = extractAdvicePoints(selectedOrder);

      if (!points.length) {
        return (
          <p className="text-xs text-neutral-400">
            No Pharmacist Advice has been recorded for this order.
          </p>
        );
      }

      // checklist container
      const listCls =
        "min-w-0 space-y-2 text-[11px] leading-relaxed text-neutral-200";

      // row + text wrapping fixes (handles long URLs/codes + preserves newlines)
      const rowCls = "min-w-0 flex items-start gap-2";
      const textCls =
        "min-w-0 whitespace-pre-line break-words [overflow-wrap:anywhere]";

      return (
        <div className={listCls}>
          {points.map((p, idx) => (
            <div key={`${idx}-${p.slice(0, 24)}`} className={rowCls}>
              <input
                type="checkbox"
                checked={true} // set to true if you want all visually checked
                readOnly
                tabIndex={-1}
                className="mt-[2px] h-3.5 w-3.5 rounded border border-neutral-600 bg-neutral-950 accent-emerald-500"
              />
              <div className={textCls}>{p}</div>
            </div>
          ))}
        </div>
      );
    }

    if (activeSection === "declaration") {
      const meta: any = (selectedOrder as any).meta || {};
      const declaration = meta.pharmacistDeclaration;
      if (!declaration)
        return (
          <p className="text-xs text-neutral-400">
            No Pharmacist Declaration has been recorded.
          </p>
        );

      const fields: Record<string, any> = declaration.fields || {};
      const entries = Object.entries(fields);

      return (
        <div className="space-y-3 text-[11px] text-neutral-200">
          {entries.length ? (
            <dl className="space-y-2">
              {entries.map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="w-32 shrink-0 text-neutral-400">{key}</dt>
                  <dd className="min-w-0 flex-1 break-words">
                    {formatFieldValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-neutral-400">
              No declaration fields were filled.
            </p>
          )}

          {declaration.signatureUrl && (
            <div className="rounded-md border border-neutral-800 bg-neutral-950/40 p-2">
              <p className="text-[11px] text-neutral-400">Signature:</p>
              <img
                src={resolveImageUrl(declaration.signatureUrl)}
                alt="Pharmacist signature"
                className="mt-2 h-16 w-auto rounded border border-neutral-800 bg-white"
              />
            </div>
          )}

          {declaration.saved_at && (
            <p className="text-neutral-400">
              Saved at: {formatDateTime(declaration.saved_at)}
            </p>
          )}
        </div>
      );
    }

    if (activeSection === "record") {
      const meta: any = (selectedOrder as any).meta || {};
      const record = meta.recordOfSupply;
      if (!record)
        return (
          <p className="text-xs text-neutral-400">
            No Record of Supply has been captured.
          </p>
        );

      const fields: Record<string, any> = record.fields || {};
      const entries = Object.entries(fields);

      if (!entries.length)
        return (
          <p className="text-xs text-neutral-400">
            Record of Supply fields are empty.
          </p>
        );

      return (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <div className="grid grid-cols-12 bg-neutral-900/70 px-2 py-2 text-[10px] uppercase tracking-wide text-neutral-500">
            <div className="col-span-5">Field</div>
            <div className="col-span-7">Value</div>
          </div>
          <div className="divide-y divide-neutral-800 bg-neutral-950/40">
            {entries.map(([key, value], idx) => (
              <div
                key={key}
                className={[
                  "grid grid-cols-12 px-2 py-2 text-[11px]",
                  idx % 2 === 0 ? "bg-transparent" : "bg-neutral-900/20",
                ].join(" ")}
              >
                <div className="col-span-5 pr-2 text-neutral-400">{key}</div>
                <div className="col-span-7 min-w-0 break-words text-neutral-200">
                  {formatFieldValue(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const currentPage = meta?.page ?? page;
  const pageSizeMeta =
    (meta as any)?.pageSize || (meta as any)?.limit || pageSize;
  const totalPages =
    meta?.totalPages ??
    (meta?.total && pageSizeMeta
      ? Math.max(1, Math.ceil(meta.total / pageSizeMeta))
      : currentPage);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <>
      <div className="px-4 py-4 lg:px-6 lg:py-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-white sm:text-lg">
              Orders & clinical records
            </h1>
            <p className="mt-1 text-xs text-neutral-400">
              View patient orders, generate invoices, and export clinical
              documentation PDFs.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[320px]">
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setSearch(searchDraft.trim());
                  }
                }}
                placeholder="Search (reference, name, email, etc.)"
                className="h-9 w-full rounded-md border border-neutral-800 bg-neutral-950/60 px-3 text-[12px] text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setSearch(searchDraft.trim());
              }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 text-[12px] text-neutral-100 hover:border-neutral-600"
            >
              <ArrowRight className="h-4 w-4" />
              Apply
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}
        {emailPdfStatus && (
          <div className="mb-3 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-[11px] text-neutral-100">
            {emailPdfStatus}
          </div>
        )}

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-neutral-500">
            Showing <span className="text-neutral-100">{orders.length}</span>{" "}
            orders (Completed)
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <span>
              Page <span className="text-neutral-100">{currentPage}</span> /{" "}
              <span className="text-neutral-100">{totalPages || 1}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
                className={[
                  "inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px]",
                  canPrev
                    ? "border-neutral-700 bg-neutral-900/70 text-neutral-100 hover:border-neutral-500"
                    : "cursor-not-allowed border-neutral-800 bg-neutral-900/40 text-neutral-600",
                ].join(" ")}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => canNext && setPage((p) => p + 1)}
                className={[
                  "inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px]",
                  canNext
                    ? "border-neutral-700 bg-neutral-900/70 text-neutral-100 hover:border-neutral-500"
                    : "cursor-not-allowed border-neutral-800 bg-neutral-900/40 text-neutral-600",
                ].join(" ")}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="hidden grid-cols-12 gap-2 border-b border-neutral-800 bg-neutral-900/60 px-3 py-2 text-[10px] uppercase tracking-wide text-neutral-500 sm:grid">
            <div className="col-span-3">Reference</div>
            <div className="col-span-3">Patient</div>
            <div className="col-span-2">Service</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-neutral-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-neutral-400">
              No completed orders found.
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {orders.map((o: any) => {
                const id = String(o._id || o.id || "");
                const uid = String(
                  o.user_id || o.userId || o.patient_user_id || ""
                );
                const user = uid ? orderUsers[uid] : null;

                const patientName = getDisplayPatientName(o, user || undefined);
                const reference = o.reference || id;
                const serviceName = o.service_name || "Service";
                const status = String(o.status || "—");
                const pay = String(o.payment_status || "—");
                const totalMinor = o.meta?.totalMinor ?? o.totalMinor ?? null;

                return (
                  <div key={id} className="px-3 py-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center sm:gap-2">
                      <div className="sm:col-span-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <ClipboardList className="h-4 w-4 shrink-0 text-neutral-500" />
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-neutral-100">
                              {reference}
                            </p>
                            <p className="mt-0.5 text-[11px] text-neutral-500">
                              {formatDateOnly(
                                o.completed_at ||
                                  o.completedAt ||
                                  o.createdAt ||
                                  o.created_at
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <p className="truncate text-[12px] font-medium text-neutral-100">
                          {patientName}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                          {(user as any)?.email || o.email || "—"}
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <p className="truncate text-[12px] text-neutral-200">
                          {serviceName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {o.service_slug ? String(o.service_slug) : "—"}
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                              statusBadgeClasses(status),
                            ].join(" ")}
                          >
                            {status === "completed" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : status === "pending" ? (
                              <Clock className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {status}
                          </span>

                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                              paymentBadgeClasses(pay),
                            ].join(" ")}
                          >
                            <CreditCard className="h-3 w-3" />
                            {pay}
                          </span>
                        </div>
                      </div>

                      <div className="sm:col-span-1 sm:text-right">
                        <p className="text-[12px] font-semibold text-neutral-100">
                          {formatMoney(totalMinor)}
                        </p>
                      </div>

                      <div className="sm:col-span-1 sm:text-right">
                        <button
                          type="button"
                          onClick={() => openOrderDetail(o)}
                          className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 text-[12px] text-neutral-100 hover:border-neutral-600 sm:w-auto"
                        >
                          View <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ----------------- Detail Drawer ----------------- */}
      {showDetail && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/55" onClick={closeDetail} />

          <div className="absolute right-0 top-0 h-full w-full max-w-5xl overflow-hidden border-l border-neutral-800 bg-neutral-950 shadow-2xl">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-neutral-800 bg-neutral-950/80 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-400">Order detail</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {selectedOrder?.reference ||
                      (selectedOrder as any)?._id ||
                      "—"}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-neutral-400">
                    Patient:{" "}
                    <span className="text-neutral-200">
                      {selectedOrder
                        ? getDisplayPatientName(
                            selectedOrder,
                            orderedByUser ?? undefined
                          )
                        : "—"}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeDetail}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:border-neutral-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 bg-neutral-950/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div ref={downloadRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setDownloadMenuOpen((s) => !s)}
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 text-[12px] text-neutral-100 hover:border-neutral-600"
                    >
                      <Download className="h-4 w-4" />
                      Download PDFs
                    </button>

                    {downloadMenuOpen && (
                      <div className="absolute left-0 top-[38px] z-50 w-[280px] overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl">
                        {(
                          [
                            ["full", "Full Consultation Record"],
                            // ["raf", "Risk Assessment Form (RAF)"],
                            // ["advice", "Pharmacist Advice"],
                            // ["declaration", "Pharmacist Declaration"],
                            ["record", "Record of Supply"],
                            ["invoice", "Invoice"],
                            ["private_rx", "Private Prescription"],
                            [
                              "private_rx_patient",
                              "Private Prescription (Patient Copy)",
                            ],
                            [
                              "treatment_notice",
                              "Notification of Treatment Issued",
                            ],
                          ] as [PdfKind, string][]
                        ).map(([k, label]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => {
                              setDownloadMenuOpen(false);
                              handleDownloadPdf(k);
                            }}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] text-neutral-100 hover:bg-neutral-900/60"
                          >
                            <span className="min-w-0 truncate">{label}</span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-neutral-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div ref={emailPdfRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setEmailPdfMenuOpen((s) => !s)}
                      disabled={emailPdfSending}
                      className={[
                        "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[12px]",
                        emailPdfSending
                          ? "cursor-not-allowed border-neutral-800 bg-neutral-900/40 text-neutral-500"
                          : "border-neutral-800 bg-neutral-900/60 text-neutral-100 hover:border-neutral-600",
                      ].join(" ")}
                    >
                      <Send className="h-4 w-4" />
                      Email PDF to patient
                    </button>

                    {emailPdfMenuOpen && (
                      <div className="absolute left-0 top-[38px] z-50 w-[280px] overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl">
                        {(
                          [
                            ["full", "Full Consultation Record"],
                            // ["raf", "RAF"],
                            // ["advice", "Advice"],
                            // ["declaration", "Declaration"],
                            ["record", "Record of Supply"],
                            ["invoice", "Invoice"],
                            ["private_rx", "Private Prescription"],
                            [
                              "private_rx_patient",
                              "Private Prescription (Patient Copy)",
                            ],
                            ["treatment_notice", "Treatment Notice"],
                          ] as [PdfKind, string][]
                        ).map(([k, label]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => {
                              setEmailPdfMenuOpen(false);
                              handleEmailPdf(k);
                            }}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] text-neutral-100 hover:bg-neutral-900/60"
                          >
                            <span className="min-w-0 truncate">{label}</span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-neutral-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={openEmailComposer}
                    className="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 text-[12px] text-neutral-100 hover:border-neutral-600"
                  >
                    <Mail className="h-4 w-4" />
                    Compose email
                  </button>
                </div>

                <div className="text-[11px] text-neutral-500">
                  Pharmacist:{" "}
                  <span className="text-neutral-200">
                    {pharmacistDisplayName(loggedInPharmacist)}{" "}
                    {loggedInPharmacist
                      ? `(${pharmacistGphc(loggedInPharmacist)})`
                      : ""}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto px-4 py-4">
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-sm text-neutral-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading order details…
                  </div>
                ) : detailError ? (
                  <div className="rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
                    {detailError}
                  </div>
                ) : selectedOrder ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    {/* Left main */}
                    <div className="lg:col-span-8">
                      <div className="mb-3 flex flex-wrap gap-2">
                        {(
                          [
                            ["raf", "RAF"],
                            ["advice", "Advice"],
                            ["declaration", "Declaration"],
                            ["record", "Record"],
                          ] as [DetailSection, string][]
                        ).map(([k, label]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setActiveSection(k)}
                            className={[
                              "inline-flex h-8 items-center rounded-md border px-3 text-[12px]",
                              activeSection === k
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                : "border-neutral-800 bg-neutral-900/50 text-neutral-200 hover:border-neutral-600",
                            ].join(" ")}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Active section content (RAF / Advice / Declaration / Record) */}
                      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                        {renderClinicalSection()}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="lg:col-span-4 space-y-4">
                      <PatientProfileCard user={orderedByUser} />
                      <OrderItemsListCard order={selectedOrder} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- Email Composer (Compose email) ----------------- */}
      {emailPeopleOpen && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              if (!emailPeopleSending) {
                setEmailPeopleOpen(false);
                setEmailPeopleError(null);
              }
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-neutral-800 bg-neutral-950/80 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-400">Compose email</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {selectedOrder?.reference ||
                      (selectedOrder as any)?._id ||
                      "—"}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-neutral-400">
                    Patient:{" "}
                    <span className="text-neutral-200">
                      {selectedOrder
                        ? getDisplayPatientName(
                            selectedOrder,
                            orderedByUser ?? undefined
                          )
                        : "—"}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={emailPeopleSending}
                  onClick={() => {
                    setEmailPeopleOpen(false);
                    setEmailPeopleError(null);
                  }}
                  className={[
                    "inline-flex h-8 w-8 items-center justify-center rounded-md border text-neutral-200",
                    emailPeopleSending
                      ? "cursor-not-allowed border-neutral-800 bg-neutral-900/40 text-neutral-600"
                      : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-600",
                  ].join(" ")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSendEmailPeople} className="px-4 py-4">
                {emailPeopleError && (
                  <div className="mb-3 rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
                    {emailPeopleError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] text-neutral-400">
                      To
                    </label>
                    <input
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="patient@example.com"
                      className="h-9 w-full rounded-md border border-neutral-800 bg-neutral-950/60 px-3 text-[12px] text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] text-neutral-400">
                      CC
                    </label>
                    <input
                      value={emailCc}
                      onChange={(e) => setEmailCc(e.target.value)}
                      placeholder="cc@example.com"
                      className="h-9 w-full rounded-md border border-neutral-800 bg-neutral-950/60 px-3 text-[12px] text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] text-neutral-400">
                      BCC
                    </label>
                    <input
                      value={emailBcc}
                      onChange={(e) => setEmailBcc(e.target.value)}
                      placeholder="bcc@example.com"
                      className="h-9 w-full rounded-md border border-neutral-800 bg-neutral-950/60 px-3 text-[12px] text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] text-neutral-400">
                      Subject
                    </label>
                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="h-9 w-full rounded-md border border-neutral-800 bg-neutral-950/60 px-3 text-[12px] text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] text-neutral-400">
                      Message
                    </label>
                    <textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={7}
                      className="w-full resize-none rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-[12px] leading-relaxed text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Attachments */}
                <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-neutral-200">
                      Attachments
                    </p>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-[11px] text-neutral-100 hover:border-neutral-600">
                      <span>Add files</span>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        onChange={handleFileInput}
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["full", "Full Consultation Record"],
                        ["raf", "RAF"],
                        ["advice", "Advice"],
                        ["declaration", "Declaration"],
                        ["record", "Record of Supply"],
                        ["invoice", "Invoice"],
                        ["private_rx", "Private Prescription"],
                        [
                          "private_rx_patient",
                          "Private Prescription (Patient Copy)",
                        ],
                        ["treatment_notice", "Treatment Notice"],
                      ] as [PdfKind, string][]
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleAttachPdfToEmail(k)}
                        className="inline-flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-left text-[11px] text-neutral-100 hover:border-neutral-600"
                      >
                        <span className="min-w-0 truncate">{label}</span>
                        <Download className="h-4 w-4 shrink-0 text-neutral-500" />
                      </button>
                    ))}
                  </div>

                  <div className="mt-3">
                    {emailAttachments.length === 0 ? (
                      <p className="text-[11px] text-neutral-500">
                        No attachments selected.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {emailAttachments.map((f, idx) => (
                          <div
                            key={`${f.name}-${f.size}-${idx}`}
                            className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/40 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[11px] text-neutral-100">
                                {f.name}
                              </p>
                              <p className="text-[10px] text-neutral-500">
                                {Math.max(1, Math.round(f.size / 1024))} KB
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeAttachmentAt(idx)}
                              className="inline-flex h-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900/60 px-2 text-[11px] text-neutral-200 hover:border-neutral-600"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-800 pt-4">
                  <button
                    type="button"
                    disabled={emailPeopleSending}
                    onClick={() => {
                      setEmailPeopleOpen(false);
                      setEmailPeopleError(null);
                    }}
                    className={[
                      "inline-flex h-9 items-center justify-center rounded-md border px-4 text-[12px]",
                      emailPeopleSending
                        ? "cursor-not-allowed border-neutral-800 bg-neutral-900/40 text-neutral-600"
                        : "border-neutral-800 bg-neutral-900/60 text-neutral-100 hover:border-neutral-600",
                    ].join(" ")}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={emailPeopleSending}
                    className={[
                      "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-4 text-[12px]",
                      emailPeopleSending
                        ? "cursor-not-allowed border-emerald-500/20 bg-emerald-500/10 text-emerald-200/60"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/70",
                    ].join(" ")}
                  >
                    {emailPeopleSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send email
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
