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

/* ----------------- PDF Helpers ----------------- */

type PdfCursor = { y: number };

const MARGIN_X = 18;
const TOP_CONTENT_Y = 32;

function getPageWidth(doc: jsPDF) {
  return (
    (doc.internal as any).pageSize?.getWidth?.() ??
    (doc.internal as any).pageSize?.width ??
    210
  );
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

function createPdfBaseDoc(title: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = getPageWidth(doc);

  // Header band
  doc.setFillColor(15, 23, 42); // dark slate
  doc.rect(0, 0, pageWidth, 26, "F");

  // Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Pharmacy Express", MARGIN_X, 14);

  // Subtitle + timestamp
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const generated = formatDateTime(new Date().toISOString());
  const label = `Generated: ${generated}`;
  const labelWidth = doc.getTextWidth(label);
  doc.text(label, pageWidth - MARGIN_X - labelWidth, 14);

  const subtitle = title;
  const subWidth = doc.getTextWidth(subtitle);
  doc.text(subtitle, pageWidth - MARGIN_X - subWidth, 20);

  // Accent line under header
  doc.setDrawColor(56, 189, 248); // cyan-ish
  doc.setLineWidth(0.7);
  doc.line(MARGIN_X, 26, pageWidth - MARGIN_X, 26);

  // Reset content style
  doc.setTextColor(31, 41, 55); // neutral-800
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  return doc;
}

function writeSectionTitle(doc: jsPDF, cursor: PdfCursor, title: string) {
  ensureSpace(doc, cursor, 10);
  const pageWidth = getPageWidth(doc);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 118, 110); // teal-ish
  doc.text(title.toUpperCase(), MARGIN_X, cursor.y);

  doc.setDrawColor(148, 163, 184); // gray-400
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, cursor.y + 1.8, pageWidth - MARGIN_X, cursor.y + 1.8);

  cursor.y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(31, 41, 55);
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
  doc.setTextColor(100, 116, 139); // label
  doc.text(label.toUpperCase(), x, cursor.y);
  cursor.y += 3.5;
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);

  const lines = doc.splitTextToSize(value || "—", 80);
  lines.forEach((line: string) => {
    ensureSpace(doc, cursor);
    doc.text(line, x, cursor.y);
    cursor.y += 4.2;
  });
}

/**
 * Two-column Patient / Order summary (no background box).
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

  // Make sure we have enough space near the top of the page
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

  /* ---------- Left column: Patient ---------- */
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
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

  /* ---------- Right column: Order ---------- */
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
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
    order.meta?.appointment_start_at || order.start_at || null;
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

  // Move main cursor below whichever column is taller
  const blockBottom = Math.max(leftCursor.y, rightCursor.y);
  cursor.y = blockBottom + 6;
}

/* ----- RAF section ----- */
function writeRafSection(doc: jsPDF, cursor: PdfCursor, order: OrderDto) {
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

  raf.qa.forEach((qa: any, idx: number) => {
    const q = qa.question || qa.key || `Question ${idx + 1}`;
    const ans = Array.isArray(qa.raw)
      ? qa.raw.join(", ")
      : qa.answer ?? qa.raw ?? "—";

    // Question (bold)
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

    // Answer
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

    cursor.y += 3;
  });
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

    // Already a data URL
    if (url.startsWith("data:image")) return url;

    // Fetch remote image and convert to data URL
    const res = await fetch(url, { mode: "cors" });
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
          doc.setTextColor(100, 116, 139);
          doc.text(l, MARGIN_X, cursor.y);
        }
        if (v) {
          doc.setFontSize(10);
          doc.setTextColor(31, 41, 55);
          doc.text(v, MARGIN_X + 60, cursor.y);
        }
        cursor.y += 4.2;
      }
      cursor.y += 2;
    });
  }

  cursor.y += 4;

  // Signature
  if (signatureDataUrl) {
    ensureSpace(doc, cursor, 30);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
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
    doc.setTextColor(100, 116, 139);
    doc.text("Saved at:", MARGIN_X, cursor.y);
    doc.setTextColor(31, 41, 55);
    doc.text(formatDateTime(declaration.saved_at), MARGIN_X + 20, cursor.y);
    cursor.y += 5;
  }
}

