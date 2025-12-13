"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  updateOrderStatusApi,
  getUserByIdApi,
  getBackendBase,
  sendEmailApi,
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
  Printer,
  Download,
  Send,
} from "lucide-react";
import jsPDF from "jspdf";

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
function getLoginUrl() {
  if (typeof window === "undefined") {
    // Fallback if needed during SSR – adjust to your real URL
    return "https://pharmacy-express.co.uk/account";
  }
  // Adjust path if your login/account route is different
  return `${window.location.origin}/account`;
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

  // 1) Explicit patient_name on order or meta
  if (anyOrder.patient_name) return anyOrder.patient_name;
  if (meta.patient_name) return meta.patient_name;

  // 2) Patient object inside meta (common for clinic services)
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

  // 3) First/last name directly on order
  const fromOrder = `${anyOrder.first_name || ""} ${
    anyOrder.last_name || ""
  }`.trim();
  if (fromOrder) return fromOrder;

  // 4) Fallback to linked user
  if (user) {
    const u: any = user;
    const fromUser =
      u.name ||
      u.fullName ||
      `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
      u.email;
    if (fromUser) return fromUser;
  }

  // 5) Hard fallback
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
type RecordOfSupplyValues = {
  dateProvided: string;
  itemA: string;
  itemVariationA: string;
  quantityA: string;
};

/**
 * Extracts "clinical notes" / record-of-supply data for:
 * Date provided, Item A, Item variation A, Quantity A
 * Used by both Record of Supply PDF and Private Prescription PDF.
 */
function getRecordOfSupplyValues(order: OrderDto): RecordOfSupplyValues {
  const meta: any = order.meta || {};

  const record =
    meta.recordOfSupply ||
    meta.record_of_supply ||
    meta.recordOfSupplyDoc ||
    null;

  let fieldMap: Record<string, any> = {};

  // If your record-of-supply is stored as { fields: { label: value } }
  if (record && record.fields && typeof record.fields === "object") {
    fieldMap = { ...(record.fields as Record<string, any>) };
  }

  // Sometimes it's an array of {label, value}
  if (Array.isArray(record?.fields)) {
    for (const row of record.fields as any[]) {
      const label =
        row?.label || row?.name || row?.fieldLabel || row?.key || "";
      if (!label) continue;
      fieldMap[label] = row?.value ?? row?.answer ?? row?.data ?? "";
    }
  }

  // --- Values from record of supply / clinical notes ---
  const rawDateProvided =
    fieldMap["Date provided"] ??
    fieldMap["Date Provided"] ??
    fieldMap["Date provided A"] ??
    fieldMap["Date provided (A)"];

  const rawItemA =
    fieldMap["Item A"] ??
    fieldMap["Item a"] ??
    fieldMap["Item name A"] ??
    fieldMap["Item name"] ??
    fieldMap["Medicine A"];

  const rawItemVariationA =
    fieldMap["Item variation A"] ??
    fieldMap["Item Variation A"] ??
    fieldMap["Strength A"] ??
    fieldMap["Dose A"];

  const rawQuantityA =
    fieldMap["Quantity A"] ??
    fieldMap["Quantity a"] ??
    fieldMap["Quantity"] ??
    fieldMap["Qty A"];

  // --- Fallbacks if ROS not present yet: use meta.items / selectedProduct ---
  const firstItem =
    Array.isArray(meta.items) && meta.items.length > 0 ? meta.items[0] : null;

  const selected = meta.selectedProduct || firstItem || {};

  const dateFromOrder =
    (order as any).completed_at ||
    (order as any).completedAt ||
    (order as any).createdAt ||
    (order as any).created_at ||
    order.start_at ||
    order.meta?.appointment_start_at ||
    new Date().toISOString();

  const dateProvided = formatDateOnly(
    rawDateProvided || record?.saved_at || record?.created_at || dateFromOrder
  );

  const itemA =
    String(rawItemA || selected.name || (firstItem && firstItem.name) || "") ||
    "—";

  const itemVariationA =
    String(
      rawItemVariationA ||
        selected.strength ||
        (firstItem && firstItem.strength) ||
        ""
    ) || "—";

  const quantityA =
    String(
      rawQuantityA ?? selected.qty ?? (firstItem && firstItem.qty) ?? ""
    ) || "—";

  return {
    dateProvided,
    itemA,
    itemVariationA,
    quantityA,
  };
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

function normaliseRafAnswer(qa: any): { text: string; files: RafFileRef[] } {
  const files: RafFileRef[] = [];
  const textParts: string[] = [];

  function collect(value: any) {
    if (value == null) return;

    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }

    const t = typeof value;

    if (t === "string" || t === "number" || t === "boolean") {
      const s = String(value);
      if (s && s !== "[object Object]") textParts.push(s);
      return;
    }

    if (t === "object") {
      const v: any = value;

      // Treat this as a file object if it has a URL-ish property
      const url: string | undefined = v.url || v.href || v.path;
      const name: string | undefined =
        v.name || v.filename || (url ? url.split("/").pop() : undefined);
      const mimeType: string | undefined = v.type || v.mimetype || v.mimeType;

      if (url) {
        files.push({ url, name, mimeType });
      }
      // Do NOT stringify generic objects → avoids [object Object]
    }
  }

  collect(qa.raw);
  collect(qa.answer);

  let text = textParts.join(", ").trim();

  if (!text && files.length) {
    const names = files
      .map((f) => f.name || f.url)
      .filter(Boolean)
      .join(", ");
    text =
      files.length === 1
        ? `Attached file: ${names}`
        : `Attached file(s): ${names}`;
  }

  if (!text) text = "—";

  return { text, files };
}

function formatFieldValue(value: any): string {
  if (value == null) return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  // Avoid [object Object] for unexpected objects
  return "—";
}

function resolveImageUrl(imagePath?: string | null): string {
  if (!imagePath) return "";

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;

  const baseWithApi = getBackendBase();
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");

  return `${cleanBase}${normalizedPath}`;
}

/* ----------------- PDF Helpers ----------------- */

type PdfCursor = { y: number };
type PdfExportMode = "download" | "file";

// Layout
const MARGIN_X = 18;
const TOP_CONTENT_Y = 48;

// Brand colours / tokens (approx Tailwind green + slate)
const PDF_BRAND_GREEN = { r: 34, g: 197, b: 94 };
const PDF_TEXT_DARK = { r: 31, g: 41, b: 55 };
const PDF_TEXT_MUTED = { r: 100, g: 116, b: 139 };
const PDF_BORDER = { r: 209, g: 213, b: 219 };
const PDF_CARD_BG = { r: 248, g: 250, b: 252 };

// Optional logo for the header (can be overridden via env)
const PDF_LOGO_SRC =
  process.env.NEXT_PUBLIC_PDF_LOGO_URL || "/images/pharmacy-express-logo.png";

let cachedPdfLogoDataUrl: string | null | undefined;

/**
 * Load the Pharmacy Express logo once and cache it as a data URL.
 * Safe no-op on the server.
 */
async function getPdfLogoDataUrl(): Promise<string | null> {
  if (cachedPdfLogoDataUrl !== undefined) return cachedPdfLogoDataUrl;

  if (!PDF_LOGO_SRC) {
    cachedPdfLogoDataUrl = null;
    return null;
  }

  if (typeof window === "undefined" || typeof FileReader === "undefined") {
    cachedPdfLogoDataUrl = null;
    return null;
  }

  try {
    let url = PDF_LOGO_SRC;
    if (url.startsWith("/")) {
      url = `${window.location.origin}${url}`;
    }
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("Logo fetch failed");

    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Logo read failed"));
      reader.readAsDataURL(blob);
    });

    cachedPdfLogoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    cachedPdfLogoDataUrl = null;
    return null;
  }
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
    297 // A4
  );
}

/** Light diagonal watermark, e.g. DO NOT DISPENSE */
function drawDiagonalWatermark(doc: jsPDF, text: string) {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;

  (doc as any).setFont("helvetica", "bold");
  doc.setFontSize(52);
  // very light grey
  doc.setTextColor(226, 232, 240);

  (doc as any).text(text, centerX, centerY, {
    align: "center",
    angle: 45,
  });
}

/** Simple 2-column table used for Medicine Prescribed */
function drawTwoColumnTable(
  doc: jsPDF,
  startX: number,
  startY: number,
  tableWidth: number,
  rows: { label: string; value: string }[],
  rowHeight: number = 8
) {
  const col1Width = tableWidth * 0.35;
  const totalHeight = rows.length * rowHeight;

  // outer border
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.rect(startX, startY, tableWidth, totalHeight);

  // horizontal lines
  for (let i = 1; i < rows.length; i++) {
    const y = startY + i * rowHeight;
    doc.line(startX, y, startX + tableWidth, y);
  }

  // vertical separator
  doc.line(
    startX + col1Width,
    startY,
    startX + col1Width,
    startY + totalHeight
  );

  doc.setFontSize(9);

  rows.forEach((row, index) => {
    const textY = startY + index * rowHeight + 5;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(row.label, startX + 2, textY);

    doc.setFont("helvetica", "normal");
    const value = row.value || "—";
    doc.text(value, startX + col1Width + 2, textY);
  });

  return startY + totalHeight;
}

function ensureSpace(doc: jsPDF, cursor: PdfCursor, extra = 6) {
  const pageHeight =
    (doc.internal as any).pageSize?.getHeight?.() ??
    (doc.internal as any).pageSize?.height ??
    297; // A4 height in mm
  const bottomMargin = 18;
  if (cursor.y + extra > pageHeight - bottomMargin) {
    doc.addPage();
    cursor.y = TOP_CONTENT_Y;
  }
}

/**
 * Standard Pharmacy Express header for all PDFs:
 * - Logo + "Pharmacy Express" brand
 * - Big green title (INVOICE, RECORD OF SUPPLY, etc.)
 * - Optional subtitle (reference, dates, VAT, etc.)
 */
function createPdfBaseDoc(
  title: string,
  subtitle?: string,
  logoDataUrl?: string | null
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = getPageWidth(doc);
  const headerY = 18;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 297, "F");

  // Logo (optional)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN_X, headerY - 6, 26, 12);
    } catch {
      // ignore logo failure, continue with text
    }
  }

  // Brand name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
  doc.text(PHARMACY_INFO.name, MARGIN_X + 32, headerY - 2);

  // Document title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(title.toUpperCase(), MARGIN_X, headerY + 8);

  // Subtitle (e.g. reference / date / VAT line)
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
    doc.text(subtitle, MARGIN_X, headerY + 14);
  }

  // Green divider
  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, headerY + 18, pageWidth - MARGIN_X, headerY + 18);

  // Default body style
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

  return doc;
}

/**
 * Section title (e.g. "Invoice Details", "Clinical Notes") with green underline.
 */
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

/**
 * Generic "card" like the ones in the examples:
 * used for "Pharmacy Details" / "Patient Information" / "From" / "Bill To".
 *
 * Returns the bottom Y coordinate of the card.
 */
function drawInfoCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: { label: string; value: string }[]
): number {
  const labelWidth = 22;
  const contentWidth = width - labelWidth - 10;
  const lineHeight = 4;

  // Pre-measure to determine height
  const prepared = rows.map((row) => {
    const value = row.value || "—";
    const lines = doc.splitTextToSize(value, contentWidth);
    const height = Math.max(1, lines.length) * lineHeight;
    return { ...row, lines, height };
  });

  let innerHeight = 0;
  prepared.forEach((r) => {
    innerHeight += r.height + 1;
  });

  const cardHeight = 10 + innerHeight + 6;

  // Card background + border
  doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
  doc.setFillColor(PDF_CARD_BG.r, PDF_CARD_BG.g, PDF_CARD_BG.b);
  doc.roundedRect(x, y, width, cardHeight, 2, 2, "FD");

  let cy = y + 7;

  // Card title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(title, x + 4, cy);

  cy += 2.5;
  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.3);
  doc.line(x + 4, cy + 1, x + width - 4, cy + 1);
  cy += 4;

  // Rows
  prepared.forEach((row) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text(row.label, x + 4, cy);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

    row.lines.forEach((line: string, idx: number) => {
      const ly = cy + idx * lineHeight;
      doc.text(line, x + 4 + labelWidth, ly);
    });

    cy += row.height + 2;
  });

  return y + cardHeight;
}

/**
 * Two-column Patient / Order summary used for the clinical PDFs (RAF, Advice,
 * Declaration, Full bundle).
 */
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

  // Left column: Patient
  doc.setFontSize(9);
  doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
  doc.setFont("helvetica", "bold");
  doc.text("PATIENT DETAILS", leftX, leftCursor.y);
  leftCursor.y += 5;

  doc.setFont("helvetica", "normal");
  writeLabelValueRow(doc, leftCursor, "Name", patientName, leftX);
  if (dob) writeLabelValueRow(doc, leftCursor, "Date of birth", dob, leftX);
  if (gender) writeLabelValueRow(doc, leftCursor, "Gender", gender, leftX);
  if (addrParts.length) {
    writeLabelValueRow(doc, leftCursor, "Address", addrParts.join(", "), leftX);
  }

  // Right column: Order
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
    order.reference || order._id,
    rightX
  );
  writeLabelValueRow(
    doc,
    rightCursor,
    "Service",
    `${order.service_name} (${order.service_slug || "N/A"})`,
    rightX
  );

  const appointmentAt =
    order.meta?.appointment_start_at || (order as any).start_at || null;
  if (appointmentAt) {
    writeLabelValueRow(
      doc,
      rightCursor,
      "Appointment",
      formatDateTime(appointmentAt),
      rightX
    );
  }

  if (order.status || order.payment_status) {
    writeLabelValueRow(
      doc,
      rightCursor,
      "Status",
      `${order.status?.toUpperCase()} / ${
        order.payment_status?.toUpperCase() || "N/A"
      }`,
      rightX
    );
  }

  const blockBottom = Math.max(leftCursor.y, rightCursor.y);
  cursor.y = blockBottom + 6;
}

function writeLabelValueRow(
  doc: jsPDF,
  cursor: PdfCursor,
  label: string,
  value: string,
  x: number
) {
  ensureSpace(doc, cursor, 7);
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
  doc.text(label.toUpperCase(), x, cursor.y);
  cursor.y += 3.5;

  doc.setFontSize(10);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

  const lines = doc.splitTextToSize(value || "—", 80);
  lines.forEach((line: string) => {
    ensureSpace(doc, cursor);
    doc.text(line, x, cursor.y);
    cursor.y += 4.2;
  });
}

/* ----- RAF answer helpers (avoid [object Object], handle files) ----- */

function rafFileLooksLikeImage(file: RafFileRef): boolean {
  const mt = (file.mimeType || "").toLowerCase();
  if (mt && mt.startsWith("image/")) return true;

  const url = file.url || "";
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(url);
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const full = resolveImageUrl(url);
    if (!full) return null;

    if (full.startsWith("data:image")) return full;

    const res = await fetch(full, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/* ----- RAF section ----- */

async function writeRafSection(doc: jsPDF, cursor: PdfCursor, order: OrderDto) {
  const meta: any = order.meta || {};
  const raf = meta.formsQA?.raf;
  const hasRaf = !!raf?.qa?.length;

  writeSectionTitle(doc, cursor, "Risk Assessment Form (RAF)");

  if (!hasRaf) {
    ensureSpace(doc, cursor);
    doc.text("No RAF data captured for this order.", MARGIN_X, cursor.y);
    cursor.y += 6;
    return;
  }

  doc.setFontSize(10);

  for (let idx = 0; idx < raf.qa.length; idx++) {
    const qa = raf.qa[idx];
    const q = qa.question || qa.key || `Question ${idx + 1}`;
    const { text: ans, files } = normaliseRafAnswer(qa);

    // Question
    doc.setFont("helvetica", "bold");
    const qLines = doc.splitTextToSize(
      `${idx + 1}. ${q}`,
      getPageWidth(doc) - 2 * MARGIN_X
    );
    qLines.forEach((line: string) => {
      ensureSpace(doc, cursor);
      doc.text(line, MARGIN_X, cursor.y);
      cursor.y += 4.5;
    });

    // Answer text
    doc.setFont("helvetica", "normal");
    const aLines = doc.splitTextToSize(
      `Answer: ${ans}`,
      getPageWidth(doc) - 2 * MARGIN_X - 4
    );
    aLines.forEach((line: string) => {
      ensureSpace(doc, cursor);
      doc.text(line, MARGIN_X + 4, cursor.y);
      cursor.y += 4.2;
    });

    // Inline images (e.g. vaccination record)
    const imageFiles = files.filter(rafFileLooksLikeImage);
    for (const file of imageFiles) {
      const dataUrl = await fetchImageDataUrl(file.url);
      if (!dataUrl) continue;

      const maxWidth = getPageWidth(doc) - 2 * MARGIN_X;
      const imgWidth = Math.min(80, maxWidth);
      const imgHeight = imgWidth * 0.75;

      ensureSpace(doc, cursor, imgHeight + 6);
      try {
        doc.addImage(dataUrl, "PNG", MARGIN_X, cursor.y, imgWidth, imgHeight);
        cursor.y += imgHeight + 4;
      } catch {
        // ignore bad image
      }
    }

    cursor.y += 3;
  }
}

/* ----- Advice section ----- */

function extractAdviceTexts(order: OrderDto): string[] {
  const meta: any = order.meta || {};
  const advice = meta.pharmacistAdvice;
  const adviceState: Record<string, string[]> = advice?.adviceState || {};
  return Object.values(adviceState)
    .flatMap((arr) => arr || [])
    .filter((s) => !!s && String(s).trim().length > 0)
    .map((s) => String(s));
}

function writeAdviceSection(doc: jsPDF, cursor: PdfCursor, order: OrderDto) {
  const adviceTexts = extractAdviceTexts(order);
  const hasAdvice = adviceTexts.length > 0;

  writeSectionTitle(doc, cursor, "Pharmacist Advice");

  if (!hasAdvice) {
    ensureSpace(doc, cursor);
    doc.text(
      "No Pharmacist Advice has been recorded for this order.",
      MARGIN_X,
      cursor.y
    );
    cursor.y += 6;
    return;
  }

  const intro = doc.splitTextToSize(
    "The following advice text snippets were selected during the consultation:",
    getPageWidth(doc) - 2 * MARGIN_X
  );
  intro.forEach((line: string) => {
    ensureSpace(doc, cursor);
    doc.text(line, MARGIN_X, cursor.y);
    cursor.y += 4.2;
  });
  cursor.y += 2;

  adviceTexts.forEach((txt, idx) => {
    const bullet = `• ${txt}`;
    const lines = doc.splitTextToSize(bullet, getPageWidth(doc) - 2 * MARGIN_X);
    lines.forEach((line: string) => {
      ensureSpace(doc, cursor);
      doc.text(line, MARGIN_X, cursor.y);
      cursor.y += 4.2;
    });
    cursor.y += 1;
  });
}

/* ----- Signature loader ----- */

async function getSignatureDataUrl(order: OrderDto): Promise<string | null> {
  try {
    const meta: any = order.meta || {};
    const declaration = meta.pharmacistDeclaration;
    const url: string | undefined = declaration?.signatureUrl;
    if (!url) return null;
    return fetchImageDataUrl(url);
  } catch {
    return null;
  }
}

/* ----- Declaration section ----- */

function writeDeclarationSection(
  doc: jsPDF,
  cursor: PdfCursor,
  order: OrderDto,
  signatureDataUrl?: string | null
) {
  const meta: any = order.meta || {};
  const declaration = meta.pharmacistDeclaration;
  const hasDeclaration = !!declaration;

  writeSectionTitle(doc, cursor, "Pharmacist Declaration");

  if (!hasDeclaration) {
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

  // Signature image
  if (signatureDataUrl) {
    ensureSpace(doc, cursor, 30);
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
    doc.text("Pharmacist signature", MARGIN_X, cursor.y);
    cursor.y += 4;

    try {
      const imgWidth = 40;
      const imgHeight = 18;
      doc.addImage(
        signatureDataUrl,
        "PNG",
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

/* ----- Record of supply (clinical bundle simple dump) ----- */

function writeRecordSection(doc: jsPDF, cursor: PdfCursor, order: OrderDto) {
  const meta: any = order.meta || {};
  const record = meta.recordOfSupply;
  const hasRecord = !!record;

  writeSectionTitle(doc, cursor, "Record of Supply");

  if (!hasRecord) {
    ensureSpace(doc, cursor);
    doc.text("No Record of Supply has been captured.", MARGIN_X, cursor.y);
    cursor.y += 6;
    return;
  }

  const fields: Record<string, string> = record.fields || {};
  const entries = Object.entries(fields);

  if (!entries.length) {
    ensureSpace(doc, cursor);
    doc.text("Record of Supply fields are empty.", MARGIN_X, cursor.y);
    cursor.y += 6;
    return;
  }

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
        doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
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

/* Small helper to finalise a PDF */
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

/* ----- Invoice PDF (styled like screenshot) ----- */

async function exportInvoicePdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
): Promise<File | void> {
  const invoiceNo = `#INV-${order.reference || order._id}`;
  const invoiceDate = formatDateOnly(
    (order as any).completed_at ||
      (order as any).completedAt ||
      (order as any).createdAt ||
      (order as any).created_at ||
      new Date().toISOString()
  );

  const subtitle = `Invoice No: ${invoiceNo}  |  VAT No: ${PHARMACY_INFO.vatNo}  |  Date: ${invoiceDate}`;
  const logoDataUrl = await getPdfLogoDataUrl();
  const doc = createPdfBaseDoc("Invoice", subtitle, logoDataUrl);
  const pageWidth = getPageWidth(doc);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  // Patient info
  const patientName = getDisplayPatientName(order, user || undefined);
  const u: any = user || {};
  const dobLabel = u.dob ? formatDateOnly(u.dob) : null;

  const addrParts = [
    u.address_line1 || u.addressLine1 || u.address_line_1 || u.address1,
    u.address_line2 || u.addressLine2 || u.address_line_2 || u.address2,
    u.city,
    u.county,
    u.postalcode || u.postcode,
    u.country,
  ].filter(Boolean);
  const patientAddress = addrParts.join(", ");

  const email = u.email || (order as any).email || "";
  const phone = u.phone || u.phoneNumber || (order as any).phone || "";
  const contactParts: string[] = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  const contact = contactParts.join(" | ");

  // Two cards (From / Bill To)
  const cardGap = 6;
  const cardWidth = (pageWidth - 2 * MARGIN_X - cardGap) / 2;

  const leftBottom = drawInfoCard(doc, MARGIN_X, cursor.y, cardWidth, "From", [
    { label: "Name:", value: PHARMACY_INFO.name },
    {
      label: "Address:",
      value: PHARMACY_INFO.addressLines.join(", "),
    },
    { label: "Tel:", value: PHARMACY_INFO.tel },
    { label: "Email:", value: PHARMACY_INFO.email },
  ]);

  const rightBottom = drawInfoCard(
    doc,
    MARGIN_X + cardWidth + cardGap,
    cursor.y,
    cardWidth,
    "Bill To",
    [
      { label: "Patient:", value: patientName },
      { label: "DOB:", value: dobLabel || "—" },
      { label: "Address:", value: patientAddress || "—" },
      { label: "Contact:", value: contact || "—" },
    ]
  );

  cursor.y = Math.max(leftBottom, rightBottom) + 10;

  /* ---- Invoice Details ---- */
  writeSectionTitle(doc, cursor, "Invoice Details");

  const items = (order.meta?.items || []) as any[];

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

    // Header row
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

    // Rows
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

  // Total incl. VAT
  cursor.y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const total = order.meta?.totalMinor ?? null;
  const totalText = `Total incl. VAT ${formatMoney(total)}`;
  ensureSpace(doc, cursor);
  doc.text(totalText, MARGIN_X, cursor.y);
  cursor.y += 8;

  /* ---- Payment Information ---- */
  writeSectionTitle(doc, cursor, "Payment Information");

  const paymentStatus = (order.payment_status || "").toUpperCase() || "N/A";

  const paidAtSource =
    (order as any).paid_at ||
    (order.meta as any)?.paid_at ||
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

  const filename = `Invoice_${order.reference || order._id}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----- RAF PDF ----- */

async function exportRafPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
): Promise<File | void> {
  const reference = order.reference || order._id;
  const serviceName = order.service_name || "Service";
  const meta: any = order.meta || {};
  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const logoDataUrl = await getPdfLogoDataUrl();
  const doc = createPdfBaseDoc("Risk Assessment Form", subtitle, logoDataUrl);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);
  await writeRafSection(doc, cursor, order);

  const filename = `RAF_${order.reference || order._id}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----- Advice PDF ----- */

async function exportAdvicePdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
): Promise<File | void> {
  const reference = order.reference || order._id;
  const serviceName = order.service_name || "Service";
  const meta: any = order.meta || {};
  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const logoDataUrl = await getPdfLogoDataUrl();
  const doc = createPdfBaseDoc("Pharmacist Advice", subtitle, logoDataUrl);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);
  writeAdviceSection(doc, cursor, order);

  const filename = `Advice_${order.reference || order._id}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----- Declaration PDF ----- */

async function exportDeclarationPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
): Promise<File | void> {
  const reference = order.reference || order._id;
  const serviceName = order.service_name || "Service";
  const meta: any = order.meta || {};
  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const logoDataUrl = await getPdfLogoDataUrl();
  const signatureDataUrl = await getSignatureDataUrl(order);

  const doc = createPdfBaseDoc("Pharmacist Declaration", subtitle, logoDataUrl);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);
  writeDeclarationSection(doc, cursor, order, signatureDataUrl);

  const filename = `Declaration_${order.reference || order._id}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----- Record of Supply PDF (styled like screenshot) ----- */

async function exportRecordPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
): Promise<File | void> {
  const reference = order.reference || order._id;
  const meta: any = order.meta || {};
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
  const logoDataUrl = await getPdfLogoDataUrl();
  const doc = createPdfBaseDoc("Record of Supply", subtitle, logoDataUrl);
  const pageWidth = getPageWidth(doc);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  // Patient info reused from invoice
  const patientName = getDisplayPatientName(order, user || undefined);
  const u: any = user || {};
  const dobLabel = u.dob ? formatDateOnly(u.dob) : null;

  const addrParts = [
    u.address_line1 || u.addressLine1 || u.address_line_1 || u.address1,
    u.address_line2 || u.addressLine2 || u.address_line_2 || u.address2,
    u.city,
    u.county,
    u.postalcode || u.postcode,
    u.country,
  ].filter(Boolean);
  const patientAddress = addrParts.join(", ");

  const email = u.email || (order as any).email || "";
  const phone = u.phone || u.phoneNumber || (order as any).phone || "";
  const contactParts: string[] = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  const contact = contactParts.join(" | ");

  // Cards: Pharmacy Details / Patient Information
  const cardGap = 6;
  const cardWidth = (pageWidth - 2 * MARGIN_X - cardGap) / 2;

  const leftBottom = drawInfoCard(
    doc,
    MARGIN_X,
    cursor.y,
    cardWidth,
    "Pharmacy Details",
    [
      { label: "Name:", value: PHARMACY_INFO.name },
      {
        label: "Address:",
        value: PHARMACY_INFO.addressLines.join(", "),
      },
      { label: "Tel:", value: PHARMACY_INFO.tel },
      { label: "Email:", value: PHARMACY_INFO.email },
    ]
  );

  const rightBottom = drawInfoCard(
    doc,
    MARGIN_X + cardWidth + cardGap,
    cursor.y,
    cardWidth,
    "Patient Information",
    [
      { label: "Name:", value: patientName },
      { label: "DOB:", value: dobLabel || "—" },
      { label: "Address:", value: patientAddress || "—" },
      { label: "Contact:", value: contact || "—" },
    ]
  );

  cursor.y = Math.max(leftBottom, rightBottom) + 10;

  /* ---- Clinical Notes ---- */
  writeSectionTitle(doc, cursor, "Clinical Notes");

  ensureSpace(doc, cursor);
  doc.text(`Date provided ${recordDateStr}`, MARGIN_X, cursor.y);
  cursor.y += 5;

  const items = (order.meta?.items || []) as any[];
  if (!items.length) {
    ensureSpace(doc, cursor);
    doc.text("No item details available for this order.", MARGIN_X, cursor.y);
    cursor.y += 6;
  } else {
    items.forEach((it, idx) => {
      const letter = String.fromCharCode(65 + idx); // A, B, C...
      const name = it.name || "Item";
      const variation = it.variation || it.variations || it.strength || "";
      const qty = it.qty ?? 1;

      ensureSpace(doc, cursor);
      doc.text(`Item ${letter} ${name}`, MARGIN_X, cursor.y);
      cursor.y += 4;

      if (variation) {
        ensureSpace(doc, cursor);
        doc.text(`Item variation ${letter} ${variation}`, MARGIN_X, cursor.y);
        cursor.y += 4;
      }

      ensureSpace(doc, cursor);
      doc.text(`Quantity ${letter} ${qty}`, MARGIN_X, cursor.y);
      cursor.y += 5;
    });
  }

  /* ---- Pharmacist Declaration ---- */
  writeSectionTitle(doc, cursor, "Pharmacist Declaration");

  const declaration = meta.pharmacistDeclaration;
  const longText =
    "I confirm that the above named patient has been clinically assessed and supplied medication in accordance with the service protocol. The supply is appropriate, counselling has been provided, and relevant records have been completed.";
  const paraLines = doc.splitTextToSize(longText, pageWidth - 2 * MARGIN_X);
  paraLines.forEach((line: string) => {
    ensureSpace(doc, cursor);
    doc.text(line, MARGIN_X, cursor.y);
    cursor.y += 4;
  });
  cursor.y += 2;

  const declarationFields: Record<string, any> =
    (declaration?.fields as any) || {};
  if (Object.keys(declarationFields).length) {
    Object.entries(declarationFields).forEach(([key, value]) => {
      const line = `${key}: ${value || "—"}`;
      const lines = doc.splitTextToSize(line, pageWidth - 2 * MARGIN_X);
      lines.forEach((l: string) => {
        ensureSpace(doc, cursor);
        doc.text(l, MARGIN_X, cursor.y);
        cursor.y += 4;
      });
    });
  }

  // Signature
  const signatureDataUrl = await getSignatureDataUrl(order);
  if (signatureDataUrl) {
    ensureSpace(doc, cursor, 24);
    doc.text("Signature:", MARGIN_X, cursor.y);
    cursor.y += 4;
    try {
      doc.addImage(signatureDataUrl, "PNG", MARGIN_X, cursor.y, 40, 18);
      cursor.y += 22;
    } catch {
      cursor.y += 12;
    }
  } else {
    ensureSpace(doc, cursor, 14);
    doc.text("Signature:", MARGIN_X, cursor.y);
    cursor.y += 12;
  }

  const declDate =
    declaration?.saved_at ||
    recordFields["Date"] ||
    recordFields["Date provided"];
  if (declDate) {
    ensureSpace(doc, cursor);
    doc.text(`Date: ${formatDateOnly(declDate)}`, MARGIN_X, cursor.y);
    cursor.y += 5;
  }

  const filename = `RecordOfSupply_${order.reference || order._id}.pdf`;
  return finalisePdf(doc, filename, mode);
}

async function exportPrivatePrescriptionPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
): Promise<File | void> {
  const signatureDataUrl = await getSignatureDataUrl(order);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = getPageWidth(doc);
  const marginX = MARGIN_X;

  const meta: any = order.meta || {};

  // ------------ Record of Supply / Clinical Notes ------------
  const record =
    meta.recordOfSupply ||
    meta.record_of_supply ||
    meta.recordOfSupplyDoc ||
    null;

  let recordFields: Record<string, any> = {};

  if (record && record.fields) {
    if (Array.isArray(record.fields)) {
      // fields stored as an array of { label, value }
      for (const f of record.fields as any[]) {
        const label =
          f?.label || f?.name || f?.fieldLabel || f?.key || f?.id || "";
        if (!label) continue;
        recordFields[label] = f?.value ?? f?.answer ?? f?.data ?? "";
      }
    } else if (typeof record.fields === "object") {
      // fields already stored as an object
      recordFields = { ...(record.fields as Record<string, any>) };
    }
  }

  // First medicine item (fallback if ROS is missing)
  const firstItem =
    Array.isArray(meta.items) && meta.items.length > 0 ? meta.items[0] : null;
  const selectedProduct = meta.selectedProduct || firstItem || {};

  // Fallback date if ROS doesn't provide a date
  const fallbackDateRaw =
    (recordFields["Date provided"] as string) ||
    (recordFields["Date Provided"] as string) ||
    record?.saved_at ||
    record?.created_at ||
    (order as any).completed_at ||
    (order as any).completedAt ||
    (order as any).createdAt ||
    (order as any).created_at ||
    order.start_at ||
    meta.appointment_start_at ||
    new Date().toISOString();

  const fallBackDate = formatDateOnly(fallbackDateRaw);

  const dateProvided =
    (recordFields["Date provided"] as string) ||
    (recordFields["Date Provided"] as string) ||
    fallBackDate;

  const itemARaw =
    recordFields["Item A"] ||
    recordFields["Item a"] ||
    recordFields["Item"] ||
    recordFields["Item name A"] ||
    recordFields["Medicine A"] ||
    selectedProduct.name ||
    firstItem?.name ||
    "";

  const itemVariationARaw =
    recordFields["Item variation A"] ||
    recordFields["Item Variation A"] ||
    recordFields["Item variation a"] ||
    recordFields["Strength A"] ||
    recordFields["Dose A"] ||
    selectedProduct.strength ||
    firstItem?.strength ||
    "";

  const quantityARaw =
    recordFields["Quantity A"] ||
    recordFields["Quantity a"] ||
    recordFields["Quantity"] ||
    selectedProduct.qty ||
    firstItem?.qty ||
    "";

  const reference = order.reference || order._id;

  // ----- Header: brand + title -----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(22, 163, 74); // green

  // Brand name
  doc.text("PHARMACY EXPRESS", marginX, 18);

  // Main title
  doc.setFontSize(16);
  doc.text("PRIVATE PRESCRIPTION", marginX, 30);

  // Reference + Date line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81); // slate
  const refLine = `Reference: ${reference} | Date: ${dateProvided || "—"}`;
  doc.text(refLine, marginX, 36);

  // Green divider
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.line(marginX, 38, pageWidth - marginX, 38);

  let cursorY: PdfCursor = { y: 48 };

  // ----- Pharmacy + Patient cards -----
  const gap = 8;
  const totalCardWidth = pageWidth - 2 * marginX - gap;
  const cardWidth = totalCardWidth / 2;
  const cardHeight = 56;
  const cardTop = cursorY.y;

  // Outer cards
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cardTop, cardWidth, cardHeight, 2, 2);
  doc.roundedRect(
    marginX + cardWidth + gap,
    cardTop,
    cardWidth,
    cardHeight,
    2,
    2
  );

  // Pharmacy Details header & content
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text("Pharmacy Details", marginX + 4, cardTop + 8);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(marginX + 4, cardTop + 10, marginX + cardWidth - 4, cardTop + 10);

  let y = cardTop + 18;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  const leftLabelX = marginX + 4;
  const leftValueX = marginX + 26;

  doc.setFont("helvetica", "bold");
  doc.text("Name:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(PHARMACY_INFO.name, leftValueX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Address:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  const addrLines = PHARMACY_INFO.addressLines || [];
  if (addrLines.length) {
    doc.text(addrLines[0], leftValueX, y);
    for (let i = 1; i < addrLines.length; i++) {
      y += 4;
      doc.text(addrLines[i], leftValueX, y);
    }
  }
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Tel:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(PHARMACY_INFO.tel, leftValueX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Email:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(PHARMACY_INFO.email, leftValueX, y);

  // Patient Information card
  const u: any = user || {};
  const patientName = getDisplayPatientName(order, user || undefined);
  const dobLabel = u.dob ? formatDateOnly(u.dob) : null;
  const addrParts = [
    u.address_line1 || u.addressLine1 || u.address_line_1 || u.address1,
    u.address_line2 || u.addressLine2 || u.address_line_2 || u.address2,
    u.city,
    u.county,
    u.postalcode || u.postcode,
    u.country,
  ].filter(Boolean);
  const fullAddress = addrParts.join(", ");

  const contactStr = [u.email || (order as any).email, u.phone || u.phoneNumber]
    .filter(Boolean)
    .join(" | ");

  const rightX = marginX + cardWidth + gap;
  const rightLabelX = rightX + 4;
  const rightValueX = rightX + 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text("Patient Information", rightLabelX, cardTop + 8);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(rightLabelX, cardTop + 10, rightX + cardWidth - 4, cardTop + 10);

  y = cardTop + 18;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  doc.setFont("helvetica", "bold");
  doc.text("Name:", rightLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(patientName || "—", rightValueX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("DOB:", rightLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(dobLabel || "—", rightValueX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Address:", rightLabelX, y);
  doc.setFont("helvetica", "normal");
  const addrLinesPt = doc.splitTextToSize(fullAddress || "—", cardWidth - 30);
  doc.text(addrLinesPt as any, rightValueX, y);
  y += 4 * addrLinesPt.length + 1;

  doc.setFont("helvetica", "bold");
  doc.text("Contact:", rightLabelX, y);
  doc.setFont("helvetica", "normal");
  const contactLines = doc.splitTextToSize(contactStr || "—", cardWidth - 30);
  doc.text(contactLines as any, rightValueX, y);

  cursorY.y = cardTop + cardHeight + 10;

  // ----- Medicine Prescribed -----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text("Medicine Prescribed", marginX, cursorY.y);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(marginX, cursorY.y + 2, pageWidth - marginX, cursorY.y + 2);

  const tableStartY = cursorY.y + 6;
  const rows = [
    { label: "Date provided", value: String(dateProvided || "—") },
    { label: "Item A", value: String(itemARaw || "—") },
    { label: "Item variation A", value: String(itemVariationARaw || "—") },
    { label: "Quantity A", value: String(quantityARaw || "—") },
  ];
  const afterTableY = drawTwoColumnTable(
    doc,
    marginX,
    tableStartY,
    pageWidth - 2 * marginX,
    rows
  );

  cursorY.y = afterTableY + 10;

  // ----- Pharmacist Declaration -----
  const declaration = meta.pharmacistDeclaration;
  const fields: Record<string, any> = (declaration?.fields as any) || {};

  const pharmacistName =
    fields["Pharmacist Name"] ||
    fields["Pharmacist name"] ||
    fields["Pharmacist"] ||
    "—";
  const gphcNumber =
    fields["GPhC Number"] || fields["GPhC number"] || fields["GPhC"] || "—";
  const declarationDate =
    fields["Date"] ||
    fields["Date provided"] ||
    declaration?.saved_at ||
    dateProvided ||
    fallBackDate;

  const boxTop = cursorY.y;
  const boxHeight = 62;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, boxTop, pageWidth - 2 * marginX, boxHeight, 2, 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text("Pharmacist Declaration", marginX + 4, boxTop + 8);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(marginX + 4, boxTop + 10, pageWidth - marginX - 4, boxTop + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  const longText =
    "I confirm that the above named patient has been clinically assessed and supplied medication in accordance with the service protocol. The supply is appropriate, counselling has been provided, and relevant records have been completed.";
  let textY = boxTop + 18;
  const paraLines = doc.splitTextToSize(longText, pageWidth - 2 * marginX - 8);
  doc.text(paraLines as any, marginX + 4, textY);
  textY += 4 * paraLines.length + 4;

  const infoRows = [
    ["Pharmacist Name:", pharmacistName],
    ["GPhC Number:", gphcNumber],
    ["Date:", formatDateOnly(declarationDate) || "—"],
  ] as [string, string][];

  infoRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, marginX + 4, textY);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", marginX + 40, textY);
    textY += 5;
  });

  // Signature row
  doc.setFont("helvetica", "bold");
  doc.text("Signature:", marginX + 4, textY);
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, "PNG", marginX + 40, textY - 6, 30, 14);
    } catch {
      // ignore failures
    }
  }

  // ----- Watermark: DO NOT DISPENSE -----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(50);
  doc.setTextColor(229, 231, 235); // light grey
  (doc as any).text("DO NOT DISPENSE", pageWidth / 2, 170, {
    angle: -35,
    align: "center",
  } as any);

  const filename = `PrivatePrescription_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----- All Clinical docs in one PDF (Full consultation record) ----- */

async function exportAllClinicalPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
): Promise<File | void> {
  const reference = order.reference || order._id;
  const serviceName = order.service_name || "Service";
  const meta: any = order.meta || {};
  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const logoDataUrl = await getPdfLogoDataUrl();
  const signatureDataUrl = await getSignatureDataUrl(order);

  const doc = createPdfBaseDoc("Clinical Documentation", subtitle, logoDataUrl);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);

  const raf = meta.formsQA?.raf;
  const hasRaf = !!raf?.qa?.length;
  const hasAdvice = extractAdviceTexts(order).length > 0;
  const hasDeclaration = !!meta.pharmacistDeclaration;
  const hasRecord = !!meta.recordOfSupply;

  if (!hasRaf && !hasAdvice && !hasDeclaration && !hasRecord) {
    writeSectionTitle(doc, cursor, "Clinical Documentation");
    ensureSpace(doc, cursor);
    doc.text(
      "No clinical documentation has been recorded for this order.",
      MARGIN_X,
      cursor.y
    );
    const filename = `FullConsultation_${order.reference || order._id}.pdf`;
    return finalisePdf(doc, filename, mode);
  }

  if (hasRaf) {
    await writeRafSection(doc, cursor, order);
    cursor.y += 4;
  }
  if (hasAdvice) {
    writeAdviceSection(doc, cursor, order);
    cursor.y += 4;
  }
  if (hasDeclaration) {
    writeDeclarationSection(doc, cursor, order, signatureDataUrl);
    cursor.y += 4;
  }
  if (hasRecord) {
    writeRecordSection(doc, cursor, order);
  }

  const filename = `FullConsultation_${order.reference || order._id}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----- RAF answer helper for on-screen display ----- */
function buildRafAnswerString(qa: any): string {
  const raw = qa.raw;
  const answerValRaw = qa.answer;
  const answerVal =
    answerValRaw != null && typeof answerValRaw !== "object"
      ? String(answerValRaw)
      : "";
  let ans: string;

  if (Array.isArray(raw)) {
    const isFileArray =
      raw.length > 0 &&
      typeof raw[0] === "object" &&
      (raw[0].name || raw[0].url);
    if (isFileArray) {
      const fileNames = raw
        .map((f: any) => f?.name || f?.url || "")
        .filter(Boolean);
      ans = fileNames.length
        ? `Attached file(s): ${fileNames.join(", ")}`
        : "Attached file(s).";
    } else {
      ans = raw.map((v: any) => String(v)).join(", ");
    }
  } else if (raw && typeof raw === "object") {
    const name = (raw as any).name || (raw as any).url;
    ans = name ? `Attached file: ${name}` : "Attached file (stored in system).";
  } else if (answerVal && answerVal !== "[object Object]") {
    ans = answerVal;
  } else if (raw != null) {
    ans = String(raw);
  } else {
    ans = "—";
  }
  return ans;
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

/* ----------------- Types for clinical section tabs ----------------- */

type DetailSection = "raf" | "advice" | "declaration" | "record";
type PdfKind =
  | "full"
  | "raf"
  | "advice"
  | "declaration"
  | "record"
  | "invoice"
  | "private_rx";

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
    default:
      return kind;
  }
}

