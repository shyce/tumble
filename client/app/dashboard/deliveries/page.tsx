'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Package, MapPin, Clock, CheckCircle, Star, Calendar, Filter } from 'lucide-react'
import Layout from '@/components/Layout'

interface DeliveryOrder {
  id: number
  customer_name: string
  pickup_address: string
  delivery_address: string
  pickup_time: string
  delivery_time: string
  completed_at: string
  items_count: number
  total_amount: number
  customer_rating?: number
  customer_tip?: number
  special_instructions?: string
}

export default function DriverDeliveriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([])
  const [loading, setLoading] = useState(true)
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
    try {
      // Mock data for now - replace with actual API call
      const mockDeliveries: DeliveryOrder[] = [
        {
          id: 1,
          customer_name: 'Sarah Johnson',
          pickup_address: '123 Oak St, City Center',
          delivery_address: '456 Pine Ave, Downtown',
          pickup_time: '2024-01-15T09:00:00Z',
          delivery_time: '2024-01-15T17:00:00Z',
          completed_at: '2024-01-15T16:45:00Z',
          items_count: 2,
          total_amount: 89.50,
          customer_rating: 5,
          customer_tip: 8.00,
          special_instructions: 'Ring doorbell, apartment 3B'
        },
        {
          id: 2,
          customer_name: 'Mike Chen',
          pickup_address: '789 Elm Dr, Suburbia',
          delivery_address: '321 Maple Rd, Uptown',
          pickup_time: '2024-01-14T10:30:00Z',
          delivery_time: '2024-01-14T18:00:00Z',
          completed_at: '2024-01-14T17:30:00Z',
          items_count: 1,
          total_amount: 45.00,
          customer_rating: 4,
          customer_tip: 5.00
        },
        {
          id: 3,
          customer_name: 'Emily Rodriguez',
          pickup_address: '555 Cedar Ln, Riverside',
          delivery_address: '888 Birch St, Hillside',
          pickup_time: '2024-01-13T14:00:00Z',
          delivery_time: '2024-01-13T19:30:00Z',
          completed_at: '2024-01-13T19:15:00Z',
          items_count: 3,
          total_amount: 120.75,
          customer_rating: 5,
          customer_tip: 12.00
        }
      ]
      setDeliveries(mockDeliveries)
    } catch (error) {
      console.error('Error loading deliveries:', error)
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTotalEarnings = () => {
    return deliveries.reduce((total, delivery) => total + (delivery.customer_tip || 0), 0)
  }

  const getAverageRating = () => {
    const ratingsDeliveries = deliveries.filter(d => d.customer_rating)
    if (ratingsDeliveries.length === 0) return 0
    const sum = ratingsDeliveries.reduce((total, delivery) => total + (delivery.customer_rating || 0), 0)
    return sum / ratingsDeliveries.length
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <Layout requireAuth={true} title="My Deliveries" subtitle="View your completed delivery history">
      <div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Deliveries</p>
                <p className="text-3xl font-bold text-gray-900">{deliveries.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tips Earned</p>
                <p className="text-3xl font-bold text-gray-900">${getTotalEarnings().toFixed(2)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Rating</p>
                <p className="text-3xl font-bold text-gray-900">{getAverageRating().toFixed(1)}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Filter and Deliveries List */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Delivery History</h2>
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as 'week' | 'month' | 'all')}
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {deliveries.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries found</h3>
                <p className="text-gray-500">Your completed deliveries will appear here</p>
              </div>
            ) : (
              deliveries.map((delivery) => (
                <div key={delivery.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Order #{delivery.id} - {delivery.customer_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Completed on {formatDate(delivery.completed_at)} at {formatTime(delivery.completed_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">${delivery.total_amount.toFixed(2)}</p>
                      {delivery.customer_tip && (
                        <p className="text-sm text-green-600">+${delivery.customer_tip.toFixed(2)} tip</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Pickup</p>
                        <p className="text-sm text-gray-600">{delivery.pickup_address}</p>
                        <p className="text-xs text-gray-500">{formatTime(delivery.pickup_time)}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Delivery</p>
                        <p className="text-sm text-gray-600">{delivery.delivery_address}</p>
                        <p className="text-xs text-gray-500">{formatTime(delivery.delivery_time)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{delivery.items_count} item{delivery.items_count !== 1 ? 's' : ''}</span>
                      </div>
                      {delivery.customer_rating && (
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm text-gray-600">{delivery.customer_rating}.0</span>
                        </div>
                      )}
                    </div>

                    {delivery.special_instructions && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Special instructions provided</p>
                      </div>
                    )}
                  </div>

                  {delivery.special_instructions && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Instructions:</strong> {delivery.special_instructions}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}