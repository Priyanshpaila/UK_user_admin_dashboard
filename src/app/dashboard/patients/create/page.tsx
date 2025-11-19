"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserApi } from "../../../../api";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreatePatientPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    gender: "male",
    phone: "",
    dob: "",
    address_line1: "",
    address_line2: "",
    city: "",
    county: "",
    postalcode: "",
    country: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,

        gender: form.gender,
        phone: form.phone,
        email_verified: false,
        dob: form.dob, // "YYYY-MM-DD"

        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        county: form.county,
        postalcode: form.postalcode,
        country: form.country,

        is_patient: true, // hard-coded as requested
      };

      const res = await createUserApi(payload);
      console.log("Patient created:", res);

      setSuccessMsg("Patient created successfully.");
      // Optionally redirect after a short delay
      // router.push("/dashboard/patients");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err?.message || "Failed to create patient. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/patients"
            className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Patients
          </Link>
        </div>

        <h1 className="text-2xl font-semibold">Create Patient</h1>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMsg}
        </div>
      )}

      {/* Card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <div>
            <h2 className="text-lg font-medium text-white mb-3">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label className="block text-sm text-neutral-300">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm text-neutral-300">Gender</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
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
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact & Auth */}
          <div>
            <h2 className="text-lg font-medium text-white mb-3">
              Contact & Login
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div>
                <label className="block text-sm text-neutral-300">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm text-neutral-300">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Password */}
              <div className="md:col-span-2">
                <label className="block text-sm text-neutral-300">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="StrongPassword123"
                  required
                />
                <p className="text-xs text-neutral-500 mt-1">
                  This will be the login password for the patient.
                </p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h2 className="text-lg font-medium text-white mb-3">Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Address Line 1 */}
              <div className="md:col-span-2">
                <label className="block text-sm text-neutral-300">
                  Address Line 1
                </label>
                <input
                  type="text"
                  name="address_line1"
                  value={form.address_line1}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="123 Baker Street"
                />
              </div>

              {/* Address Line 2 */}
              <div className="md:col-span-2">
                <label className="block text-sm text-neutral-300">
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="address_line2"
                  value={form.address_line2}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Apartment 4B"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-sm text-neutral-300">City</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="London"
                />
              </div>

              {/* County */}
              <div>
                <label className="block text-sm text-neutral-300">County</label>
                <input
                  type="text"
                  name="county"
                  value={form.county}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Greater London"
                />
              </div>

              {/* Postal Code */}
              <div>
                <label className="block text-sm text-neutral-300">
                  Postal Code
                </label>
                <input
                  type="text"
                  name="postalcode"
                  value={form.postalcode}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="NW1 6XE"
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm text-neutral-300">Country</label>
                <input
                  type="text"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="UK"
                />
              </div>
            </div>
          </div>

     

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/patients")}
              className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700 text-sm"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Patient
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
