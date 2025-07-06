'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Package, MapPin, Clock, CheckCircle, Star, Calendar, Filter, Truck } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { driverApi } from '@/lib/api'

interface CompletedDelivery {
  id: number
  order_id: number
  customer_name: string
  address: string
  customer_phone?: string
  special_instructions?: string
  pickup_time_slot?: string
  delivery_time_slot?: string
  route_id: number
  route_type: string
  route_date: string
  sequence_number: number
  status: string
}

export default function DriverDeliveriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [deliveries, setDeliveries] = useState<CompletedDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterPeriod, setFilterPeriod] = useState<'week' | 'month' | 'all'>('week')

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    const user = session.user as any
    if (user.role !== 'driver') {
      router.push('/dashboard')
      return
    }

    loadDeliveries()
  }, [session, status, router, filterPeriod])

  const loadDeliveries = async () => {
    if (!session) return

    try {
      setLoading(true)
      setError(null)
      const deliveriesData = await driverApi.getCompletedDeliveries(session, { period: filterPeriod })
      setDeliveries(deliveriesData)
    } catch (err) {
      console.error('Error loading deliveries:', err)
      setError('Failed to load deliveries')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getFilterLabel = (period: string) => {
    switch (period) {
      case 'week': return 'This Week'
      case 'month': return 'This Month'
      case 'all': return 'All Time'
      default: return period
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your deliveries...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="My Deliveries" subtitle="View your completed pickups and deliveries" />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 text-center">{error}</p>
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Delivery History</h3>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select 
              value={filterPeriod} 
              onChange={(e) => setFilterPeriod(e.target.value as 'week' | 'month' | 'all')}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Completed</p>
              <p className="text-2xl font-bold text-slate-900">{deliveries.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Pickups</p>
              <p className="text-2xl font-bold text-blue-600">
                {deliveries.filter(d => d.route_type === 'pickup').length}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Deliveries</p>
              <p className="text-2xl font-bold text-purple-600">
                {deliveries.filter(d => d.route_type === 'delivery').length}
              </p>
            </div>
            <Truck className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      {deliveries.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">No deliveries yet</h3>
          <p className="text-slate-600 mb-6">
            Complete some pickups and deliveries to see them here. Your delivery history for {getFilterLabel(filterPeriod).toLowerCase()} will appear in this section.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((delivery) => (
            <div key={`${delivery.route_id}-${delivery.id}`} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                    delivery.route_type === 'pickup' ? 'bg-blue-500' : 'bg-purple-500'
                  }`}>
                    {delivery.route_type === 'pickup' ? <Package className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{delivery.customer_name}</h4>
                    <p className="text-sm text-slate-600">
                      {delivery.route_type === 'pickup' ? 'Pickup' : 'Delivery'} • Order #{delivery.order_id}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completed
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(delivery.route_date)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Address</p>
                    <p className="text-sm text-slate-600">{delivery.address}</p>
                  </div>
                </div>

                {(delivery.pickup_time_slot || delivery.delivery_time_slot) && (
                  <div className="flex items-start space-x-2">
                    <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">Time Slot</p>
                      <p className="text-sm text-slate-600">
                        {delivery.pickup_time_slot || delivery.delivery_time_slot}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {delivery.special_instructions && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-800 mb-1">Special Instructions</p>
                  <p className="text-sm text-amber-700">{delivery.special_instructions}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}