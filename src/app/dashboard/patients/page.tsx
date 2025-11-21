"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getPatientsApi, updateUserApi } from "../../../api";
import {
  Plus,
  Loader2,
  Search,
  UserCircle2,
  RefreshCw,
  MapPin,
  Mail,
  Phone,
} from "lucide-react";
import Link from "next/link";

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPatient, setEditingPatient] = useState<any | null>(null);
  const [dobInput, setDobInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

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
      };

      if (dobInput) {
        payload.dob = dobInput; // "YYYY-MM-DD"
      }

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
      ]
        .filter(Boolean)
        .some((val: string) => val.toLowerCase().includes(q))
    );
  }, [patients, search]);

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

            return (
              <div
                key={patient._id}
                className="group rounded-xl border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 transition shadow-sm flex flex-col"
              >
                <div className="p-4 flex-1 flex flex-col gap-2">
                  {/* Top row: avatar + name + gender */}
                  <div className="flex items-center gap-3">
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
                      <h2 className="text-sm font-semibold text-white line-clamp-1">
                        {fullName || "Unnamed patient"}
                      </h2>
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
                  {(patient.city ||
                    patient.postalcode ||
                    patient.country) && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-neutral-400">
                      <MapPin size={11} className="text-neutral-500" />
                      <span className="line-clamp-1">
                        {[patient.city, patient.postalcode, patient.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer: actions */}
                <div className="px-4 py-3 border-t border-neutral-800 flex items-center justify-between">
                  {/* Simple tag: patient type */}
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-300 bg-neutral-900/60">
                    Patient
                  </span>

                  <button
                    onClick={() => {
                      setEditingPatient(patient);
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
          <div className="bg-neutral-900 p-6 rounded-xl max-w-2xl w-full border border-neutral-700 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-semibold mb-4">
              Edit Patient – {editingPatient.firstName}{" "}
              {editingPatient.lastName}
            </h2>

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
                  onChange={(e) =>
                    setEditingPatient({
                      ...editingPatient,
                      firstName: e.target.value,
                    })
                  }
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
                  onChange={(e) =>
                    setEditingPatient({
                      ...editingPatient,
                      lastName: e.target.value,
                    })
                  }
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm text-neutral-300">Gender</label>
                <select
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.gender ?? "male"}
                  onChange={(e) =>
                    setEditingPatient({
                      ...editingPatient,
                      gender: e.target.value,
                    })
                  }
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
                  onChange={(e) =>
                    setEditingPatient({
                      ...editingPatient,
                      email: e.target.value,
                    })
                  }
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm text-neutral-300">Phone</label>
                <input
                  type="tel"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.phone ?? ""}
                  onChange={(e) =>
                    setEditingPatient({
                      ...editingPatient,
                      phone: e.target.value,
                    })
                  }
                />
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
                    setEditingPatient({
                      ...editingPatient,
                      address_line1: e.target.value,
                    })
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
                    setEditingPatient({
                      ...editingPatient,
                      address_line2: e.target.value,
                    })
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
                  onChange={(e) =>
                    setEditingPatient({
                      ...editingPatient,
                      city: e.target.value,
                    })
                  }
                />
              </div>

              {/* County */}
              <div>
                <label className="block text-sm text-neutral-300">County</label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.county ?? ""}
                  onChange={(e) =>
                    setEditingPatient({
                      ...editingPatient,
                      county: e.target.value,
                    })
                  }
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
                    setEditingPatient({
                      ...editingPatient,
                      postalcode: e.target.value,
                    })
                  }
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Country
                </label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded border border-neutral-700"
                  value={editingPatient.country ?? ""}
                  onChange={(e) =>
                    setEditingPatient({
                      ...editingPatient,
                      country: e.target.value,
                    })
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
