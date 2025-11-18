'use client';

import React, { useEffect, useState } from "react";
import { getPatientsApi, updateUserApi } from "../../../api"; // Import the API functions
import { Plus, Loader2 } from "lucide-react";
import Link from "next/link";

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPatient, setEditingPatient] = useState<any | null>(null);

  /* ----------------------------------------
      FETCH PATIENTS
  ---------------------------------------- */
  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await getPatientsApi(1, 10);  // Fetch the first 10 patients
      console.log(response);
      
      // Check if the response contains data and is an array
      if (!response || !Array.isArray(response.data) || response.data.length === 0) {
        setError("No patients found.");
      } else {
        setPatients(response.data);  // Set the patients array from response.data
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
  const handleUpdatePatient = async (patientId: string, updatedData: any) => {
    try {
      const response = await updateUserApi(patientId, updatedData);
      console.log('Patient updated:', response);
      setEditingPatient(null); // Close the edit modal after updating
      fetchPatients(); // Refresh the list of patients
    } catch (err) {
      console.error("Error updating patient:", err);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

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
              key={patient._id}  // Use _id as the key
              className="p-4 flex justify-between items-center hover:bg-neutral-800 transition"
            >
              <div>
                {/* Display patient's full name (firstName + lastName) */}
                <p className="text-white font-medium">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-neutral-400 text-sm capitalize">{patient.gender}</p>
              </div>

              {/* Edit Button */}
              <button
                onClick={() => setEditingPatient(patient)}
                className="text-blue-400 hover:underline text-sm"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit Patient Modal (Fallback UI) */}
      {editingPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 p-6 rounded-lg max-w-md w-full">
            <h2 className="text-2xl font-semibold mb-4">Edit Patient</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white">First Name</label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded"
                  defaultValue={editingPatient.firstName}
                  onChange={(e) => setEditingPatient({ ...editingPatient, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-white">Last Name</label>
                <input
                  type="text"
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded"
                  defaultValue={editingPatient.lastName}
                  onChange={(e) => setEditingPatient({ ...editingPatient, lastName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-white">Gender</label>
                <select
                  className="w-full p-2 mt-1 bg-neutral-800 text-white rounded"
                  value={editingPatient.gender}
                  onChange={(e) => setEditingPatient({ ...editingPatient, gender: e.target.value })}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setEditingPatient(null)}  // Close the modal without saving
                  className="px-4 py-2 bg-red-600 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdatePatient(editingPatient._id, editingPatient)}  // Save changes
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