/* ----- Record of supply section ----- */
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
        doc.setTextColor(100, 116, 139);
        doc.text(l, MARGIN_X, cursor.y);
      }
      if (v) {
        doc.setFontSize(10);
        doc.setTextColor(31, 41, 55);
        doc.text(v, MARGIN_X + 60, cursor.y);
      }
      cursor.y += 4.2;
    }
    cursor.y += 2;
  });
}

/* ----- Invoice PDF ----- */
async function exportInvoicePdf(order: OrderDto, user: UserDto | null) {
  const doc = createPdfBaseDoc("Invoice");
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);

  writeSectionTitle(doc, cursor, "Invoice Summary");

  const statusLine = `Order status: ${order.status.toUpperCase()} | Payment: ${order.payment_status.toUpperCase()}`;
  ensureSpace(doc, cursor);
  doc.text(statusLine, MARGIN_X, cursor.y);
  cursor.y += 6;

  if ((order as any).createdAt || (order as any).created_at) {
    ensureSpace(doc, cursor);
    doc.text(
      `Order created: ${formatDateTime(
        (order as any).createdAt || (order as any).created_at
      )}`,
      MARGIN_X,
      cursor.y
    );
    cursor.y += 6;
  }

  cursor.y += 2;
  writeSectionTitle(doc, cursor, "Line Items");

  const pageWidth = getPageWidth(doc);
  const tableX = MARGIN_X;
  const tableWidth = pageWidth - 2 * MARGIN_X;
  const colItem = tableX + 2;
  const colQty = tableX + tableWidth * 0.55;
  const colUnit = tableX + tableWidth * 0.72;
  const colTotal = tableX + tableWidth * 0.86;

  const items = (order.meta?.items || []) as any[];

  if (!items.length) {
    ensureSpace(doc, cursor);
    doc.text("No items found for this order.", MARGIN_X, cursor.y);
    cursor.y += 6;
  } else {
    // Table header background
    ensureSpace(doc, cursor, 10);
    const headerY = cursor.y;
    const headerHeight = 7;
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(15, 23, 42);
    doc.rect(tableX, headerY - 5, tableWidth, headerHeight, "FD");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("Item", colItem, headerY);
    doc.text("Qty", colQty, headerY);
    doc.text("Unit (£)", colUnit, headerY);
    doc.text("Total (£)", colTotal, headerY);

    cursor.y += 5;
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);

    items.forEach((it, rowIdx) => {
      const name = it.name || "Item";
      const qty = it.qty ?? 1;
      const unitMinor = it.unitMinor ?? null;
      const totalMinor = it.totalMinor ?? it.totalMinor ?? null;

      const nameLines = doc.splitTextToSize(name, colQty - colItem - 4);
      const rowHeight = nameLines.length * 4.2 + 3;

      ensureSpace(doc, cursor, rowHeight);

      const rowY = cursor.y;

      // Zebra row background (drawn before text)
      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(tableX, rowY - 4, tableWidth, rowHeight, "FD");
      }

      // Text
      doc.setTextColor(31, 41, 55);
      nameLines.forEach((line: string, index: number) => {
        doc.text(line, colItem, rowY + index * 4.2);
      });

      const numY = rowY;
      doc.text(String(qty), colQty, numY);
      if (unitMinor != null)
        doc.text((unitMinor / 100).toFixed(2), colUnit, numY);
      if (totalMinor != null)
        doc.text((totalMinor / 100).toFixed(2), colTotal, numY);

      cursor.y = rowY + rowHeight;
    });
  }

  // Total
  cursor.y += 4;
  doc.setFontSize(11);
  doc.setTextColor(15, 118, 110);
  const total = order.meta?.totalMinor ?? null;
  const totalText = `Total amount due: ${formatMoney(total)}`;
  ensureSpace(doc, cursor);
  doc.text(totalText, MARGIN_X, cursor.y);
  cursor.y += 6;

  doc.save(`Invoice_${order.reference || order._id}.pdf`);
}

