'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MapPin, Clock, Package, CheckCircle, Navigation, Phone, Home } from 'lucide-react'
import Layout from '@/components/Layout'

interface Order {
  id: number
  customer_name: string
  pickup_address: string
  delivery_address: string
  pickup_time: string
  delivery_time: string
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered'
  special_instructions?: string
  customer_phone?: string
  items_count: number
}

export default function DriverRoutesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed'>('today')

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
    try {
      const response = await fetch('/api/v1/driver/routes', {
        headers: {
          'Authorization': `Bearer ${(session as any)?.accessToken}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      }
    } catch (error) {
      console.error('Error loading driver routes:', error)
      // Mock data for demonstration
      setOrders([
        {
          id: 1,
          customer_name: 'Sarah Johnson',
          pickup_address: '123 Oak St, City Center',
          delivery_address: '456 Pine Ave, Downtown',
          pickup_time: '2024-01-15T09:00:00Z',
          delivery_time: '2024-01-15T17:00:00Z',
          status: 'assigned',
          customer_phone: '+1-555-0123',
          items_count: 2,
          special_instructions: 'Ring doorbell, apartment 3B'
        },
        {
          id: 2,
          customer_name: 'Mike Chen',
          pickup_address: '789 Elm Dr, Suburbia',
          delivery_address: '321 Maple Rd, Uptown',
          pickup_time: '2024-01-15T10:30:00Z',
          delivery_time: '2024-01-15T18:00:00Z',
          status: 'picked_up',
          customer_phone: '+1-555-0456',
          items_count: 1
        },
        {
          id: 3,
          customer_name: 'Emily Rodriguez',
          pickup_address: '555 Cedar Ln, Riverside',
          delivery_address: '888 Birch St, Hillside',
          pickup_time: '2024-01-15T14:00:00Z',
          delivery_time: '2024-01-15T19:30:00Z',
          status: 'in_transit',
          customer_phone: '+1-555-0789',
          items_count: 3
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: number, newStatus: Order['status']) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })
      
      if (response.ok) {
        setOrders(orders.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        ))
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      // Update locally for demo
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ))
    }
  }

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800'
      case 'picked_up': return 'bg-yellow-100 text-yellow-800'
      case 'in_transit': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getNextStatus = (currentStatus: Order['status']) => {
    switch (currentStatus) {
      case 'assigned': return 'picked_up'
      case 'picked_up': return 'in_transit'
      case 'in_transit': return 'delivered'
      default: return null
    }
  }

  const getNextStatusLabel = (currentStatus: Order['status']) => {
    switch (currentStatus) {
      case 'assigned': return 'Mark as Picked Up'
      case 'picked_up': return 'Mark as In Transit'
      case 'in_transit': return 'Mark as Delivered'
      default: return null
    }
  }

  const filteredOrders = orders.filter(order => {
    const today = new Date().toDateString()
    const pickupDate = new Date(order.pickup_time).toDateString()
    
    switch (activeTab) {
      case 'today': return pickupDate === today
      case 'upcoming': return new Date(order.pickup_time) > new Date()
      case 'completed': return order.status === 'delivered'
      default: return true
    }
  })

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <Layout requireAuth={true} title="My Routes" subtitle="Manage your pickup and delivery routes">
      <div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {(['today', 'upcoming', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab} ({filteredOrders.length})
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No routes found</h3>
              <p className="text-gray-500">
                {activeTab === 'today' && "You don't have any routes scheduled for today."}
                {activeTab === 'upcoming' && "No upcoming routes scheduled."}
                {activeTab === 'completed' && "No completed deliveries yet."}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-6">
                  {/* Order Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-xl font-semibold text-slate-900">
                        Order #{order.id}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Package className="w-4 h-4" />
                      <span>{order.items_count} item{order.items_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-4">
                    <h4 className="font-medium text-slate-900 mb-2">Customer: {order.customer_name}</h4>
                    {order.customer_phone && (
                      <div className="flex items-center space-x-2 text-slate-600">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${order.customer_phone}`} className="hover:text-blue-600">
                          {order.customer_phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Route Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    {/* Pickup */}
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Home className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h5 className="font-medium text-slate-900">Pickup</h5>
                        <p className="text-slate-600 text-sm">{order.pickup_address}</p>
                        <div className="flex items-center space-x-1 text-slate-500 text-sm mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(order.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery */}
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <h5 className="font-medium text-slate-900">Delivery</h5>
                        <p className="text-slate-600 text-sm">{order.delivery_address}</p>
                        <div className="flex items-center space-x-1 text-slate-500 text-sm mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(order.delivery_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Special Instructions */}
                  {order.special_instructions && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h6 className="font-medium text-yellow-800 mb-1">Special Instructions</h6>
                      <p className="text-yellow-700 text-sm">{order.special_instructions}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div className="flex space-x-3">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(order.pickup_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                      >
                        <Navigation className="w-4 h-4" />
                        <span className="text-sm">Navigate to Pickup</span>
                      </a>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(order.delivery_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 text-green-600 hover:text-green-700"
                      >
                        <Navigation className="w-4 h-4" />
                        <span className="text-sm">Navigate to Delivery</span>
                      </a>
                    </div>

                    {getNextStatus(order.status) && (
                      <button
                        onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">{getNextStatusLabel(order.status)}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}