"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getPatientsApi,
  updateUserApi,
  getOrdersApi,
  type OrderDto,
  type OrdersListMeta,
} from "../../../api";
import {
  Plus,
  Loader2,
  Search,
  UserCircle2,
  RefreshCw,
  MapPin,
  Mail,
  Phone,
  ClipboardList,
  ArrowRightCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";

/* ---------- Helpers ---------- */

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
  const pounds = minor / 100;
  return `£${pounds.toFixed(2)}`;
}

function statusBadgeClasses(status: string | undefined) {
  const s = (status || "").toLowerCase();

  if (s === "completed")
    return "bg-emerald-900/40 text-emerald-300 border-emerald-700/60";
  if (s === "approved")
    return "bg-blue-900/40 text-blue-300 border-blue-700/60";
  if (s === "rejected")
    return "bg-red-900/40 text-red-300 border-red-700/60";
  if (s === "paid")
    return "bg-emerald-900/30 text-emerald-300 border-emerald-700/50";
  if (s === "pending")
    return "bg-amber-900/30 text-amber-300 border-amber-700/50";

  return "bg-neutral-800 text-neutral-200 border-neutral-700";
}

function priorityBadgeClasses(priority: string | undefined) {
  const p = (priority || "yellow").toLowerCase();
  if (p === "red") return "border-red-500/60 bg-red-500/10 text-red-300";
  if (p === "green")
    return "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
  return "border-amber-500/60 bg-amber-500/10 text-amber-200";
}