/* ----- Export wrappers for each clinical PDF ----- */

async function exportRafPdf(order: OrderDto, user: UserDto | null) {
  const doc = createPdfBaseDoc("Risk Assessment Form (RAF)");
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };
  writePatientOrderBlock(doc, cursor, order, user);
  writeRafSection(doc, cursor, order);
  doc.save(`RAF_${order.reference || order._id}.pdf`);
}

async function exportAdvicePdf(order: OrderDto, user: UserDto | null) {
  const doc = createPdfBaseDoc("Pharmacist Advice");
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };
  writePatientOrderBlock(doc, cursor, order, user);
  writeAdviceSection(doc, cursor, order);
  doc.save(`Advice_${order.reference || order._id}.pdf`);
}

async function exportDeclarationPdf(order: OrderDto, user: UserDto | null) {
  const signatureDataUrl = await getSignatureDataUrl(order);
  const doc = createPdfBaseDoc("Pharmacist Declaration");
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };
  writePatientOrderBlock(doc, cursor, order, user);
  writeDeclarationSection(doc, cursor, order, signatureDataUrl);
  doc.save(`Declaration_${order.reference || order._id}.pdf`);
}

async function exportRecordPdf(order: OrderDto, user: UserDto | null) {
  const doc = createPdfBaseDoc("Record of Supply");
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };
  writePatientOrderBlock(doc, cursor, order, user);
  writeRecordSection(doc, cursor, order);
  doc.save(`RecordOfSupply_${order.reference || order._id}.pdf`);
}

async function exportAllClinicalPdf(order: OrderDto, user: UserDto | null) {
  const signatureDataUrl = await getSignatureDataUrl(order);
  const doc = createPdfBaseDoc("Clinical Documentation Bundle");
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };
  writePatientOrderBlock(doc, cursor, order, user);

  const meta: any = order.meta || {};
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
    doc.save(`ClinicalDocs_${order.reference || order._id}.pdf`);
    return;
  }

  if (hasRaf) {
    writeRafSection(doc, cursor, order);
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

  doc.save(`ClinicalDocs_${order.reference || order._id}.pdf`);
}

/* ----------------- UI: Patient card ----------------- */

