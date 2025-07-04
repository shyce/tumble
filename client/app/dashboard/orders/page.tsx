'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowLeft, Package, Calendar, Clock, CheckCircle, Truck, AlertCircle, Plus } from 'lucide-react'
import { orderApi, Order } from '@/lib/api'

interface OrderStatus {
  color: string
  icon: any
  label: string
}

const statusConfig: Record<string, OrderStatus> = {
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
  const [error, setError] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadOrders = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/auth/signin')
        return
      }

      try {
        const ordersData = await orderApi.getOrders()
        setOrders(ordersData)
      } catch (err) {
        setError('Failed to load orders')
        console.error('Error loading orders:', err)
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [router])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getOrderSummary = (order: Order) => {
    if (!order.items || order.items.length === 0) {
      return 'No items'
    }
    
    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)
    const itemTypes = order.items.map(item => {
      if (item.service_name) {
        return item.service_name.replace('_', ' ')
      }
      return 'service'
    }).join(', ')
    
    return `${totalItems} item${totalItems !== 1 ? 's' : ''}: ${itemTypes}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your orders...</p>
        </div>
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

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-center">{error}</p>
          </div>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-teal-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No orders yet</h3>
            <p className="text-slate-600 mb-6">Once you schedule your first pickup, your orders will appear here.</p>
            <Link
              href="/dashboard/schedule"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all"
            >
              <Plus className="w-5 h-5 mr-2" />
              Schedule Pickup
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {orders.map((order) => {
              const statusInfo = statusConfig[order.status] || statusConfig.scheduled
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
                        Order #{order.id}
                      </h3>
                      <p className="text-sm text-slate-600">
                        Placed on {formatDateTime(order.created_at)}
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
                      <p className="text-sm font-medium text-slate-800">{formatDate(order.pickup_date)}</p>
                      <p className="text-xs text-slate-500">{order.pickup_time_slot}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Delivery Date</p>
                      <p className="text-sm font-medium text-slate-800">{formatDate(order.delivery_date)}</p>
                      <p className="text-xs text-slate-500">{order.delivery_time_slot}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Services</p>
                      <p className="text-sm font-medium text-slate-800">{getOrderSummary(order)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-sm font-medium text-slate-800">
                        ${order.total?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>

                  {order.special_instructions && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 mb-1">Special Instructions</p>
                      <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">
                        {order.special_instructions}
                      </p>
                    </div>
                  )}

                  {/* Expanded Order Details */}
                  {selectedOrder?.id === order.id && (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-800 mb-4">Order Details</h4>
                      
                      {/* Professional Line Items */}
                      {order.items && order.items.length > 0 && (
                        <div className="mb-6">
                          <h5 className="text-sm font-semibold text-slate-800 mb-3">Order Items</h5>
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            {order.items.map((item, index) => {
                              // Format service name properly
                              const serviceName = item.service_name
                                ?.replace(/_/g, ' ')
                                ?.split(' ')
                                ?.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                ?.join(' ') || 'Service'
                              
                              const lineTotal = item.price * item.quantity
                              
                              return (
                                <div key={index} className={`px-4 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-medium text-slate-900">{serviceName}</div>
                                      <div className="text-sm text-slate-600 mt-1">
                                        Quantity: {item.quantity} @ ${item.price.toFixed(2)} each
                                      </div>
                                      {item.notes && (
                                        <div className="text-xs text-slate-500 mt-1 italic">
                                          Note: {item.notes}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right ml-4">
                                      <div className="font-semibold text-slate-900">
                                        ${lineTotal.toFixed(2)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Professional Summary */}
                      <div className="border border-slate-200 rounded-lg">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                          <h6 className="text-sm font-semibold text-slate-800">Order Summary</h6>
                        </div>
                        <div className="p-4 space-y-2">
                          {order.subtotal !== undefined && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Subtotal:</span>
                              <span className="text-slate-900 font-medium">${order.subtotal.toFixed(2)}</span>
                            </div>
                          )}
                          {order.subscription_id && (
                            <div className="flex justify-between text-sm">
                              <span className="text-emerald-600">Subscription Discount:</span>
                              <span className="text-emerald-600 font-medium">Applied</span>
                            </div>
                          )}
                          {order.tax !== undefined && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Tax (8%):</span>
                              <span className="text-slate-900 font-medium">${order.tax.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="border-t border-slate-200 pt-2 mt-3">
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-900">Total:</span>
                              <span className="font-bold text-slate-900">${order.total?.toFixed(2) || '0.00'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Subscription Info */}
                      {order.subscription_id && (
                        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <p className="text-sm text-emerald-700">
                            💳 This order was placed using your subscription benefits
                          </p>
                        </div>
                      )}
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