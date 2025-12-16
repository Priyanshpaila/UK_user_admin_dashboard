"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserApi, type CreateUserPayload } from "../../../../api";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

type FormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  gender: "male" | "female" | "other";
  phone: string;
  dob: string;

  address_line1: string;
  address_line2: string;
  city: string;
  county: string;
  postalcode: string;
  country: string;

  // ✅ NEW
  use_shipping_address: boolean;

  shipping_address_line1: string;
  shipping_address_line2: string;
  shipping_city: string;
  shipping_postalcode: string;
  shipping_country: string;
};

const mapAddressToShipping = (form: FormState) => ({
  shipping_address_line1: form.address_line1,
  shipping_address_line2: form.address_line2,
  shipping_city: form.city,
  shipping_postalcode: form.postalcode,
  shipping_country: form.country,
});

export default function CreatePatientPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
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

    // ✅ default: shipping same as address
    use_shipping_address: true,

    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_postalcode: "",
    shipping_country: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setForm((prev) => {
      const next = { ...prev, [name]: value } as FormState;

      // ✅ If "shipping same as address" is enabled, keep shipping in sync
      if (next.use_shipping_address) {
        if (
          name === "address_line1" ||
          name === "address_line2" ||
          name === "city" ||
          name === "postalcode" ||
          name === "country"
        ) {
          const sync = mapAddressToShipping(next);
          return { ...next, ...sync };
        }
      }

      return next;
    });
  };

  const handleToggleShippingSameAsAddress = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const checked = e.target.checked;

    setForm((prev) => {
      const next = { ...prev, use_shipping_address: checked };

      // ✅ when turned ON, copy address into shipping immediately
      if (checked) {
        const sync = mapAddressToShipping(next);
        return { ...next, ...sync };
      }

      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // ✅ Build shipping fields:
      // - if use_shipping_address=true => copy from address
      // - else => use shipping inputs
      const shipping =
        form.use_shipping_address
          ? mapAddressToShipping(form)
          : {
              shipping_address_line1: form.shipping_address_line1,
              shipping_address_line2: form.shipping_address_line2,
              shipping_city: form.shipping_city,
              shipping_postalcode: form.shipping_postalcode,
              shipping_country: form.shipping_country,
            };

      const payload: CreateUserPayload = {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,

        gender: form.gender,
        phone: form.phone,
        email_verified: false,
        dob: form.dob,

        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        county: form.county,
        postalcode: form.postalcode,
        country: form.country,

        // ✅ NEW shipping fields
        use_shipping_address: form.use_shipping_address,
        ...shipping,

        is_patient: true,
      };

      const res = await createUserApi(payload);
      console.log("Patient created:", res);

      setSuccessMsg("Patient created successfully.");
      // router.push("/dashboard/patients");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Failed to create patient. Please try again.");
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
                  placeholder="Flat 17"
                />
              </div>

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
                  placeholder="19 Wellington Street"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-300">City</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Leeds"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-300">County</label>
                <input
                  type="text"
                  name="county"
                  value={form.county}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="West Yorkshire"
                />
              </div>

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
                  placeholder="LS1 4JF"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-300">Country</label>
                <input
                  type="text"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500"
                  placeholder="United Kingdom"
                />
              </div>
            </div>
          </div>

          {/* ✅ Shipping Address */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-white">Shipping Address</h2>

              <label className="inline-flex items-center gap-2 text-sm text-neutral-300 select-none">
                <input
                  type="checkbox"
                  checked={form.use_shipping_address}
                  onChange={handleToggleShippingSameAsAddress}
                  className="h-4 w-4 rounded border-neutral-700 bg-neutral-800"
                />
                Same as address
              </label>
            </div>

            {form.use_shipping_address && (
              <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-800/30 px-4 py-3 text-sm text-neutral-300">
                Shipping address will be copied from the Address section and kept
                in sync.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-neutral-300">
                  Shipping Address Line 1
                </label>
                <input
                  type="text"
                  name="shipping_address_line1"
                  value={form.shipping_address_line1}
                  onChange={handleChange}
                  disabled={form.use_shipping_address}
                  required={!form.use_shipping_address}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  placeholder="Flat 17"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-neutral-300">
                  Shipping Address Line 2
                </label>
                <input
                  type="text"
                  name="shipping_address_line2"
                  value={form.shipping_address_line2}
                  onChange={handleChange}
                  disabled={form.use_shipping_address}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  placeholder="19 Wellington Street"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-300">
                  Shipping City
                </label>
                <input
                  type="text"
                  name="shipping_city"
                  value={form.shipping_city}
                  onChange={handleChange}
                  disabled={form.use_shipping_address}
                  required={!form.use_shipping_address}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  placeholder="Leeds"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-300">
                  Shipping Postal Code
                </label>
                <input
                  type="text"
                  name="shipping_postalcode"
                  value={form.shipping_postalcode}
                  onChange={handleChange}
                  disabled={form.use_shipping_address}
                  required={!form.use_shipping_address}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  placeholder="LS1 4JF"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-300">
                  Shipping Country
                </label>
                <input
                  type="text"
                  name="shipping_country"
                  value={form.shipping_country}
                  onChange={handleChange}
                  disabled={form.use_shipping_address}
                  required={!form.use_shipping_address}
                  className="w-full mt-1 p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  placeholder="United Kingdom"
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