function PatientProfileCard({ user }: { user: UserDto | null }) {
  if (!user) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
        <p className="text-xs text-neutral-400 mb-1">Patient profile</p>
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
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

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
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
          <dd className="text-neutral-100">{u.postalcode || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Country</dt>
          <dd className="text-neutral-100">{u.country || "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-4 text-[11px] text-neutral-500 pt-2 border-t border-neutral-800">
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

  // approve / reject action state (not used right now but kept)
  const [statusAction, setStatusAction] = useState<
    "approved" | "rejected" | null
  >(null);

  // clinical section active tab in detail modal
  const [activeSection, setActiveSection] = useState<DetailSection>("raf");

  // 🔒 hard-coded filter
  const STATUS = "completed";

  // 👉 derived notes for the currently selected order (detail modal)
  const adminNotesForDetail = useMemo(() => {
    if (!selectedOrder) return [] as string[];
    const raw =
      (selectedOrder as any).admin_notes ??
      (selectedOrder.meta as any)?.admin_notes ??
      [];
    if (Array.isArray(raw)) return raw.map((n) => String(n));
    if (raw == null) return [];
    return [String(raw)];
  }, [selectedOrder]);

  const consultantNotesForDetail = useMemo(() => {
    if (!selectedOrder) return [] as string[];
    const meta: any = selectedOrder.meta || {};
    const raw =
      meta.consultant_notes ??
      meta.consultantNotes ??
      meta.consultation_notes ??
      meta.consultationNotes ??
      [];
    if (Array.isArray(raw)) return raw.map((n) => String(n));
    if (raw == null) return [];
    return [String(raw)];
  }, [selectedOrder]);

  const hasAnyNotes =
    adminNotesForDetail.length > 0 || consultantNotesForDetail.length > 0;

  // Load list (completed)
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
  }, []); // always "completed"

  // View details handler
  async function handleViewDetails(id: string) {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedOrder(null);
    setStatusAction(null);
    setOrderedByUser(null);

    try {
      const order = await getOrderByIdApi(id);
      setSelectedOrder(order);

      // decide default clinical tab based on available data
      const meta: any = (order as any).meta || {};
      let def: DetailSection = "raf";
      if (meta.formsQA?.raf?.qa?.length) {
        def = "raf";
      } else if (meta.pharmacistAdvice) {
        def = "advice";
      } else if (meta.pharmacistDeclaration) {
        def = "declaration";
      } else if (meta.recordOfSupply) {
        def = "record";
      }
      setActiveSection(def);

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

  // Approve / Reject action (if you ever use it here)
  async function handleChangeStatus(newStatus: "approved" | "rejected") {
    if (!selectedOrder) return;

    setStatusAction(newStatus);
    setDetailError(null);

    try {
      const updated = await updateOrderStatusApi(selectedOrder._id, {
        status: newStatus,
      });

      setOrders((prev) => prev.filter((o) => o._id !== selectedOrder._id));
      setShowDetail(false);
      setSelectedOrder(updated);
    } catch (e: any) {
      setDetailError(e?.message || "Failed to update order status");
    } finally {
      setStatusAction(null);
    }
  }

  // ---- PDF handlers (use selectedOrder + orderedByUser) ----
  const handleExportRafPdf = async () => {
    if (!selectedOrder) return;
    await exportRafPdf(selectedOrder, orderedByUser);
  };

  const handleExportAdvicePdf = async () => {
    if (!selectedOrder) return;
    await exportAdvicePdf(selectedOrder, orderedByUser);
  };

  const handleExportDeclarationPdf = async () => {
    if (!selectedOrder) return;
    await exportDeclarationPdf(selectedOrder, orderedByUser);
  };

  const handleExportRecordPdf = async () => {
    if (!selectedOrder) return;
    await exportRecordPdf(selectedOrder, orderedByUser);
  };

  const handleExportAllClinicalPdf = async () => {
    if (!selectedOrder) return;
    await exportAllClinicalPdf(selectedOrder, orderedByUser);
  };

  const handleExportInvoicePdf = async () => {
    if (!selectedOrder) return;
    await exportInvoicePdf(selectedOrder, orderedByUser);
  };

  const totalCompleted = meta?.total ?? orders.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Completed Orders
          </h1>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900/70 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300">
            <Filter size={14} />
            <span>Status:</span>
            <span className="font-medium text-sky-400">Completed</span>
          </div>
          <span className="text-xs text-neutral-500">
            {totalCompleted} completed order{totalCompleted === 1 ? "" : "s"}
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
          No completed orders found.
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
                    {order.start_at && order.end_at && (
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
                    )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 md:px-6">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
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
            <div className="max-h-[80vh] overflow-y-auto px-5 py-4 space-y-4 text-sm text-neutral-200">
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

                  {/* Patient profile + appointment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <PatientProfileCard user={orderedByUser} />
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
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

                  {/* Items / lines + Invoice PDF */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-neutral-300" />
                        <p className="text-xs font-semibold text-neutral-200">
                          Items
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-neutral-400">
                          Total:{" "}
                          <span className="font-semibold text-white">
                            {formatMoney(selectedOrder.meta?.totalMinor)}
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={handleExportInvoicePdf}
                          className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] font-medium text-neutral-200 hover:border-emerald-500 hover:text-emerald-200"
                        >
                          Invoice PDF
                        </button>
                      </div>
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

                  {/* 🔹 Admin + Consultation notes */}
                  {hasAnyNotes && (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3 space-y-3">
                      <p className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-neutral-300" />
                        Notes
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold text-neutral-400 mb-1">
                            Admin notes
                          </p>
                          {adminNotesForDetail.length ? (
                            <ul className="space-y-1">
                              {adminNotesForDetail.map((note, idx) => (
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
                              No admin notes.
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-neutral-400 mb-1">
                            Consultation notes
                          </p>
                          {consultantNotesForDetail.length ? (
                            <ul className="space-y-1">
                              {consultantNotesForDetail.map((note, idx) => (
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
                      </div>
                    </div>
                  )}

                  {/* 🔹 Clinical Documentation Tabs + PDF buttons */}
                  {(() => {
                    const meta: any = selectedOrder.meta || {};
                    const raf = meta.formsQA?.raf;
                    const hasRaf = !!raf?.qa?.length;

                    const adviceTexts = extractAdviceTexts(selectedOrder);
                    const hasAdvice = adviceTexts.length > 0;

                    const declaration = meta.pharmacistDeclaration;
                    const hasDeclaration = !!declaration;

                    const record = meta.recordOfSupply;
                    const hasRecord = !!record;

                    const hasAnyClinical =
                      hasRaf || hasAdvice || hasDeclaration || hasRecord;

                    if (!hasAnyClinical) return null;

                    const renderRaf = () => {
                      if (!hasRaf) {
                        return (
                          <p className="text-xs text-neutral-500">
                            No RAF data captured for this order.
                          </p>
                        );
                      }

                      return (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {raf.qa.map((qa: any, idx: number) => (
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
                          ))}
                        </div>
                      );
                    };

                    const renderAdvice = () => {
                      if (!hasAdvice) {
                        return (
                          <p className="text-xs text-neutral-500">
                            No Pharmacist Advice has been recorded for this
                            order.
                          </p>
                        );
                      }

                      return (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          <p className="text-[11px] text-neutral-400">
                            The following advice text snippets were selected in
                            the consultation:
                          </p>
                          <ul className="space-y-1">
                            {adviceTexts.map((txt, i) => (
                              <li
                                key={i}
                                className="text-[11px] text-neutral-100 bg-neutral-900/70 border border-neutral-800 rounded-md px-2 py-1 whitespace-pre-line"
                              >
                                • {txt}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    };

                    const renderDeclaration = () => {
                      if (!hasDeclaration) {
                        return (
                          <p className="text-xs text-neutral-500">
                            No Pharmacist Declaration has been recorded.
                          </p>
                        );
                      }

                      const fields: Record<string, string> =
                        declaration.fields || {};
                      const entries = Object.entries(fields);

                      return (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {entries.length > 0 ? (
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                              {entries.map(([key, value]) => (
                                <div key={key}>
                                  <dt className="text-neutral-500 break-all">
                                    {key}
                                  </dt>
                                  <dd className="text-neutral-100 whitespace-pre-line">
                                    {value || "—"}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <p className="text-xs text-neutral-500">
                              No declaration fields were filled.
                            </p>
                          )}

                          <div className="mt-2 border-t border-neutral-800 pt-2 text-[11px] space-y-2">
                            {declaration.signatureUrl && (
                              <div>
                                <p className="text-neutral-500 mb-1">
                                  Signature
                                </p>
                                <img
                                  src={declaration.signatureUrl}
                                  alt="Pharmacist signature"
                                  className="max-h-24 rounded border border-neutral-800 bg-neutral-900"
                                />
                              </div>
                            )}
                            {declaration.saved_at && (
                              <p className="text-neutral-500">
                                Saved at:{" "}
                                <span className="text-neutral-200">
                                  {formatDateTime(declaration.saved_at)}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    };

                    const renderRecord = () => {
                      if (!hasRecord) {
                        return (
                          <p className="text-xs text-neutral-500">
                            No Record of Supply has been captured.
                          </p>
                        );
                      }

                      const fields: Record<string, string> =
                        record.fields || {};
                      const entries = Object.entries(fields);

                      if (!entries.length) {
                        return (
                          <p className="text-xs text-neutral-500">
                            Record of Supply fields are empty.
                          </p>
                        );
                      }

                      return (
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px] max-h-56 overflow-y-auto pr-1">
                          {entries.map(([key, value]) => (
                            <div key={key}>
                              <dt className="text-neutral-500 break-all">
                                {key}
                              </dt>
                              <dd className="text-neutral-100 whitespace-pre-line">
                                {value || "—"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      );
                    };

                    const TabButton = ({
                      label,
                      section,
                      disabled,
                    }: {
                      label: string;
                      section: DetailSection;
                      disabled?: boolean;
                    }) => {
                      const isActive = activeSection === section;
                      return (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => !disabled && setActiveSection(section)}
                          className={[
                            "px-3 py-1 rounded-full text-[11px] border transition-colors",
                            disabled
                              ? "border-neutral-800 text-neutral-600 cursor-not-allowed"
                              : isActive
                              ? "border-emerald-500/80 bg-emerald-500/10 text-emerald-200"
                              : "border-neutral-700 bg-neutral-900/60 text-neutral-200 hover:border-emerald-500 hover:text-emerald-200",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      );
                    };

                    return (
                      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-neutral-300" />
                            Clinical documentation
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <TabButton
                              label="RAF"
                              section="raf"
                              disabled={!hasRaf}
                            />
                            <TabButton
                              label="Pharmacist Advice"
                              section="advice"
                              disabled={!hasAdvice}
                            />
                            <TabButton
                              label="Pharmacist Declaration"
                              section="declaration"
                              disabled={!hasDeclaration}
                            />
                            <TabButton
                              label="Record of Supply"
                              section="record"
                              disabled={!hasRecord}
                            />
                          </div>
                        </div>

                        {/* PDF buttons */}
                        <div className="mt-2 flex flex-wrap gap-2 border-t border-neutral-800 pt-2">
                          <button
                            type="button"
                            onClick={handleExportRafPdf}
                            disabled={!hasRaf}
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] font-medium text-neutral-200 hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-50 disabled:hover:border-neutral-700"
                          >
                            RAF PDF
                          </button>
                          <button
                            type="button"
                            onClick={handleExportAdvicePdf}
                            disabled={!hasAdvice}
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] font-medium text-neutral-200 hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-50 disabled:hover:border-neutral-700"
                          >
                            Advice PDF
                          </button>
                          <button
                            type="button"
                            onClick={handleExportDeclarationPdf}
                            disabled={!hasDeclaration}
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] font-medium text-neutral-200 hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-50 disabled:hover:border-neutral-700"
                          >
                            Declaration PDF
                          </button>
                          <button
                            type="button"
                            onClick={handleExportRecordPdf}
                            disabled={!hasRecord}
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] font-medium text-neutral-200 hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-50 disabled:hover:border-neutral-700"
                          >
                            Record of Supply PDF
                          </button>
                          <button
                            type="button"
                            onClick={handleExportAllClinicalPdf}
                            disabled={!hasAnyClinical}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/80 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50 disabled:hover:bg-emerald-500/10"
                          >
                            All Clinical Docs (PDF)
                          </button>
                        </div>

                        <div className="mt-3 border-t border-neutral-800 pt-3 text-xs text-neutral-200">
                          {activeSection === "raf" && renderRaf()}
                          {activeSection === "advice" && renderAdvice()}
                          {activeSection === "declaration" &&
                            renderDeclaration()}
                          {activeSection === "record" && renderRecord()}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
