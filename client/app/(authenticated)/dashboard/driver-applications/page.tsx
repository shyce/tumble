'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { TumbleButton } from '@/components/ui/tumble-button';
import { TumbleIconButton } from '@/components/ui/tumble-icon-button';

interface DriverApplication {
  id: number;
  user_id: number;
  status: 'pending' | 'approved' | 'rejected';
  application_data: {
    first_name: string;
    last_name: string;
    phone: string;
    license_number: string;
    license_state: string;
    vehicle_year?: string;
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_color?: string;
    insurance_provider?: string;
    insurance_policy_id?: string;
    experience?: string;
    availability?: string;
    why_interested?: string;
  };
  admin_notes?: string;
  reviewed_by?: number;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  user_email: string;
  user_name: string;
}

export default function DriverApplicationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState<DriverApplication | null>(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({ status: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    
    const user = session.user as any;
    if (user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    
    fetchApplications();
  }, [session, status, statusFilter]);

  const fetchApplications = async () => {
    try {
      const url = new URL('/api/v1/admin/driver-applications', window.location.origin);
      if (statusFilter !== 'all') {
        url.searchParams.set('status', statusFilter);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${(session as any)?.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApplications(data);
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!selectedApp || !reviewData.status) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/admin/driver-applications/review?id=${selectedApp.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any)?.accessToken}`
        },
        body: JSON.stringify({
          status: reviewData.status,
          admin_notes: reviewData.notes
        })
      });

      if (response.ok) {
        setReviewModal(false);
        setSelectedApp(null);
        setReviewData({ status: '', notes: '' });
        fetchApplications();
      }
    } catch (error) {
      console.error('Failed to review application:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return `px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`;
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <PageHeader title="Driver Applications" subtitle="Review and manage driver applications" />
      {/* Filters */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value="all">All Applications</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Applicant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                License
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Applied
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {applications.map((app) => (
              <tr key={app.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {app.application_data.first_name} {app.application_data.last_name}
                    </div>
                    <div className="text-sm text-gray-500">{app.user_email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {app.application_data.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {app.application_data.license_number} ({app.application_data.license_state})
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={getStatusBadge(app.status)}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(app.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <TumbleButton
                    onClick={() => setSelectedApp(app)}
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    View Details
                  </TumbleButton>
                  {app.status === 'pending' && (
                    <TumbleButton
                      onClick={() => {
                        setSelectedApp(app);
                        setReviewModal(true);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-green-600 hover:text-green-900"
                    >
                      Review
                    </TumbleButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Application Details Modal */}
      {selectedApp && !reviewModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Application Details - {selectedApp.application_data.first_name} {selectedApp.application_data.last_name}
                </h3>
                <TumbleIconButton
                  onClick={() => setSelectedApp(null)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </TumbleIconButton>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-sm text-gray-900">{selectedApp.user_email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="text-sm text-gray-900">{selectedApp.application_data.phone}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">License Number</label>
                    <p className="text-sm text-gray-900">{selectedApp.application_data.license_number}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">License State</label>
                    <p className="text-sm text-gray-900">{selectedApp.application_data.license_state}</p>
                  </div>
                </div>

                {selectedApp.application_data.vehicle_make && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Vehicle</label>
                    <p className="text-sm text-gray-900">
                      {selectedApp.application_data.vehicle_year} {selectedApp.application_data.vehicle_make} {selectedApp.application_data.vehicle_model} ({selectedApp.application_data.vehicle_color})
                    </p>
                  </div>
                )}

                {selectedApp.application_data.experience && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Experience</label>
                    <p className="text-sm text-gray-900">{selectedApp.application_data.experience}</p>
                  </div>
                )}

                {selectedApp.application_data.availability && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Availability</label>
                    <p className="text-sm text-gray-900">{selectedApp.application_data.availability}</p>
                  </div>
                )}

                {selectedApp.application_data.why_interested && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Why Interested</label>
                    <p className="text-sm text-gray-900">{selectedApp.application_data.why_interested}</p>
                  </div>
                )}

                {selectedApp.admin_notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Admin Notes</label>
                    <p className="text-sm text-gray-900">{selectedApp.admin_notes}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <TumbleButton
                  onClick={() => setSelectedApp(null)}
                  variant="secondary"
                >
                  Close
                </TumbleButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && selectedApp && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Review Application - {selectedApp.application_data.first_name} {selectedApp.application_data.last_name}
                </h3>
                <TumbleIconButton
                  onClick={() => setReviewModal(false)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </TumbleIconButton>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Decision</label>
                  <select
                    value={reviewData.status}
                    onChange={(e) => setReviewData({ ...reviewData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Decision</option>
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={reviewData.notes}
                    onChange={(e) => setReviewData({ ...reviewData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes about your decision..."
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4 mt-6">
                <TumbleButton
                  onClick={() => setReviewModal(false)}
                  variant="secondary"
                >
                  Cancel
                </TumbleButton>
                <TumbleButton
                  onClick={handleReview}
                  disabled={!reviewData.status || submitting}
                  variant="default"
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </TumbleButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}