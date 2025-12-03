"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getOrderByIdApi,
  updateOrderStatusApi,
  type OrderDto,
} from "../../../../api";
import { Loader2, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";

import RecordOfSupplyTab from "./RecordOfSupplyTab";
import RiskAssessmentTab from "./RiskAssessmentTab";
import PharmacistAdviceTab from "./PharmacistAdviceTab";
import PharmacistDeclarationTab from "./PharmacistDeclarationTab";

type TabKey = "risk" | "advice" | "declaration" | "record";

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

function getDisplayPatientName(order: OrderDto): string {
  if (!order) return "Unknown";

  if (order.patient_name) return order.patient_name;

  const fromOrder = `${order.first_name || ""} ${order.last_name || ""}`.trim();
  if (fromOrder) return fromOrder;

  return order.email || "Unknown";
}

// value can be string | string[] | number | boolean | null
type RiskAnswerLS = { key: string; question: string; value: any };

export default function ConsultationPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = searchParams.get("order_id") || "";
  const serviceIdFromQuery = searchParams.get("service_id") || "";

  const [order, setOrder] = useState<OrderDto | null>(null);
  const [serviceId, setServiceId] = useState<string>(serviceIdFromQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("risk");

  const [endSaving, setEndSaving] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [endSuccess, setEndSuccess] = useState<string | null>(null);

  // Load order
  useEffect(() => {
    if (!orderId) {
      setError("Missing order_id in URL");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const o = await getOrderByIdApi(orderId);
        if (cancelled) return;
        setOrder(o);

        if (!serviceId && o.service_id) {
          setServiceId(o.service_id);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load order");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const baseStorageKey = useCallback(
    () => (order ? `consultation_${order._id}` : ""),
    [order]
  );

  // End consultation: gather all data from localStorage & send to backend
  async function handleEndConsultation() {
    if (!order) return;
    const baseKey = baseStorageKey();
    if (!baseKey) return;

    setEndSaving(true);
    setEndError(null);
    setEndSuccess(null);

    try {
      const readJson = (suffix: string) => {
        if (typeof window === "undefined") return null;
        const raw = window.localStorage.getItem(`${baseKey}_${suffix}`);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };

      const risk = readJson("risk") as RiskAnswerLS[] | null;
      const advice = readJson("advice");
      const declaration = readJson("declaration");
      const record = readJson("record");

      // Start from existing meta
      const updatedMeta: any = { ...(order.meta || {}) };

      // -------- RISK ----------
      if (risk && Array.isArray(risk) && risk.length) {
        if (!updatedMeta.formsQA) updatedMeta.formsQA = {};

        const existingRaf: any = updatedMeta.formsQA.raf || {};
        const existingQa: any[] = Array.isArray(existingRaf.qa)
          ? [...existingRaf.qa]
          : [];

        const byKey: Record<string, any> = {};
        for (const q of existingQa) {
          if (!q || !q.key) continue;
          byKey[q.key] = q;
        }

        for (const ans of risk) {
          if (!ans || !ans.key) continue;
          const existing = byKey[ans.key];

          let valueStr = "";
          let raw: any;

          if (Array.isArray(ans.value)) {
            const arr = ans.value
              .map((v: any) => String(v).trim())
              .filter(Boolean);
            valueStr = arr.join(", ");
            raw = arr;
          } else if (typeof ans.value === "string") {
            valueStr = ans.value;
            if (valueStr.includes(",")) {
              const arr = valueStr
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              raw = arr;
            } else {
              raw = valueStr;
            }
          } else if (ans.value != null) {
            valueStr = String(ans.value);
            raw = valueStr;
          } else {
            valueStr = "";
            raw = "";
          }

          if (existing) {
            existing.question = ans.question || existing.question || ans.key;
            existing.answer = valueStr;

            if (Array.isArray(existing.raw)) {
              if (Array.isArray(raw)) {
                existing.raw = raw;
              } else if (valueStr) {
                existing.raw = [valueStr];
              } else {
                existing.raw = [];
              }
            } else {
              existing.raw = raw;
            }
          } else {
            existingQa.push({
              key: ans.key,
              question: ans.question || ans.key,
              answer: valueStr,
              raw,
            });
          }
        }

        existingRaf.qa = existingQa;

        if (!existingRaf.form_id) {
          existingRaf.form_id =
            existingRaf.formId ||
            updatedMeta.formsQA?.raf?.form_id ||
            updatedMeta.formsQA?.raf?.formId ||
            (order.meta as any)?.formsQA?.raf?.form_id ||
            null;
        }

        updatedMeta.formsQA.raf = existingRaf;
        updatedMeta.riskAssessment = risk;
      }

      // -------- Advice ----------
      if (advice) {
        updatedMeta.pharmacistAdvice = advice;
      }

      // -------- Declaration ----------
      if (declaration) {
        updatedMeta.pharmacistDeclaration = {
          ...(declaration || {}),
          saved_at: new Date().toISOString(),
        };
      }

      // -------- Record of supply ----------
      if (record) {
        updatedMeta.recordOfSupply = record;
      }

      // ✅ include completed_at with current time
      const payload: any = {
        status: "completed",
        completed_at: new Date().toISOString(),
        meta: updatedMeta,
      };

      const updatedOrder = await updateOrderStatusApi(order._id, payload);
      setOrder(updatedOrder);

      // Clear localStorage cache for this consultation
      if (typeof window !== "undefined") {
        ["risk", "advice", "declaration", "record"].forEach((suffix) => {
          window.localStorage.removeItem(`${baseKey}_${suffix}`);
        });
      }

      setEndSuccess("Consultation data saved and order marked as completed.");

      router.push("/dashboard/approved-orders");
    } catch (e: any) {
      setEndError(e?.message || "Failed to end consultation");
    } finally {
      setEndSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 flex items-center justify-center text-neutral-300">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading consultation…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{error || "Order not found"}</span>
        </div>
      </div>
    );
  }

  const patientName = getDisplayPatientName(order);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300 hover:border-emerald-500 hover:text-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-white flex items-center gap-2">
              Consultation
              {order.status === "completed" && (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              )}
            </h1>
            <p className="text-xs text-neutral-400">
              Ref:{" "}
              <span className="font-mono text-neutral-100">
                {order.reference}
              </span>{" "}
              • {order.service_name} • {patientName}
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-neutral-400">
          <p>
            Appointment:{" "}
            <span className="text-neutral-100">
              {formatDateTime(
                order.meta?.appointment_start_at || order.start_at
              )}
            </span>
          </p>
          <p>
            Status:{" "}
            <span className="uppercase font-semibold text-emerald-300">
              {order.status}
            </span>
          </p>
        </div>
      </div>

      {/* Tabs header */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-2">
        {[
          { key: "risk" as TabKey, label: "Risk Assessment" },
          { key: "advice" as TabKey, label: "Pharmacist’s Advice" },
          { key: "declaration" as TabKey, label: "Pharmacist Declaration" },
          { key: "record" as TabKey, label: "Record of Supply" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-emerald-500/60 hover:text-emerald-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        {activeTab === "risk" && <RiskAssessmentTab order={order} />}

        {activeTab === "advice" && (
          <PharmacistAdviceTab orderId={order._id} serviceId={serviceId} />
        )}

        {activeTab === "declaration" && (
          <PharmacistDeclarationTab orderId={order._id} serviceId={serviceId} />
        )}

        {activeTab === "record" && (
          <RecordOfSupplyTab orderId={order._id} serviceId={serviceId} />
        )}
      </div>

      {/* End consultation area – ONLY on Record of Supply tab */}
      {activeTab === "record" && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-neutral-800 pt-3">
          <div className="text-xs text-neutral-500">
            When you click{" "}
            <span className="text-neutral-200 font-semibold">
              End consultation
            </span>
            , all tab data will be saved into the order meta and local
            consultation data will be cleared.
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {endError && (
              <div className="text-xs text-rose-300 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {endError}
              </div>
            )}
            {endSuccess && (
              <div className="text-xs text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {endSuccess}
              </div>
            )}
            <button
              type="button"
              onClick={handleEndConsultation}
              disabled={endSaving}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {endSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              {endSaving ? "Saving & ending…" : "End consultation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
