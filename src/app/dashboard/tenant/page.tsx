'use client';

import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const BASE_API_URL = 'http://localhost:8000/api';

export default function CreateTenantPage() {
  const [subdomain, setSubdomain] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('male');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [tenantCreated, setTenantCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle creating subdomain
  const handleCreateSubdomain = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const subdomainResponse = await fetch(`${BASE_API_URL}/dns/subdomain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subdomain,
          ttl: 600,
        }),
      });

      if (!subdomainResponse.ok) {
        throw new Error('Failed to create subdomain');
      }

      setTenantCreated(true); // Show pharmacist form after subdomain is created
      toast.success('Subdomain created successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to create subdomain');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle creating pharmacist
  const handleCreatePharmacist = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const pharmacistResponse = await fetch(`http://${subdomain}.localhost:8000/api/users/createPharmacist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          gender,
          email,
          phone,
          password,
        }),
      });

      if (!pharmacistResponse.ok) {
        throw new Error('Failed to create pharmacist');
      }

      toast.success('Pharmacist created successfully!');
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to create pharmacist');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Create Tenant and Pharmacist</h1>
      </div>

      {/* Tenant Creation */}
      {!tenantCreated && (
        <div className="bg-neutral-900 rounded-lg p-6 mb-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Create Tenant</h2>
          <input
            type="text"
            placeholder="Enter Subdomain"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            className="w-full p-3 mb-4 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={handleCreateSubdomain}
            disabled={isSubmitting}
            className={`w-full py-3 bg-blue-600 text-white rounded-lg shadow-md ${isSubmitting ? 'opacity-50' : ''}`}
          >
            {isSubmitting ? <Loader2 className="animate-spin inline-block mr-2" size={20} /> : <Plus className="inline-block mr-2" size={20} />}
            {isSubmitting ? 'Creating...' : 'Create Tenant'}
          </button>
          {error && <p className="text-red-500 text-center mt-4">{error}</p>}
        </div>
      )}

      {/* Pharmacist Creation Form */}
      {tenantCreated && (
        <div className="bg-neutral-900 rounded-lg p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Create Pharmacist</h2>
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="mb-4">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-3 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-3 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div className="mb-4">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full p-3 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mb-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div className="mb-4">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <button
              onClick={handleCreatePharmacist}
              disabled={isSubmitting}
              className={`w-full py-3 bg-blue-600 text-white rounded-lg shadow-md ${isSubmitting ? 'opacity-50' : ''}`}
            >
              {isSubmitting ? <Loader2 className="animate-spin inline-block mr-2" size={20} /> : <Plus className="inline-block mr-2" size={20} />}
              {isSubmitting ? 'Creating Pharmacist...' : 'Create Pharmacist'}
            </button>
          </form>
        </div>
      )}

      {/* Toast container for notifications */}
      <ToastContainer />
    </div>
  );
}