const DEFAULT_PAGE_SIZE = 25;

/* ----------------- Page ----------------- */

export default function Page() {
  // list state
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<OrdersListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cache of user info for cards: user_id -> user
  const [orderUsers, setOrderUsers] = useState<Record<string, UserDto | null>>(
    {}
  );

  // detail modal state
  const [showDetail, setShowDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [orderedByUser, setOrderedByUser] = useState<UserDto | null>(null);

  // approve / reject action state (kept in case you wire status actions later)
  const [statusAction, setStatusAction] = useState<
    "approved" | "rejected" | null
  >(null);

  // clinical section active tab in detail modal
  const [activeSection, setActiveSection] = useState<DetailSection>("raf");

  // header dropdowns / email
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [emailPdfMenuOpen, setEmailPdfMenuOpen] = useState(false);
  const [emailPdfSending, setEmailPdfSending] = useState(false);
  const [emailPdfStatus, setEmailPdfStatus] = useState<string | null>(null);

  // Email People modal state
  const [emailPeopleOpen, setEmailPeopleOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [emailPeopleSending, setEmailPeopleSending] = useState(false);
  const [emailPeopleError, setEmailPeopleError] = useState<string | null>(null);

  // list filters / pagination
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");


  const pageSize = DEFAULT_PAGE_SIZE;

  // derived: status counts for current page
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: orders.length,
      pending: 0,
      approved: 0,
      completed: 0,
      cancelled: 0,
    };
    orders.forEach((o: any) => {
      const s = o.status;
      if (s && counts[s] != null) counts[s] += 1;
    });
    return counts;
  }, [orders]);

  /* ---- Load orders ---- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOrdersApi({
          page,
          pageSize,
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
        if (!cancelled) {
          setLoading(false);
        }
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

      // Collect all user IDs on this page
      const allIds = Array.from(
        new Set(
          orders
            .map((o: any) => o.user_id || o.userId || o.patient_user_id)
            .filter(Boolean)
        )
      );

      // Only fetch those we don't already have
      const missingIds = allIds.filter((id) => orderUsers[id] === undefined);
      if (!missingIds.length) return;

      try {
        const results = await Promise.all(
          missingIds.map(async (id) => {
            try {
              const res = await getUserByIdApi(id);
              const user =
                (res as any)?.data ?? (res as any)?.user ?? (res as any);
              return { id, user: user as UserDto | null };
            } catch (err) {
              console.error("Failed to fetch user for order", id, err);
              return { id, user: null as UserDto | null };
            }
          })
        );

        setOrderUsers((prev) => {
          const next = { ...prev };
          for (const { id, user } of results) {
            // only set if not already set
            if (next[id] === undefined) {
              next[id] = user;
            }
          }
          return next;
        });
      } catch (err) {
        console.error("Error prefetching users for orders", err);
      }
    }

    fetchUsersForOrders();
  }, [orders, orderUsers]);

  /* ---- Detail: load full order + user ---- */
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

      const promises: Promise<any>[] = [getOrderByIdApi(order._id) as any];

      if (userId && !orderUsers[userId]) {
        promises.push(getUserByIdApi(userId) as any);
      }

      const [orderRes, maybeUserRes] = await Promise.all(promises);

      const fullOrder =
        (orderRes as any)?.data ??
        (orderRes as any)?.order ??
        orderRes ??
        order;
      setSelectedOrder(fullOrder);

      if (userId) {
        let user: UserDto | null = null;
        if (maybeUserRes) {
          user =
            (maybeUserRes as any)?.data ??
            (maybeUserRes as any)?.user ??
            maybeUserRes;
        } else {
          user = orderUsers[userId] ?? null;
        }

        if (user) {
          setOrderedByUser(user);
          setOrderUsers((prev) => ({
            ...prev,
            [userId]: user,
          }));
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

  /* ---- PDF handlers ---- */
  const handleDownloadPdf = async (kind: PdfKind) => {
    if (!selectedOrder) return;
    try {
      const order = selectedOrder;
      const user = orderedByUser;

      switch (kind) {
        case "full":
          await exportAllClinicalPdf(order, user, "download");
          break;
        case "raf":
          await exportRafPdf(order, user, "download");
          break;
        case "advice":
          await exportAdvicePdf(order, user, "download");
          break;
        case "declaration":
          await exportDeclarationPdf(order, user, "download");
          break;
        case "record":
          await exportRecordPdf(order, user, "download");
          break;
        case "invoice":
          await exportInvoicePdf(order, user, "download");
          break;
        case "private_rx":
          await exportPrivatePrescriptionPdf(order, user, "download");
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
        return (await exportAllClinicalPdf(order, user, "file")) as File;
      case "raf":
        return (await exportRafPdf(order, user, "file")) as File;
      case "advice":
        return (await exportAdvicePdf(order, user, "file")) as File;
      case "declaration":
        return (await exportDeclarationPdf(order, user, "file")) as File;
      case "record":
        return (await exportRecordPdf(order, user, "file")) as File;
      case "invoice":
        return (await exportInvoicePdf(order, user, "file")) as File;
      case "private_rx":
        return (await exportPrivatePrescriptionPdf(
          order,
          user,
          "file"
        )) as File;
      default:
        return null;
    }
  };

  /* ---- Quick Email PDF (to patient) ---- */
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
      if (!file) {
        throw new Error("Failed to generate PDF.");
      }

      const subject = `${getPdfLabel(kind)} - ${
        order.service_name || "Order"
      } (${order.reference || order._id})`;

      // Optional text you might want to also display in the email body
      const message =
        `Dear ${patientName || "Patient"},\n\n` +
        `Please find attached your ${getPdfLabel(
          kind
        ).toLowerCase()} for your recent consultation (${
          order.service_name || "service"
        }) with ${PHARMACY_INFO.name}.\n\n` +
        `If you have any questions, please contact us on ${PHARMACY_INFO.tel} or reply to this email.\n\n` +
        `Kind regards,\n${PHARMACY_INFO.name}`;

      const loginUrl = getLoginUrl();

      await sendEmailApi({
        to: email,
        subject,
        template: "welcome", // 👈 hard-coded template name
        context: {
          // variables used in your template
          subject,
          name: patientName || "Patient",
          email,
          loginUrl,
          supportEmail: PHARMACY_INFO.email,
          year: new Date().getFullYear(),

          // if you updated the template to show a dynamic message,
          // you can reference this field there, e.g. {{message}}
          message,
        },
        attachments: [file],
      });

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

  /* ---- Email people modal helpers ---- */
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
        order.service_name || "Pharmacy Express"
      }`
    );
    setEmailMessage(
      `Dear ${patientName || "Patient"},\n\n` +
        `Please find attached your documents for your recent consultation (${
          order.service_name || "service"
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
    // reset input so same file can be selected again if needed
    e.target.value = "";
  };

  const removeAttachmentAt = (idx: number) => {
    setEmailAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSendEmailPeople = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailPeopleError(null);

    if (!emailTo.trim()) {
      setEmailPeopleError("Please enter a recipient in the To field.");
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

      // Fallback if we don't have an order/patient name
      const friendlyName =
        patientName || emailTo.trim().split("@")[0] || "Customer";

      const loginUrl = getLoginUrl();

      await sendEmailApi({
        to: emailTo.trim(),
        subject: emailSubject.trim(),
        template: "welcome", // 👈 hard-coded template
        context: {
          subject: emailSubject.trim(),
          name: friendlyName,
          email: emailTo.trim(),
          loginUrl,
          supportEmail: PHARMACY_INFO.email,
          year: new Date().getFullYear(),

          // let the template show this if you've added a placeholder like {{message}}
          message: emailMessage,
        },
        attachments: emailAttachments,
      });

      setEmailPeopleSending(false);
      setEmailPeopleOpen(false);
      setEmailPdfStatus(`Email sent to ${emailTo.trim()}.`);
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
    const meta: any = selectedOrder.meta || {};

    if (activeSection === "raf") {
      const raf = meta.formsQA?.raf;
      if (!raf?.qa?.length) {
        return (
          <p className="text-xs text-neutral-400">
            No RAF data captured for this order.
          </p>
        );
      }

      return (
        <ol className="space-y-3">
          {raf.qa.map((qa: any, idx: number) => {
            const q = qa.question || qa.key || `Question ${idx + 1}`;
            const { text, files } = normaliseRafAnswer(qa);

            return (
              <li
                key={idx}
                className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2"
              >
                <p className="text-xs font-medium text-neutral-100">
                  {idx + 1}. {q}
                </p>

                <p className="mt-1 text-[11px] text-neutral-300">
                  <span className="font-semibold text-neutral-400">
                    Answer:
                  </span>{" "}
                  {text}
                </p>

                {files.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {files.map((f, i) => (
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
      const adviceTexts = extractAdviceTexts(selectedOrder);
      if (!adviceTexts.length) {
        return (
          <p className="text-xs text-neutral-400">
            No Pharmacist Advice has been recorded for this order.
          </p>
        );
      }

      return (
        <ul className="list-disc space-y-2 pl-5 text-[11px] text-neutral-200">
          {adviceTexts.map((txt, idx) => (
            <li key={idx}>{txt}</li>
          ))}
        </ul>
      );
    }

    if (activeSection === "declaration") {
      const declaration = meta.pharmacistDeclaration;
      if (!declaration) {
        return (
          <p className="text-xs text-neutral-400">
            No Pharmacist Declaration has been recorded.
          </p>
        );
      }

      const fields: Record<string, any> = declaration.fields || {};
      const entries = Object.entries(fields);

      return (
        <div className="space-y-3 text-[11px] text-neutral-200">
          {entries.length ? (
            <dl className="space-y-2">
              {entries.map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="w-32 shrink-0 text-neutral-400">{key}</dt>
                  <dd className="flex-1">{formatFieldValue(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-neutral-400">
              No declaration fields were filled.
            </p>
          )}

          {declaration.signatureUrl && (
            <p className="text-neutral-400">
              A pharmacist signature has been captured and stored with this
              record.
            </p>
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
      const record = meta.recordOfSupply;
      if (!record) {
        return (
          <p className="text-xs text-neutral-400">
            No Record of Supply has been captured.
          </p>
        );
      }

      const fields: Record<string, any> = record.fields || {};
      const entries = Object.entries(fields);

      if (!entries.length) {
        return (
          <p className="text-xs text-neutral-400">
            Record of Supply fields are empty.
          </p>
        );
      }

      return (
        <dl className="space-y-2 text-[11px] text-neutral-200">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="w-32 shrink-0 text-neutral-400">{key}</dt>
              <dd className="flex-1">{formatFieldValue(value)}</dd>
            </div>
          ))}
        </dl>
      );
    }

    return null;
  };

  const canPrev = (meta?.page ?? page) > 1;
  const totalPages =
    meta?.totalPages ??
    (meta?.total && (meta as any)?.pageSize
      ? Math.max(1, Math.ceil(meta.total / (meta as any).pageSize))
      : page);
  const canNext = (meta?.page ?? page) < totalPages;

  return (
    <>
      <div className="px-4 py-4 lg:px-6 lg:py-6">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-semibold text-white sm:text-lg">
              Orders & clinical records
            </h1>
            <p className="mt-1 text-xs text-neutral-400">
              View patient orders, generate invoices, and export clinical
              documentation PDFs.
            </p>
          </div>
        </div>

        {/* Global error / status */}
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

        {/* Search + pagination */}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Filter className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/70 pl-7 pr-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-0"
              placeholder="Search by reference, patient, service..."
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <span>
              Page{" "}
              <span className="text-neutral-100">
                {meta?.page ?? page} / {totalPages || 1}
              </span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => {
                  if (!canPrev) return;
                  setPage((p) => Math.max(1, p - 1));
                }}
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
                onClick={() => {
                  if (!canNext) return;
                  setPage((p) => p + 1);
                }}
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

        {/* Orders table */}
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-900/80 text-[11px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Reference</th>
                  <th className="px-3 py-2 text-left font-medium">Patient</th>
                  <th className="px-3 py-2 text-left font-medium">Service</th>
                  <th className="px-3 py-2 text-left font-medium">Created</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Payment</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Total incl. VAT
                  </th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-xs text-neutral-500"
                    >
                      {loading
                        ? "Loading orders..."
                        : "No orders found for the current filters."}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const userId =
                      (order as any).user_id ||
                      (order as any).userId ||
                      (order as any).patient_user_id ||
                      "";
                    const userForOrder = (userId && orderUsers[userId]) || null;
                    const patientName = getDisplayPatientName(
                      order,
                      userForOrder ?? undefined
                    );
                    const totalMinor =
                      (order as any).total_minor ??
                      (order.meta as any)?.totalMinor ??
                      null;

                    return (
                      <tr
                        key={order._id}
                        className="cursor-pointer border-t border-neutral-900/80 bg-neutral-950/40 hover:bg-neutral-900/60"
                        onClick={() => openOrderDetail(order)}
                      >
                        <td className="whitespace-nowrap px-3 py-2 align-middle">
                          <div className="flex items-center gap-1">
                            <ClipboardList className="h-3.5 w-3.5 text-neutral-500" />
                            <span className="font-medium text-neutral-100">
                              {order.reference || order._id}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-xs px-3 py-2 align-middle">
                          <span className="line-clamp-2 text-[11px] text-neutral-100">
                            {patientName}
                          </span>
                        </td>
                        <td className="max-w-xs px-3 py-2 align-middle">
                          <span className="line-clamp-2 text-[11px] text-neutral-200">
                            {order.service_name || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-middle text-[11px] text-neutral-300">
                          {formatDateTime(
                            (order as any).createdAt ||
                              (order as any).created_at
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {order.status && (
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                                statusBadgeClasses(order.status),
                              ].join(" ")}
                            >
                              {order.status === "completed" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : order.status === "pending" ? (
                                <Clock className="h-3 w-3" />
                              ) : order.status === "approved" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : order.status === "cancelled" ||
                                order.status === "rejected" ? (
                                <XCircle className="h-3 w-3" />
                              ) : (
                                <ClipboardList className="h-3 w-3" />
                              )}
                              <span className="capitalize">
                                {order.status.replace(/_/g, " ")}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {order.payment_status && (
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                                paymentBadgeClasses(order.payment_status),
                              ].join(" ")}
                            >
                              <CreditCard className="h-3 w-3" />
                              <span className="capitalize">
                                {order.payment_status.replace(/_/g, " ")}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right align-middle text-[11px] text-neutral-100">
                          {formatMoney(totalMinor)}
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOrderDetail(order);
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                          >
                            <span>Open</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* List-level loading indicator */}
          {loading && (
            <div className="flex items-center gap-2 border-t border-neutral-900/80 bg-neutral-950/60 px-3 py-2 text-[11px] text-neutral-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading latest orders…</span>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {showDetail && selectedOrder && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={closeDetail} />
          <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-neutral-800 bg-neutral-950">
            {/* Detail header */}
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                  Order reference
                </p>
                <p className="text-sm font-semibold text-white">
                  {selectedOrder.reference || selectedOrder._id}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-400">
                  <ClipboardList className="h-3 w-3" />
                  <span>{selectedOrder.service_name || "Service"}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedOrder.status && (
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                        statusBadgeClasses(selectedOrder.status),
                      ].join(" ")}
                    >
                      {selectedOrder.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : selectedOrder.status === "pending" ? (
                        <Clock className="h-3 w-3" />
                      ) : selectedOrder.status === "approved" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : selectedOrder.status === "cancelled" ||
                        selectedOrder.status === "rejected" ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        <ClipboardList className="h-3 w-3" />
                      )}
                      <span className="capitalize">
                        {selectedOrder.status.replace(/_/g, " ")}
                      </span>
                    </span>
                  )}
                  {selectedOrder.payment_status && (
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                        paymentBadgeClasses(selectedOrder.payment_status),
                      ].join(" ")}
                    >
                      <CreditCard className="h-3 w-3" />
                      <span className="capitalize">
                        {selectedOrder.payment_status.replace(/_/g, " ")}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={closeDetail}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:border-neutral-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-2">
                  {/* Download menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setDownloadMenuOpen((v) => !v);
                        setEmailPdfMenuOpen(false);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </button>
                    {downloadMenuOpen && (
                      <div className="absolute right-0 mt-1 w-52 rounded-md border border-neutral-800 bg-neutral-950/95 text-[11px] text-neutral-100 shadow-xl backdrop-blur">
                        {(
                          [
                            ["full", "Full consultation record"],
                            ["invoice", "Invoice"],
                            ["raf", "RAF – Risk assessment"],
                            ["advice", "Pharmacist advice"],
                            ["declaration", "Pharmacist declaration"],
                            ["record", "Record of supply"],
                            ["private_rx", "Private prescription"],
                          ] as [PdfKind, string][]
                        ).map(([kind, label]) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => {
                              setDownloadMenuOpen(false);
                              handleDownloadPdf(kind);
                            }}
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-neutral-800/80"
                          >
                            <span>{label}</span>
                          </button>
                        ))}
                        <div className="border-t border-neutral-800 px-3 py-1.5 text-[10px] text-neutral-500">
                          Tip: open the downloaded PDF and print from your PDF
                          viewer if needed.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Email PDF menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailPdfMenuOpen((v) => !v);
                        setDownloadMenuOpen(false);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Email PDF</span>
                    </button>
                    {emailPdfMenuOpen && (
                      <div className="absolute right-0 mt-1 w-56 rounded-md border border-neutral-800 bg-neutral-950/95 text-[11px] text-neutral-100 shadow-xl backdrop-blur">
                        {emailPdfSending ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-neutral-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Sending…</span>
                          </div>
                        ) : (
                          <>
                            {(
                              [
                                ["full", "Full consultation record"],
                                ["invoice", "Invoice"],
                                ["raf", "RAF"],
                                ["advice", "Advice"],
                                ["declaration", "Declaration"],
                                ["record", "Record of supply"],
                                ["private_rx", "Private prescription"],
                              ] as [PdfKind, string][]
                            ).map(([kind, label]) => (
                              <button
                                key={kind}
                                type="button"
                                onClick={() => {
                                  handleEmailPdf(kind);
                                  setEmailPdfMenuOpen(false);
                                }}
                                className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-neutral-800/80"
                              >
                                <span>{label}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setEmailPdfMenuOpen(false);
                                openEmailComposer();
                              }}
                              className="mt-1 flex w-full items-center justify-between border-t border-neutral-800 px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800/80"
                            >
                              <span>Open email composer…</span>
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Detail body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Patient card */}
              <PatientProfileCard user={orderedByUser} />

              {/* Clinical tabs & content */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
                <div className="flex gap-1 border-b border-neutral-800 px-3 pt-2">
                  {(
                    [
                      ["raf", "RAF"],
                      ["advice", "Advice"],
                      ["declaration", "Declaration"],
                      ["record", "Record of supply"],
                    ] as [DetailSection, string][]
                  ).map(([id, label]) => {
                    const active = activeSection === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveSection(id)}
                        className={[
                          "relative inline-flex items-center gap-1 rounded-t-md px-3 pb-1.5 pt-1 text-[11px]",
                          active
                            ? "border-b border-emerald-500 text-emerald-100"
                            : "text-neutral-400 hover:text-neutral-100",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="px-3 py-3 text-xs text-neutral-200">
                  {detailLoading ? (
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading full clinical details…</span>
                    </div>
                  ) : detailError ? (
                    <p className="text-xs text-rose-300">{detailError}</p>
                  ) : (
                    renderClinicalSection()
                  )}
                </div>
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
                      {selectedOrder.reference || selectedOrder._id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Service</dt>
                    <dd className="text-neutral-100">
                      {selectedOrder.service_name || "—"}
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
                        (selectedOrder.meta as any)?.appointment_start_at ||
                          (selectedOrder as any).start_at
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">
                      Total incl. VAT (minor)
                    </dt>
                    <dd className="text-neutral-100">
                      {formatMoney(
                        (selectedOrder.meta as any)?.totalMinor ??
                          (selectedOrder as any).total_minor ??
                          null
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Status</dt>
                    <dd className="text-neutral-100 capitalize">
                      {selectedOrder.status?.replace(/_/g, " ") || "—"}
                      {selectedOrder.payment_status && (
                        <>
                          {" "}
                          •{" "}
                          <span className="text-neutral-300">
                            Payment:{" "}
                            {selectedOrder.payment_status
                              ?.replace(/_/g, " ")
                              .toLowerCase()}
                          </span>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email people modal */}
      {emailPeopleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setEmailPeopleOpen(false)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">
                  Email documents
                </p>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Send consultation PDFs and custom message to the patient or
                  other recipients.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEmailPeopleOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:border-neutral-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form
              className="mt-3 space-y-3 text-xs"
              onSubmit={handleSendEmailPeople}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    To
                  </label>
                  <input
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="patient@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    Cc
                  </label>
                  <input
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    Bcc
                  </label>
                  <input
                    value={emailBcc}
                    onChange={(e) => setEmailBcc(e.target.value)}
                    className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="optional"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                  Subject
                </label>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="Subject"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                  Message
                </label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="Write your message..."
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-neutral-300">
                    Attachments
                  </span>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleAttachPdfToEmail("invoice")}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-[2px] hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttachPdfToEmail("full")}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-[2px] hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      Full record
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttachPdfToEmail("raf")}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-[2px] hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      RAF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttachPdfToEmail("record")}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-[2px] hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      Record of supply
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-neutral-700 bg-neutral-900/80 px-2 py-[2px] text-[11px] text-neutral-200 hover:border-neutral-500">
                      <span>Upload files</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileInput}
                      />
                    </label>
                  </div>
                </div>
                <div className="space-y-1 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-2 text-[11px] text-neutral-200">
                  {emailAttachments.length === 0 ? (
                    <p className="text-neutral-500">
                      No attachments added yet.
                    </p>
                  ) : (
                    emailAttachments.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {file.name}{" "}
                          <span className="text-neutral-500">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachmentAt(idx)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 hover:border-rose-500/70 hover:text-rose-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {emailPeopleError && (
                <div className="rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
                  {emailPeopleError}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEmailPeopleOpen(false)}
                  className="inline-flex h-8 items-center rounded-md border border-neutral-700 bg-neutral-900/80 px-3 text-[11px] text-neutral-200 hover:border-neutral-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailPeopleSending}
                  className={[
                    "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[11px]",
                    emailPeopleSending
                      ? "border-emerald-700/70 bg-emerald-700/40 text-emerald-50"
                      : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500",
                  ].join(" ")}
                >
                  {emailPeopleSending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
