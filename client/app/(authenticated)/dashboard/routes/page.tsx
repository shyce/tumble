'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MapPin, Clock, Package, CheckCircle, Navigation, Phone, Home, Truck, AlertCircle } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { driverApi } from '@/lib/api'

interface DriverRoute {
  id: number
  driver_id: number
  route_date: string
  route_type: string
  status: string
  orders: RouteOrder[]
  created_at: string
  updated_at: string
}

interface RouteOrder {
  id: number
  order_id: number
  sequence_number: number
  status: string
  customer_name: string
  customer_phone: string
  address: string
  special_instructions?: string
  pickup_time_slot?: string
  delivery_time_slot?: string
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Failed' }
}

const routeStatusConfig: Record<string, { color: string; icon: any; label: string }> = {
  planned: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Planned' },
  in_progress: { color: 'bg-orange-100 text-orange-800', icon: Truck, label: 'In Progress' },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Cancelled' }
}

export default function DriverRoutesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [routes, setRoutes] = useState<DriverRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

    loadDriverRoutes()
  }, [session, status, router])

  const loadDriverRoutes = async () => {
    if (!session) return
    
    try {
      setLoading(true)
      setError(null)
      const routesData = await driverApi.getRoutes(session)
      setRoutes(routesData)
    } catch (err) {
      console.error('Error loading driver routes:', err)
      setError('Failed to load routes')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your routes...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="My Routes" subtitle="View and manage your assigned delivery routes" />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 text-center">{error}</p>
        </div>
      )}

      {/* Routes List */}
      {routes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Truck className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">No routes assigned</h3>
          <p className="text-slate-600 mb-6">You don't have any routes assigned yet. Check back later or contact your dispatcher.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {routes.map((route) => {
            const routeStatusInfo = routeStatusConfig[route.status] || routeStatusConfig.planned
            const RouteStatusIcon = routeStatusInfo.icon

            return (
              <div key={route.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Route Header */}
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold mb-1">
                        {route.route_type.charAt(0).toUpperCase() + route.route_type.slice(1)} Route #{route.id}
                      </h3>
                      <p className="text-blue-100">
                        {formatDate(route.route_date)} • {route.orders.length} stops
                      </p>
                    </div>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${routeStatusInfo.color} bg-white`}>
                      <RouteStatusIcon className="w-4 h-4 mr-1" />
                      {routeStatusInfo.label}
                    </div>
                  </div>
                </div>

                {/* Orders in Route */}
                <div className="p-6">
                  <div className="space-y-4">
                    {route.orders.map((order, index) => {
                      const statusInfo = statusConfig[order.status] || statusConfig.pending
                      const StatusIcon = statusInfo.icon

                      return (
                        <div key={order.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                {order.sequence_number}
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-900">{order.customer_name}</h4>
                                <p className="text-sm text-slate-600">Order #{order.order_id}</p>
                              </div>
                            </div>
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusInfo.label}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div className="flex items-start space-x-2">
                              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-slate-700">Address</p>
                                <p className="text-sm text-slate-600">{order.address}</p>
                              </div>
                            </div>

                            {order.customer_phone && (
                              <div className="flex items-start space-x-2">
                                <Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-slate-700">Phone</p>
                                  <p className="text-sm text-slate-600">{order.customer_phone}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {(order.pickup_time_slot || order.delivery_time_slot) && (
                            <div className="flex items-center space-x-2 mb-3">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <p className="text-sm text-slate-600">
                                Time Slot: {order.pickup_time_slot || order.delivery_time_slot}
                              </p>
                            </div>
                          )}

                          {order.special_instructions && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <p className="text-sm font-medium text-amber-800 mb-1">Special Instructions</p>
                              <p className="text-sm text-amber-700">{order.special_instructions}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}