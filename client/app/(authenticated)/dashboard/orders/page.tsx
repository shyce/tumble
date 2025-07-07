'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, Calendar, Clock, CheckCircle, Truck, AlertCircle, Plus } from 'lucide-react'
import { orderApi, Order, statusConfig, OrderStatus } from '@/lib/api'
import PageHeader from '@/components/PageHeader'

export default function CustomerOrdersPage() {
  const { data: session, status } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadOrders = async () => {
      if (status === 'loading') return
      
      if (!session) {
        router.push('/auth/signin')
        return
      }

      // Redirect admins to admin orders page
      const user = session.user as any
      if (user.role === 'admin') {
        router.push('/dashboard/admin/orders')
        return
      }

      try {
        const ordersData = await orderApi.getOrders(session)
        setOrders(ordersData)
      } catch (err) {
        setError('Failed to load orders')
        console.error('Error loading orders:', err)
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [session, status, router])

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
    <>
      <PageHeader title="Order History" subtitle="Track your current and past laundry orders" />

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
                <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                  <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
                
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

                  <div className="mt-4 text-center">
                    <span className="text-sm text-teal-600 hover:text-teal-700 font-medium">
                      Click to view details →
                    </span>
                  </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
    </>
  )
}