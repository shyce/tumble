'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { TumbleInput } from '@/components/ui/tumble-input';
import { TumbleButton } from '@/components/ui/tumble-button';
import { TumbleTextarea } from '@/components/ui/tumble-textarea';
import { TumbleSelect } from '@/components/ui/tumble-select';

export default function ApplyDriverPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    licenseNumber: '',
    licenseState: '',
    vehicleYear: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    insuranceProvider: '',
    insurancePolicyId: '',
    experience: '',
    availability: '',
    whyInterested: ''
  });

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/driver-applications/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any)?.accessToken}`
        },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          license_number: formData.licenseNumber,
          license_state: formData.licenseState,
          vehicle_year: formData.vehicleYear,
          vehicle_make: formData.vehicleMake,
          vehicle_model: formData.vehicleModel,
          vehicle_color: formData.vehicleColor,
          insurance_provider: formData.insuranceProvider,
          insurance_policy_id: formData.insurancePolicyId,
          experience: formData.experience,
          availability: formData.availability,
          why_interested: formData.whyInterested
        })
      });

      if (response.ok) {
        setSuccess(true);
      } else {
        const errorData = await response.text();
        setError(errorData || 'Failed to submit application');
      }
    } catch (err) {
      setError('Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (success) {
    return (
      <>
        <PageHeader title="Application Submitted" subtitle="Thank you for your interest in becoming a driver" />
        <div className="flex items-center justify-center min-h-96">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Application Submitted!</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Thank you for your interest in becoming a Tumble driver. We'll review your application and get back to you soon.
            </p>
            <TumbleButton
              onClick={() => router.push('/dashboard')}
              variant="default"
              size="lg"
              className="w-full"
            >
              Back to Dashboard
            </TumbleButton>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Apply to be a Driver" subtitle="Join our driver network and start earning with Tumble" />
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TumbleInput
                  type="text"
                  name="firstName"
                  label="First Name *"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                />
                <TumbleInput
                  type="text"
                  name="lastName"
                  label="Last Name *"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                />
                <TumbleInput
                  type="tel"
                  name="phone"
                  label="Phone Number *"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Driver's License */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">Driver's License</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TumbleInput
                  type="text"
                  name="licenseNumber"
                  label="License Number *"
                  required
                  value={formData.licenseNumber}
                  onChange={handleChange}
                />
                <TumbleInput
                  type="text"
                  name="licenseState"
                  label="License State *"
                  required
                  value={formData.licenseState}
                  onChange={handleChange}
                  placeholder="CA"
                  maxLength={2}
                />
              </div>
            </div>

            {/* Vehicle Information */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">Vehicle Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TumbleInput
                  type="text"
                  name="vehicleYear"
                  label="Year"
                  value={formData.vehicleYear}
                  onChange={handleChange}
                  placeholder="2020"
                />
                <TumbleInput
                  type="text"
                  name="vehicleMake"
                  label="Make"
                  value={formData.vehicleMake}
                  onChange={handleChange}
                  placeholder="Toyota"
                />
                <TumbleInput
                  type="text"
                  name="vehicleModel"
                  label="Model"
                  value={formData.vehicleModel}
                  onChange={handleChange}
                  placeholder="Camry"
                />
                <TumbleInput
                  type="text"
                  name="vehicleColor"
                  label="Color"
                  value={formData.vehicleColor}
                  onChange={handleChange}
                  placeholder="Silver"
                />
              </div>
            </div>

            {/* Insurance Information */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">Insurance Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TumbleInput
                  type="text"
                  name="insuranceProvider"
                  label="Insurance Provider"
                  value={formData.insuranceProvider}
                  onChange={handleChange}
                  placeholder="State Farm"
                />
                <TumbleInput
                  type="text"
                  name="insurancePolicyId"
                  label="Policy ID"
                  value={formData.insurancePolicyId}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Experience and Availability */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">Experience & Availability</h2>
              <div className="space-y-4">
                <TumbleTextarea
                  name="experience"
                  label="Driving Experience"
                  rows={3}
                  value={formData.experience}
                  onChange={handleChange}
                  placeholder="Tell us about your driving experience..."
                />
                <TumbleTextarea
                  name="availability"
                  label="Availability"
                  rows={3}
                  value={formData.availability}
                  onChange={handleChange}
                  placeholder="What days and times are you available to work?"
                />
                <TumbleTextarea
                  name="whyInterested"
                  label="Why are you interested in being a Tumble driver?"
                  rows={3}
                  value={formData.whyInterested}
                  onChange={handleChange}
                  placeholder="Tell us why you want to work with Tumble..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-slate-200">
              <TumbleButton
                type="submit"
                disabled={loading}
                size="lg"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </TumbleButton>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}