'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowLeft, Package, Calendar, Clock, CheckCircle, Truck, AlertCircle } from 'lucide-react'

interface Order {
  id: string
  orderNumber: string
  status: 'scheduled' | 'picked_up' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled'
  pickupDate: string
  deliveryDate: string
  bags: number
  bagType: 'standard' | 'rush'
  totalPrice: number
  addOns: string[]
  createdAt: string
  trackingEvents: TrackingEvent[]
}

interface TrackingEvent {
  id: string
  status: string
  timestamp: string
  description: string
}

// Mock data - will be replaced with API calls
const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'TUM-2024-001',
    status: 'delivered',
    pickupDate: '2024-01-15',
    deliveryDate: '2024-01-17',
    bags: 2,
    bagType: 'standard',
    totalPrice: 90,
    addOns: [],
    createdAt: '2024-01-14',
    trackingEvents: [
      { id: '1', status: 'scheduled', timestamp: '2024-01-14T10:00:00Z', description: 'Order scheduled' },
      { id: '2', status: 'picked_up', timestamp: '2024-01-15T09:30:00Z', description: 'Laundry picked up by driver' },
      { id: '3', status: 'processing', timestamp: '2024-01-15T14:00:00Z', description: 'Laundry being processed' },
      { id: '4', status: 'out_for_delivery', timestamp: '2024-01-17T08:00:00Z', description: 'Out for delivery' },
      { id: '5', status: 'delivered', timestamp: '2024-01-17T10:15:00Z', description: 'Delivered successfully' }
    ]
  },
  {
    id: '2',
    orderNumber: 'TUM-2024-002',
    status: 'processing',
    pickupDate: '2024-01-22',
    deliveryDate: '2024-01-24',
    bags: 2,
    bagType: 'standard',
    totalPrice: 96,
    addOns: ['Sensitive Skin Detergent', 'Scent Booster'],
    createdAt: '2024-01-21',
    trackingEvents: [
      { id: '1', status: 'scheduled', timestamp: '2024-01-21T15:00:00Z', description: 'Order scheduled' },
      { id: '2', status: 'picked_up', timestamp: '2024-01-22T09:00:00Z', description: 'Laundry picked up by driver' },
      { id: '3', status: 'processing', timestamp: '2024-01-22T13:30:00Z', description: 'Laundry being processed' }
    ]
  }
]

const statusConfig = {
  scheduled: { color: 'bg-blue-100 text-blue-800', icon: Calendar, label: 'Scheduled' },
  picked_up: { color: 'bg-orange-100 text-orange-800', icon: Truck, label: 'Picked Up' },
  processing: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Processing' },
  out_for_delivery: { color: 'bg-purple-100 text-purple-800', icon: Truck, label: 'Out for Delivery' },
  delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Cancelled' }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setOrders(mockOrders)
      setLoading(false)
    }, 500)
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center space-x-3">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg">
                    <Sparkles className="text-white w-5 h-5" />
                  </div>
                  <span className="text-slate-800 font-bold text-xl tracking-tight">Tumble</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Order History</h1>
          <p className="text-lg text-slate-600">Track your current and past laundry orders</p>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-teal-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No orders yet</h3>
            <p className="text-slate-600 mb-6">Once you schedule your first pickup, your orders will appear here.</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {orders.map((order) => {
              const statusInfo = statusConfig[order.status]
              const StatusIcon = statusInfo.icon

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-1">
                        Order #{order.orderNumber}
                      </h3>
                      <p className="text-sm text-slate-600">
                        Placed on {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${statusInfo.color}`}>
                      <StatusIcon className="w-4 h-4 mr-1" />
                      {statusInfo.label}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500">Pickup Date</p>
                      <p className="text-sm font-medium text-slate-800">{formatDate(order.pickupDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Delivery Date</p>
                      <p className="text-sm font-medium text-slate-800">{formatDate(order.deliveryDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Items</p>
                      <p className="text-sm font-medium text-slate-800">
                        {order.bags} {order.bagType} {order.bags === 1 ? 'bag' : 'bags'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-sm font-medium text-slate-800">${order.totalPrice}</p>
                    </div>
                  </div>

                  {order.addOns.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 mb-1">Add-ons</p>
                      <div className="flex flex-wrap gap-2">
                        {order.addOns.map((addon, index) => (
                          <span key={index} className="px-2 py-1 bg-teal-50 text-teal-700 text-xs rounded-full">
                            {addon}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded Tracking Details */}
                  {selectedOrder?.id === order.id && (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-800 mb-4">Tracking History</h4>
                      <div className="space-y-3">
                        {order.trackingEvents.map((event, index) => {
                          const eventStatus = statusConfig[event.status as keyof typeof statusConfig]
                          const EventIcon = eventStatus?.icon || Clock
                          
                          return (
                            <div key={event.id} className="flex items-start space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                index === 0 ? 'bg-teal-100' : 'bg-slate-100'
                              }`}>
                                <EventIcon className={`w-4 h-4 ${
                                  index === 0 ? 'text-teal-600' : 'text-slate-600'
                                }`} />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800">{event.description}</p>
                                <p className="text-xs text-slate-500">{formatTime(event.timestamp)}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 text-center">
                    <button className="text-sm text-teal-600 hover:text-teal-700 font-medium">
                      {selectedOrder?.id === order.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}