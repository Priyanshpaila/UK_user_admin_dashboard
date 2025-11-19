"use client";

import React, { useEffect, useState } from "react";
import { getPatientsApi, updateUserApi } from "../../../api";
import { Plus, Loader2 } from "lucide-react";
import Link from "next/link";

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPatient, setEditingPatient] = useState<any | null>(null);
  const [dobInput, setDobInput] = useState<string>(""); // YYYY-MM-DD for the input
  const [saving, setSaving] = useState(false);

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

      // --- DOB handling ---
      // You want: "dob": "1995-08-20"
      if (dobInput) {
        payload.dob = dobInput; // exactly "YYYY-MM-DD"
      }
      // If dobInput is empty and backend allows optional, we simply do NOT send dob
      // If backend requires dob, you can enforce it here:
      // else { payload.dob = (editingPatient.dob || "").substring(0, 10); }

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
      RENDER
  ---------------------------------------- */
  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Patients</h1>

        <Link
          href="/dashboard/patients/create"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
        >
          <Plus size={18} />
          Add Patient
        </Link>
      </div>

      {/* Error message */}
      {error && !loading && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-400" size={32} />
        </div>
      )}

      {/* Empty State */}
      {!loading && patients.length === 0 && (
        <div className="text-center py-14 border border-neutral-800 bg-neutral-900 rounded-xl">
          <p className="text-neutral-300">No patients found.</p>

          <Link
            href="/dashboard/patients/create"
            className="mt-4 inline-flex gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus size={18} />
            Create First Patient
          </Link>
        </div>
      )}

      {/* Patients List */}
      {!loading && patients.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
          {patients.map((patient) => (
            <div
              key={patient._id}
              className="p-4 flex justify-between items-center hover:bg-neutral-800 transition"
            >
              <div>
                <p className="text-white font-medium">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-neutral-400 text-sm">
                  {patient.email || "No email"} · {patient.phone || "No phone"}
                </p>
                <p className="text-neutral-500 text-xs mt-1 capitalize">
                  {patient.gender} {patient.city ? `• ${patient.city}` : ""}
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingPatient(patient);
                  setDobInput(
                    patient.dob ? (patient.dob as string).substring(0, 10) : ""
                  ); // keep YYYY-MM-DD for the input
                }}
                className="text-blue-400 hover:underline text-sm"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit Patient Modal */}
      {editingPatient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 p-6 rounded-xl max-w-2xl w-full border border-neutral-700 max-h-[90vh] overflow-y-auto">
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

              {/* DOB – bound to dobInput (YYYY-MM-DD) */}
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