// ✅ address → shipping mapping (for "Same as address")
function mapAddressToShipping(p: any) {
  return {
    shipping_address_line1: p.address_line1 ?? "",
    shipping_address_line2: p.address_line2 ?? "",
    shipping_city: p.city ?? "",
    shipping_postalcode: p.postalcode ?? "",
    shipping_country: p.country ?? "",
  };
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPatient, setEditingPatient] = useState<any | null>(null);
  const [dobInput, setDobInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Orders state (for selected patient)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null
  );
  const [patientOrders, setPatientOrders] = useState<OrderDto[]>([]);
  const [ordersMeta, setOrdersMeta] = useState<OrdersListMeta | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  /* ----------------------------------------
      FETCH PATIENTS
  ---------------------------------------- */
  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getPatientsApi(1, 10);

      if (
        !response ||
        !Array.isArray(response.data) ||
        response.data.length === 0
      ) {
        setPatients([]);
        setError("No patients found.");
      } else {
        setPatients(response.data);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load patients.");
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------------------
      UPDATE PATIENT
  ---------------------------------------- */
  const handleUpdatePatient = async () => {
    if (!editingPatient) return;

    try {
      setSaving(true);

      // ✅ If same as address ON, ensure shipping fields are synced before sending
      const useShipping = Boolean(editingPatient.use_shipping_address);
      const synced =
        useShipping ? mapAddressToShipping(editingPatient) : undefined;

      const payload: any = {
        firstName: editingPatient.firstName ?? "",
        lastName: editingPatient.lastName ?? "",
        gender: editingPatient.gender ?? "male",
        email: editingPatient.email ?? "",
        phone: editingPatient.phone ?? "",

        address_line1: editingPatient.address_line1 ?? "",
        address_line2: editingPatient.address_line2 ?? "",
        city: editingPatient.city ?? "",
        county: editingPatient.county ?? "",
        postalcode: editingPatient.postalcode ?? "",
        country: editingPatient.country ?? "",

        user_priority: editingPatient.user_priority ?? "yellow",

        // ✅ NEW shipping fields
        use_shipping_address: useShipping,
        shipping_address_line1:
          (synced?.shipping_address_line1 ??
            editingPatient.shipping_address_line1 ??
            "") as string,
        shipping_address_line2:
          (synced?.shipping_address_line2 ??
            editingPatient.shipping_address_line2 ??
            "") as string,
        shipping_city:
          (synced?.shipping_city ?? editingPatient.shipping_city ?? "") as string,
        shipping_postalcode:
          (synced?.shipping_postalcode ??
            editingPatient.shipping_postalcode ??
            "") as string,
        shipping_country:
          (synced?.shipping_country ??
            editingPatient.shipping_country ??
            "") as string,
      };

      if (dobInput) payload.dob = dobInput;

      await updateUserApi(editingPatient._id, payload);

      setEditingPatient(null);
      setDobInput("");
      await fetchPatients();
    } catch (err) {
      console.error("Error updating patient:", err);
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------------------
      FETCH ORDERS FOR A PATIENT
  ---------------------------------------- */
  const fetchOrdersForPatient = async (patientId: string) => {
    try {
      setOrdersLoading(true);
      setOrdersError("");
      setPatientOrders([]);
      setOrdersMeta(null);

      const res = await getOrdersApi({
        user_id: patientId,
        page: 1,
        limit: 20,
      });

      setPatientOrders(res.data || []);
      setOrdersMeta(res.meta || null);
    } catch (err) {
      console.error("Failed to load orders for patient:", err);
      setOrdersError("Failed to load this patient's orders.");
      setPatientOrders([]);
      setOrdersMeta(null);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSelectPatient = (patient: any) => {
    if (!patient?._id) return;

    const id = patient._id as string;

    if (selectedPatientId === id) {
      setSelectedPatientId(null);
      setPatientOrders([]);
      setOrdersMeta(null);
      setOrdersError("");
      return;
    }

    setSelectedPatientId(id);
    fetchOrdersForPatient(id);
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  /* ----------------------------------------
      FILTERED PATIENTS (SEARCH)
  ---------------------------------------- */
  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();

    return patients.filter((p) =>
      [
        p.firstName,
        p.lastName,
        p.email,
        p.phone,
        p.city,
        p.postalcode,
        p.country,
        p.shipping_city,
        p.shipping_postalcode,
        p.shipping_country,
      ]
        .filter(Boolean)
        .some((val: string) => val.toLowerCase().includes(q))
    );
  }, [patients, search]);

  /* ----------------------------------------
      MODAL INPUT HELPERS (shipping sync)
  ---------------------------------------- */
  const updateEditing = (patch: Record<string, any>) => {
    setEditingPatient((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };

      // ✅ If same-as-address is enabled, keep shipping synced as user edits address
      if (next.use_shipping_address) {
        const touchedAddressKey = Object.keys(patch).some((k) =>
          [
            "address_line1",
            "address_line2",
            "city",
            "postalcode",
            "country",
          ].includes(k)
        );

        if (touchedAddressKey) {
          return { ...next, ...mapAddressToShipping(next) };
        }
      }

      return next;
    });
  };

  const toggleShippingSameAsAddress = (checked: boolean) => {
    setEditingPatient((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, use_shipping_address: checked };

      if (checked) {
        return { ...next, ...mapAddressToShipping(next) };
      }

      // When turning OFF, keep current shipping values as-is.
      // (No changes required)
      return next;
    });
  };

  /* ----------------------------------------
      RENDER
  ---------------------------------------- */
  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <UserCircle2 size={22} className="text-neutral-400" />
            Patients
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Managing{" "}
            <span className="font-medium text-neutral-200">
              {patients.length}
            </span>{" "}
            patient{patients.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPatients}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            <RefreshCw size={16} className="shrink-0" />
            Refresh
          </button>

          <Link
            href="/dashboard/patients/create"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
          >
            <Plus size={18} />
            Add Patient
          </Link>
        </div>
      </div>

      {/* Toolbar: search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
        <div className="relative w-full md:max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, city…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {!loading && (
          <p className="text-xs text-neutral-500">
            Showing{" "}
            <span className="font-medium text-neutral-200">
              {filteredPatients.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-neutral-200">
              {patients.length}
            </span>{" "}
            patient{patients.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 border border-neutral-800 bg-neutral-900/60 rounded-xl">
          <Loader2 className="animate-spin text-neutral-400 mb-3" size={32} />
          <p className="text-neutral-300 text-sm">Loading patients…</p>
        </div>
      )}

      {/* Empty / Error State */}
      {!loading && (error || filteredPatients.length === 0) && (
        <div className="text-center py-14 border border-neutral-800 bg-neutral-900 rounded-xl">
          <p className="text-neutral-300 mb-2">
            {error || "No patients match your search."}
          </p>

          <button
            onClick={fetchPatients}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 mt-3"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {/* Patients Grid */}
      {!loading && filteredPatients.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPatients.map((patient) => {
            const fullName = `${patient.firstName ?? ""} ${
              patient.lastName ?? ""
            }`.trim();
            const hasContact = patient.email || patient.phone;
            const isSelected = selectedPatientId === patient._id;
            const priority = (patient.user_priority || "yellow") as string;

            return (
              <div
                key={patient._id}
                onClick={() => handleSelectPatient(patient)}
                className={`group rounded-xl border bg-neutral-900/70 transition shadow-sm flex flex-col cursor-pointer ${
                  isSelected
                    ? "border-blue-500/70 shadow-blue-500/20 bg-neutral-900"
                    : "border-neutral-800 hover:bg-neutral-800"
                }`}
              >
                <div className="p-4 flex-1 flex flex-col gap-2">
                  {/* Top row: avatar + name + gender + priority */}
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 text-sm font-semibold text-neutral-200">
                      {fullName
                        ? fullName
                            .split(" ")
                            .map((s: string) => s[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "PT"}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 justify-between">
                        <h2 className="text-sm font-semibold text-white line-clamp-1 flex items-center gap-1">
                          {fullName || "Unnamed patient"}
                          {isSelected && (
                            <ArrowRightCircle
                              size={14}
                              className="text-blue-400"
                            />
                          )}
                        </h2>

                        {/* Priority chip */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${priorityBadgeClasses(
                            priority
                          )}`}
                        >
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {priority}
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-400 capitalize">
                        {patient.gender || "unspecified"}
                        {patient.city ? ` • ${patient.city}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Email / Phone */}
                  {hasContact && (
                    <div className="flex flex-col gap-1 mt-2">
                      {patient.email && (
                        <div className="inline-flex items-center gap-1 text-xs text-neutral-300">
                          <Mail size={12} className="text-neutral-500" />
                          <span className="truncate">{patient.email}</span>
                        </div>
                      )}
                      {patient.phone && (
                        <div className="inline-flex items-center gap-1 text-xs text-neutral-300">
                          <Phone size={12} className="text-neutral-500" />
                          <span className="truncate">{patient.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Address snippet */}
                  {(patient.city || patient.postalcode || patient.country) && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-neutral-400">
                      <MapPin size={11} className="text-neutral-500" />
                      <span className="line-clamp-1">
                        {[patient.city, patient.postalcode, patient.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}

                  {/* Orders section (only when selected) */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-neutral-300">
                          <ClipboardList
                            size={13}
                            className="text-neutral-400"
                          />
                          <span>Orders for this patient</span>
                        </div>

                        {ordersMeta && (
                          <span className="text-[11px] text-neutral-500">
                            {ordersMeta.total} order
                            {ordersMeta.total === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      {ordersLoading && (
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                          <Loader2
                            size={14}
                            className="animate-spin text-neutral-400"
                          />
                          <span>Loading orders…</span>
                        </div>
                      )}

                      {!ordersLoading && ordersError && (
                        <p className="text-xs text-red-400">{ordersError}</p>
                      )}

                      {!ordersLoading &&
                        !ordersError &&
                        patientOrders.length === 0 && (
                          <p className="text-xs text-neutral-500">
                            No orders found for this patient.
                          </p>
                        )}

                      {!ordersLoading &&
                        !ordersError &&
                        patientOrders.length > 0 && (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {patientOrders.map((order) => {
                              const firstLine = order.meta?.lines?.[0] || null;
                              const mainName =
                                firstLine?.name ||
                                order.meta?.selectedProduct?.name ||
                                "Order items";
                              const mainVariation =
                                firstLine?.variation ||
                                order.meta?.selectedProduct?.variation ||
                                null;

                              const totalMinor =
                                order.meta?.totalMinor ??
                                order.meta?.selectedProduct?.totalMinor ??
                                null;

                              const when =
                                order.meta?.appointment_start_at ||
                                order.createdAt;

                              return (
                                <div
                                  key={order._id}
                                  className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 text-xs flex flex-col gap-1.5"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-neutral-100">
                                          {mainName}
                                        </span>
                                        {mainVariation && (
                                          <span className="text-[11px] text-neutral-400">
                                            • {mainVariation}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                                        <Clock size={11} />
                                        <span>{formatDateTime(when)}</span>
                                      </div>
                                      <div className="text-[11px] text-neutral-400">
                                        Ref:{" "}
                                        <span className="text-neutral-200 font-medium">
                                          {order.reference}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex gap-1">
                                        <span
                                          className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusBadgeClasses(
                                            order.status
                                          )}`}
                                        >
                                          {order.status}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusBadgeClasses(
                                            order.payment_status
                                          )}`}
                                        >
                                          {order.payment_status}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-neutral-300">
                                        Total:{" "}
                                        <span className="font-semibold">
                                          {formatMoney(totalMinor)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  )}
                </div>

                {/* Footer: Edit Patient & Priority label */}
                <div className="px-4 py-3 border-t border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-300 bg-neutral-900/60">
                      Patient
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${priorityBadgeClasses(
                        priority
                      )}`}
                    >
                      Priority: {priority}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      // ✅ Ensure modal has shipping defaults (and if same-as-address is true, sync once)
                      const useShip =
                        patient.use_shipping_address === undefined
                          ? true
                          : Boolean(patient.use_shipping_address);

                      const base = {
                        ...patient,
                        use_shipping_address: useShip,
                        shipping_address_line1:
                          patient.shipping_address_line1 ?? "",
                        shipping_address_line2:
                          patient.shipping_address_line2 ?? "",
                        shipping_city: patient.shipping_city ?? "",
                        shipping_postalcode: patient.shipping_postalcode ?? "",
                        shipping_country: patient.shipping_country ?? "",
                      };

                      const finalPatient = useShip
                        ? { ...base, ...mapAddressToShipping(base) }
                        : base;

                      setEditingPatient(finalPatient);

                      setDobInput(
                        patient.dob
                          ? (patient.dob as string).substring(0, 10)
                          : ""
                      );
                    }}
                    className="text-xs font-medium text-blue-400 group-hover:text-blue-300 hover:underline"
                  >
                    Edit details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Patient Modal */}
      {editingPatient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 p-6 rounded-xl max-w-3xl w-full border border-neutral-700 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-2xl font-semibold">
                Edit Patient – {editingPatient.firstName}{" "}
                {editingPatient.lastName}
              </h2>

              <button
                onClick={() => {
                  setEditingPatient(null);
                  setDobInput("");
                }}
                className="text-sm text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800"
                disabled={saving}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label className="block text-sm text-neutral-300">
                  First Name
                </label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.firstName ?? ""}
                  onChange={(e) => updateEditing({ firstName: e.target.value })}
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Last Name
                </label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.lastName ?? ""}
                  onChange={(e) => updateEditing({ lastName: e.target.value })}
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm text-neutral-300">Gender</label>
                <select
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.gender ?? "male"}
                  onChange={(e) => updateEditing({ gender: e.target.value })}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* DOB */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Date of Birth
                </label>
                <input
                  type="date"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={dobInput}
                  onChange={(e) => setDobInput(e.target.value)}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm text-neutral-300">Email</label>
                <input
                  type="email"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.email ?? ""}
                  onChange={(e) => updateEditing({ email: e.target.value })}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm text-neutral-300">Phone</label>
                <input
                  type="tel"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.phone ?? ""}
                  onChange={(e) => updateEditing({ phone: e.target.value })}
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Priority status
                </label>
                <select
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.user_priority ?? "yellow"}
                  onChange={(e) =>
                    updateEditing({ user_priority: e.target.value })
                  }
                >
                  <option value="red">Red – High risk</option>
                  <option value="yellow">Yellow – Medium</option>
                  <option value="green">Green – Low</option>
                </select>
              </div>

              {/* ---------- Address ---------- */}
              <div className="md:col-span-2 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Address</h3>
                </div>
              </div>

              {/* Address Line 1 */}
              <div className="md:col-span-2">
                <label className="block text-sm text-neutral-300">
                  Address Line 1
                </label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.address_line1 ?? ""}
                  onChange={(e) =>
                    updateEditing({ address_line1: e.target.value })
                  }
                />
              </div>

              {/* Address Line 2 */}
              <div className="md:col-span-2">
                <label className="block text-sm text-neutral-300">
                  Address Line 2
                </label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.address_line2 ?? ""}
                  onChange={(e) =>
                    updateEditing({ address_line2: e.target.value })
                  }
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-sm text-neutral-300">City</label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.city ?? ""}
                  onChange={(e) => updateEditing({ city: e.target.value })}
                />
              </div>

              {/* County */}
              <div>
                <label className="block text-sm text-neutral-300">County</label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.county ?? ""}
                  onChange={(e) => updateEditing({ county: e.target.value })}
                />
              </div>

              {/* Postal Code */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Postal Code
                </label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.postalcode ?? ""}
                  onChange={(e) =>
                    updateEditing({ postalcode: e.target.value })
                  }
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm text-neutral-300">Country</label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.country ?? ""}
                  onChange={(e) => updateEditing({ country: e.target.value })}
                />
              </div>

              {/* ---------- Shipping ---------- */}
              <div className="md:col-span-2 pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Shipping Address
                  </h3>

                  <label className="inline-flex items-center gap-2 text-sm text-neutral-300 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-700 bg-neutral-800"
                      checked={Boolean(editingPatient.use_shipping_address)}
                      onChange={(e) =>
                        toggleShippingSameAsAddress(e.target.checked)
                      }
                    />
                    Same as address
                  </label>
                </div>

                {Boolean(editingPatient.use_shipping_address) && (
                  <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-800/30 px-4 py-3 text-sm text-neutral-300">
                    Shipping address will be copied from Address and kept in
                    sync.
                  </div>
                )}
              </div>

              {/* Shipping Address Line 1 */}
              <div className="md:col-span-2">
                <label className="block text-sm text-neutral-300">
                  Shipping Address Line 1
                </label>
                <input
                  type="text"
                  disabled={Boolean(editingPatient.use_shipping_address)}
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700 disabled:opacity-60"
                  value={editingPatient.shipping_address_line1 ?? ""}
                  onChange={(e) =>
                    updateEditing({ shipping_address_line1: e.target.value })
                  }
                />
              </div>

              {/* Shipping Address Line 2 */}
              <div className="md:col-span-2">
                <label className="block text-sm text-neutral-300">
                  Shipping Address Line 2
                </label>
                <input
                  type="text"
                  disabled={Boolean(editingPatient.use_shipping_address)}
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700 disabled:opacity-60"
                  value={editingPatient.shipping_address_line2 ?? ""}
                  onChange={(e) =>
                    updateEditing({ shipping_address_line2: e.target.value })
                  }
                />
              </div>

              {/* Shipping City */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Shipping City
                </label>
                <input
                  type="text"
                  disabled={Boolean(editingPatient.use_shipping_address)}
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700 disabled:opacity-60"
                  value={editingPatient.shipping_city ?? ""}
                  onChange={(e) =>
                    updateEditing({ shipping_city: e.target.value })
                  }
                />
              </div>

              {/* Shipping Postal Code */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Shipping Postal Code
                </label>
                <input
                  type="text"
                  disabled={Boolean(editingPatient.use_shipping_address)}
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700 disabled:opacity-60"
                  value={editingPatient.shipping_postalcode ?? ""}
                  onChange={(e) =>
                    updateEditing({ shipping_postalcode: e.target.value })
                  }
                />
              </div>

              {/* Shipping Country */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Shipping Country
                </label>
                <input
                  type="text"
                  disabled={Boolean(editingPatient.use_shipping_address)}
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700 disabled:opacity-60"
                  value={editingPatient.shipping_country ?? ""}
                  onChange={(e) =>
                    updateEditing({ shipping_country: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingPatient(null);
                  setDobInput("");
                }}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                onClick={handleUpdatePatient}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60"
                disabled={saving}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
