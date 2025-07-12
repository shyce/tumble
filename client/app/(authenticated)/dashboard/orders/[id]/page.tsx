'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Package, 
  Calendar, 
  Clock, 
  CheckCircle, 
  Truck, 
  AlertCircle, 
  ArrowLeft,
  MapPin,
  User,
  CreditCard,
  FileText
} from 'lucide-react'
import { orderApi, adminApi, Order, statusConfig, OrderStatus } from '@/lib/api'
import PageHeader from '@/components/PageHeader'

export default function OrderDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const orderId = params?.id as string

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    const loadOrder = async () => {
      if (status === 'loading') return
      
      if (!session) {
        router.push('/auth/signin')
        return
      }

      if (!orderId) {
        setError('Order ID is required')
        setLoading(false)
        return
      }

      try {
        const user = session.user as any
        let orderData

        if (user.role === 'admin') {
          // Admins can see any order
          const orders = await adminApi.getAllOrders(session, { limit: 1000 })
          orderData = orders.find((o: any) => o.id.toString() === orderId)
          if (!orderData) {
            setError('Order not found')
            setLoading(false)
            return
          }
        } else {
          // Regular users can only see their own orders
          const userOrders = await orderApi.getOrders(session)
          orderData = userOrders.find((o: Order) => o.id.toString() === orderId)
          
          if (!orderData) {
            // Check if user is a driver assigned to this order
            if (user.role === 'driver') {
              // TODO: Check if driver is assigned to this order via routes
              // For now, deny access
              setAccessDenied(true)
              setLoading(false)
              return
            } else {
              setAccessDenied(true)
              setLoading(false)
              return
            }
          }
        }

        setOrder(orderData)
      } catch (err) {
        console.error('Error loading order:', err)
        setError('Failed to load order details')
      } finally {
        setLoading(false)
      }
    }

    loadOrder()
  }, [session, status, router, orderId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading order details...</p>
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <>
        <PageHeader title="Access Denied" subtitle="You don't have permission to view this order" />
        <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Access Denied</h3>
          <p className="text-slate-600 mb-6">You can only view your own orders or orders you're assigned to deliver.</p>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Orders
          </Link>
        </div>
      </>
    )
  }

  if (error || !order) {
    return (
      <>
        <PageHeader title="Order Not Found" subtitle="The requested order could not be found" />
        <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Order Not Found</h3>
          <p className="text-slate-600 mb-6">{error || 'The order you\'re looking for doesn\'t exist or has been removed.'}</p>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Orders
          </Link>
        </div>
      </>
    )
  }

  const statusInfo = statusConfig[order.status] || statusConfig.pending
  const StatusIcon = statusInfo.icon
  const user = session?.user as any

  return (
    <>
      <PageHeader 
        title={`Order #${order.id}`} 
        subtitle={`Placed on ${formatDateTime(order.created_at)}`}
      />

      <div className="space-y-6">
        {/* Back Navigation */}
        <div className="flex items-center">
          <Link
            href={user?.role === 'admin' ? '/dashboard/admin/orders' : '/dashboard/orders'}
            className="inline-flex items-center text-teal-600 hover:text-teal-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Link>
        </div>

        {/* Order Status Header */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Order #{order.id}</h2>
              <p className="text-slate-600">Placed on {formatDateTime(order.created_at)}</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center ${statusInfo.color}`}>
              <StatusIcon className="w-5 h-5 mr-2" />
              {statusInfo.label}
            </div>
          </div>

          {/* Order Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pickup Date</p>
                <p className="font-semibold text-slate-900">{formatDate(order.pickup_date)}</p>
                <p className="text-xs text-slate-500">{order.pickup_time_slot}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Delivery Date</p>
                <p className="font-semibold text-slate-900">{formatDate(order.delivery_date)}</p>
                <p className="text-xs text-slate-500">{order.delivery_time_slot}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Amount</p>
                <p className="font-semibold text-slate-900">${order.total?.toFixed(2) || '0.00'}</p>
                {order.subscription_id && (
                  <p className="text-xs text-emerald-600">Subscription order</p>
                )}
              </div>
            </div>

            {user?.role === 'admin' && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Customer</p>
                  <p className="font-semibold text-slate-900">{order.user_name || 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{order.user_email}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Order Items
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {order.items.map((item: any, index: number) => {
                  const serviceName = item.service_name
                    ?.replace(/_/g, ' ')
                    ?.split(' ')
                    ?.map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    ?.join(' ') || 'Service'
                  
                  const isStandardBag = item.service_name === 'standard_bag'
                  const isPickupService = item.service_name === 'pickup_service'
                  const hasSubscriptionBenefits = order.subscription_id && item.price === 0
                  
                  let originalPrice = item.price
                  if (hasSubscriptionBenefits) {
                    if (isStandardBag) originalPrice = 45
                    if (isPickupService) originalPrice = 10
                  }
                  
                  const lineTotal = item.price * item.quantity
                  const originalLineTotal = originalPrice * item.quantity

                  return (
                    <div key={index} className="flex justify-between items-start p-4 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-slate-900">{serviceName}</h4>
                          {hasSubscriptionBenefits && (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                              Covered by Subscription
                            </span>
                          )}
                        </div>
                        
                        {hasSubscriptionBenefits ? (
                          <div className="space-y-1">
                            <p className="text-sm text-slate-500 line-through">
                              Quantity: {item.quantity} @ ${originalPrice.toFixed(2)} each
                            </p>
                            <p className="text-sm text-emerald-600 font-medium">
                              Covered by subscription - $0.00 each
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">
                            Quantity: {item.quantity} @ ${item.price.toFixed(2)} each
                          </p>
                        )}
                        
                        {item.notes && (
                          <p className="text-sm text-slate-500 italic mt-1">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right ml-4">
                        {hasSubscriptionBenefits ? (
                          <div>
                            <p className="text-sm text-slate-400 line-through">
                              ${originalLineTotal.toFixed(2)}
                            </p>
                            <p className="font-bold text-emerald-600">
                              $0.00
                            </p>
                          </div>
                        ) : (
                          <p className="font-bold text-slate-900">
                            ${lineTotal.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Order Summary
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {order.subtotal !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium text-slate-900">${order.subtotal.toFixed(2)}</span>
                </div>
              )}
              {order.subscription_id && (
                <div className="flex justify-between">
                  <span className="text-emerald-600">Subscription Discount:</span>
                  <span className="font-medium text-emerald-600">Applied</span>
                </div>
              )}
              {order.tax !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax (6%):</span>
                  <span className="font-medium text-slate-900">${order.tax.toFixed(2)}</span>
                </div>
              )}
              {order.tip !== undefined && order.tip > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Tip:</span>
                  <span className="font-medium text-slate-900">${order.tip.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-3 mt-4">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-slate-900">Total:</span>
                  <span className="text-lg font-bold text-slate-900">${order.total?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>

            {order.subscription_id && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-emerald-700 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  This order was placed using your subscription benefits
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Special Instructions */}
        {order.special_instructions && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Special Instructions
              </h3>
            </div>
            <div className="p-6">
              <p className="text-slate-700 bg-slate-50 p-4 rounded-lg">
                {order.special_instructions}
              </p>
            </div>
          </div>
        )}

        {/* Driver Information (Admin View) */}
        {user?.role === 'admin' && order.driver_name && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <Truck className="w-5 h-5 mr-2" />
                Assigned Driver
              </h3>
            </div>
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{order.driver_name}</p>
                  <p className="text-sm text-slate-600">Route Type: {order.route_type || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}