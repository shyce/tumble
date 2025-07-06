'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Package, 
  Calendar, 
  Clock, 
  CheckCircle, 
  Truck, 
  AlertCircle, 
  Filter,
  Users,
  MapPin,
  Plus,
  Search,
  Eye,
  Route,
  User,
  Phone,
  Mail
} from 'lucide-react'
import { adminApi, AdminOrder, User as UserType, DriverStats, RouteAssignmentRequest } from '@/lib/api'
import PageHeader from '@/components/PageHeader'

interface OrderStatus {
  color: string
  icon: any
  label: string
}

const statusConfig: Record<string, OrderStatus> = {
  pending: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Pending' },
  scheduled: { color: 'bg-blue-100 text-blue-800', icon: Calendar, label: 'Scheduled' },
  picked_up: { color: 'bg-orange-100 text-orange-800', icon: Truck, label: 'Picked Up' },
  in_process: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'In Process' },
  ready: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Ready' },
  out_for_delivery: { color: 'bg-indigo-100 text-indigo-800', icon: Truck, label: 'Out for Delivery' },
  delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Cancelled' }
}

export default function AdminOrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // Data states
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [drivers, setDrivers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [assignmentFilter, setAssignmentFilter] = useState<string>('')
  
  // UI states
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set())
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [showRouteAssignment, setShowRouteAssignment] = useState(false)
  const [routeAssignment, setRouteAssignment] = useState({
    driver_id: 0,
    route_date: new Date().toISOString().split('T')[0],
    route_type: 'pickup' as 'pickup' | 'delivery'
  })

  const loadData = async () => {
    if (!session) return

    try {
      setLoading(true)
      setError(null)
      const [ordersData, driversData] = await Promise.all([
        adminApi.getAllOrders(session, { 
          status: statusFilter || undefined,
          date: dateFilter || undefined,
          limit: 100 
        }),
        adminApi.getUsers(session, { role: 'driver' })
      ])

      setOrders(ordersData)
      setDrivers(driversData)
    } catch (err) {
      console.error('Error loading admin data:', err)
      setError('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      if (status === 'loading') return
      
      if (!session) {
        router.push('/auth/signin')
        return
      }

      const user = session.user as any
      if (user.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      await loadData()
    }

    checkAccessAndLoadData()
  }, [session, status, router, statusFilter, dateFilter])

  const filteredOrders = orders.filter(order => {
    // Search filter
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase()
      const matchesSearch = (
        order.id.toString().includes(searchLower) ||
        order.user_name.toLowerCase().includes(searchLower) ||
        order.user_email.toLowerCase().includes(searchLower)
      )
      if (!matchesSearch) return false
    }
    
    // Assignment filter
    if (assignmentFilter) {
      if (assignmentFilter === 'assigned' && !order.is_assigned) return false
      if (assignmentFilter === 'unassigned' && order.is_assigned) return false
    }
    
    return true
  })

  const unassignedOrders = filteredOrders.filter(order => 
    (order.status === 'scheduled' || order.status === 'pending') && !order.is_assigned
  )

  const handleOrderSelection = (orderId: number) => {
    const newSelection = new Set(selectedOrders)
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId)
    } else {
      newSelection.add(orderId)
    }
    setSelectedOrders(newSelection)
  }

  const handleRouteAssignment = async () => {
    if (!session || selectedOrders.size === 0 || !routeAssignment.driver_id) {
      return
    }

    setError(null) // Clear any previous errors
    setSuccessMessage(null)
    
    try {
      const request: RouteAssignmentRequest = {
        driver_id: routeAssignment.driver_id,
        order_ids: Array.from(selectedOrders),
        route_date: routeAssignment.route_date,
        route_type: routeAssignment.route_type
      }

      await adminApi.assignDriverToRoute(session, request)
      
      // Show success message
      const driverName = drivers.find(d => d.id === routeAssignment.driver_id)?.first_name
      setSuccessMessage(`Successfully assigned ${selectedOrders.size} orders to ${driverName}`)
      
      // Reset selections and close modal first
      setSelectedOrders(new Set())
      setShowRouteAssignment(false)
      
      // Force reload immediately
      await loadData()
      
    } catch (err) {
      console.error('Error assigning route:', err)
      setError('Failed to assign route')
    }
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Order Management" subtitle="Manage all orders and assign driver routes" />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 text-center">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-700 text-center">{successMessage}</p>
        </div>
      )}

      {/* Controls Section */}
      <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="picked_up">Picked Up</option>
                <option value="in_process">In Process</option>
                <option value="ready">Ready</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Route className="w-4 h-4 text-slate-500" />
              <select 
                value={assignmentFilter} 
                onChange={(e) => setAssignmentFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Orders</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search orders, customers..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
              />
            </div>
          </div>

          {/* Route Assignment */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">
              {selectedOrders.size} selected
            </span>
            {selectedOrders.size > 0 && (
              <button
                onClick={() => setShowRouteAssignment(true)}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-all flex items-center space-x-2"
              >
                <Route className="w-4 h-4" />
                <span>Assign Route</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Orders</p>
              <p className="text-2xl font-bold text-slate-900">{filteredOrders.length}</p>
            </div>
            <Package className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Unassigned</p>
              <p className="text-2xl font-bold text-orange-600">{unassignedOrders.length}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">
                {filteredOrders.filter(o => ['picked_up', 'in_process', 'ready', 'out_for_delivery'].includes(o.status)).length}
              </p>
            </div>
            <Truck className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredOrders.filter(o => o.status === 'delivered').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-4 px-4 font-semibold text-slate-700">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrders(new Set(unassignedOrders.map(o => o.id)))
                      } else {
                        setSelectedOrders(new Set())
                      }
                    }}
                  />
                </th>
                <th className="text-left py-4 px-4 font-semibold text-slate-700">Order</th>
                <th className="text-left py-4 px-4 font-semibold text-slate-700">Customer</th>
                <th className="text-left py-4 px-4 font-semibold text-slate-700">Status</th>
                <th className="text-left py-4 px-4 font-semibold text-slate-700">Route Assignment</th>
                <th className="text-left py-4 px-4 font-semibold text-slate-700">Pickup Date</th>
                <th className="text-left py-4 px-4 font-semibold text-slate-700">Total</th>
                <th className="text-left py-4 px-4 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrders.map((order) => {
                const statusInfo = statusConfig[order.status] || statusConfig.pending
                const StatusIcon = statusInfo.icon
                const isSelectable = (order.status === 'scheduled' || order.status === 'pending') && !order.is_assigned

                return (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="py-4 px-4">
                      {isSelectable && (
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => handleOrderSelection(order.id)}
                        />
                      )}
                    </td>
                    
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium text-slate-900">#{order.id}</div>
                        <div className="text-sm text-slate-500">{formatDateTime(order.created_at)}</div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium text-slate-900">{order.user_name}</div>
                        <div className="text-sm text-slate-500 flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          {order.user_email}
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusInfo.label}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {order.is_assigned ? (
                        <div className="flex items-center space-x-2">
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Route className="w-3 h-3 mr-1" />
                            Assigned
                          </div>
                          {order.driver_name && (
                            <div className="text-xs text-slate-600">
                              to {order.driver_name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Unassigned
                        </div>
                      )}
                    </td>
                    
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{formatDate(order.pickup_date)}</div>
                        <div className="text-xs text-slate-500">{order.pickup_time_slot}</div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-900">
                        ${order.total?.toFixed(2) || '0.00'}
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <button
                        onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                        className="text-purple-600 hover:text-purple-700 font-medium text-sm flex items-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Order #{selectedOrder.id}</h3>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Order Details Content */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-500">Customer</label>
                    <p className="text-slate-900">{selectedOrder.user_name}</p>
                    <p className="text-sm text-slate-500">{selectedOrder.user_email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-500">Status</label>
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig[selectedOrder.status]?.color}`}>
                      {statusConfig[selectedOrder.status]?.label}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-500">Pickup Date</label>
                    <p className="text-slate-900">{formatDate(selectedOrder.pickup_date)}</p>
                    <p className="text-sm text-slate-500">{selectedOrder.pickup_time_slot}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-500">Delivery Date</label>
                    <p className="text-slate-900">{formatDate(selectedOrder.delivery_date)}</p>
                    <p className="text-sm text-slate-500">{selectedOrder.delivery_time_slot}</p>
                  </div>
                </div>

                {selectedOrder.special_instructions && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Special Instructions</label>
                    <p className="text-slate-900 bg-slate-50 p-3 rounded-lg">{selectedOrder.special_instructions}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-slate-500">Total</label>
                  <p className="text-2xl font-bold text-slate-900">${selectedOrder.total?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Assignment Modal */}
      {showRouteAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Assign Route</h3>
                <button 
                  onClick={() => setShowRouteAssignment(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Driver</label>
                  <select 
                    value={routeAssignment.driver_id} 
                    onChange={(e) => setRouteAssignment({...routeAssignment, driver_id: parseInt(e.target.value)})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value={0}>Select a driver</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.first_name} {driver.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Route Date</label>
                  <input 
                    type="date" 
                    value={routeAssignment.route_date}
                    onChange={(e) => setRouteAssignment({...routeAssignment, route_date: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Route Type</label>
                  <select 
                    value={routeAssignment.route_type} 
                    onChange={(e) => setRouteAssignment({...routeAssignment, route_type: e.target.value as 'pickup' | 'delivery'})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="pickup">Pickup</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm text-slate-600">
                    Assigning {selectedOrders.size} orders to this route
                  </p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowRouteAssignment(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRouteAssignment}
                    disabled={!routeAssignment.driver_id}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Assign Route
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}