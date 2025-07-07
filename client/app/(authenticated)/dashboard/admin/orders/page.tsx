'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { adminApi, AdminOrder, User as UserType, DriverStats, RouteAssignmentRequest, BulkStatusUpdateRequest, OptimizationSuggestionsRequest, OptimizationSuggestionsResponse, statusConfig, OrderStatus, CreateOrderResolutionRequest } from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import { TumbleButton } from '@/components/ui/tumble-button'
import { TumbleIconButton } from '@/components/ui/tumble-icon-button'
import {
  TumbleDialog,
  TumbleDialogContent,
  TumbleDialogDescription,
  TumbleDialogFooter,
  TumbleDialogHeader,
  TumbleDialogTitle,
  TumbleDialogBody,
} from '@/components/ui/tumble-dialog'

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
  const [showBulkStatusUpdate, setShowBulkStatusUpdate] = useState(false)
  const [showOptimizationSuggestions, setShowOptimizationSuggestions] = useState(false)
  const [showFailedOrderResolution, setShowFailedOrderResolution] = useState(false)
  const [failedOrderToResolve, setFailedOrderToResolve] = useState<AdminOrder | null>(null)
  const [routeAssignment, setRouteAssignment] = useState({
    driver_id: 0,
    route_date: new Date().toISOString().split('T')[0],
    route_type: 'pickup' as 'pickup' | 'delivery'
  })
  const [bulkStatusUpdate, setBulkStatusUpdate] = useState({
    status: '',
    notes: ''
  })
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<OptimizationSuggestionsResponse | null>(null)
  const [failedOrderResolution, setFailedOrderResolution] = useState({
    resolution_type: '',
    reschedule_date: new Date().toISOString().split('T')[0],
    refund_amount: 0,
    notes: ''
  })

  const loadData = useCallback(async () => {
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
  }, [session, statusFilter, dateFilter])

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    const user = session.user as any
    if (user.role !== 'admin') {
      router.push('/dashboard')
      return
    }

    loadData()
  }, [session, status, router, loadData])

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

  const selectableOrders = filteredOrders.filter(order => 
    !order.is_assigned || order.status === 'ready' || order.status === 'in_process'
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

  const handleBulkStatusUpdate = async () => {
    if (!session || selectedOrders.size === 0 || !bulkStatusUpdate.status) {
      return
    }

    setError(null)
    setSuccessMessage(null)
    
    try {
      const request: BulkStatusUpdateRequest = {
        order_ids: Array.from(selectedOrders),
        status: bulkStatusUpdate.status,
        notes: bulkStatusUpdate.notes
      }

      const result = await adminApi.bulkUpdateOrderStatus(session, request)
      setSuccessMessage(`Successfully updated ${result.updated_count} orders to ${bulkStatusUpdate.status}`)
      
      // Reset selections and close modal
      setSelectedOrders(new Set())
      setShowBulkStatusUpdate(false)
      setBulkStatusUpdate({ status: '', notes: '' })
      
      // Reload data
      await loadData()
      
    } catch (err) {
      console.error('Error updating order status:', err)
      setError('Failed to update order status')
    }
  }

  const handleGetOptimizationSuggestions = async () => {
    if (!session || selectedOrders.size === 0) {
      return
    }

    setError(null)
    
    try {
      const request: OptimizationSuggestionsRequest = {
        order_ids: Array.from(selectedOrders)
      }

      const suggestions = await adminApi.getOptimizationSuggestions(session, request)
      setOptimizationSuggestions(suggestions)
      setShowOptimizationSuggestions(true)
      
    } catch (err) {
      console.error('Error getting optimization suggestions:', err)
      setError('Failed to get optimization suggestions')
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
                <option value="failed">Failed</option>
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

          {/* Bulk Actions */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">
              {selectedOrders.size} selected
            </span>
            {selectedOrders.size > 0 && (
              <div className="flex items-center gap-2">
                <TumbleIconButton
                  onClick={() => setShowRouteAssignment(true)}
                  variant="default"
                  size="default"
                  tooltip="Assign or reassign selected orders to a driver route"
                  tooltipSide="bottom"
                >
                  <Route className="w-4 h-4" />
                </TumbleIconButton>
                <TumbleIconButton
                  onClick={() => setShowBulkStatusUpdate(true)}
                  variant="outline"
                  size="default"
                  tooltip="Update status of all selected orders at once"
                  tooltipSide="bottom"
                >
                  <CheckCircle className="w-4 h-4" />
                </TumbleIconButton>
                <TumbleIconButton
                  onClick={handleGetOptimizationSuggestions}
                  variant="secondary"
                  size="default"
                  tooltip="Get route optimization suggestions based on location and time"
                  tooltipSide="bottom"
                >
                  <MapPin className="w-4 h-4" />
                </TumbleIconButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
              <p className="text-sm text-slate-500">Available to Assign</p>
              <p className="text-2xl font-bold text-orange-600">{selectableOrders.length}</p>
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

        <div className="bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">
                {filteredOrders.filter(o => o.status === 'failed').length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-2 sm:py-4 sm:px-4 font-semibold text-slate-700 w-8">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrders(new Set(selectableOrders.map(o => o.id)))
                      } else {
                        setSelectedOrders(new Set())
                      }
                    }}
                  />
                </th>
                <th className="text-left py-3 px-2 sm:py-4 sm:px-4 font-semibold text-slate-700 min-w-[120px]">Order</th>
                <th className="text-left py-3 px-2 sm:py-4 sm:px-4 font-semibold text-slate-700 min-w-[150px]">Customer</th>
                <th className="text-left py-3 px-2 sm:py-4 sm:px-4 font-semibold text-slate-700 min-w-[100px]">Status</th>
                <th className="text-left py-3 px-2 sm:py-4 sm:px-4 font-semibold text-slate-700 min-w-[140px] hidden md:table-cell">Route Assignment</th>
                <th className="text-left py-3 px-2 sm:py-4 sm:px-4 font-semibold text-slate-700 min-w-[120px]">Pickup Date</th>
                <th className="text-left py-3 px-2 sm:py-4 sm:px-4 font-semibold text-slate-700 min-w-[80px]">Total</th>
                <th className="text-left py-3 px-2 sm:py-4 sm:px-4 font-semibold text-slate-700 min-w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrders.map((order) => {
                const statusInfo = statusConfig[order.status] || statusConfig.pending
                const StatusIcon = statusInfo.icon
                const isSelectable = !order.is_assigned || order.status === 'ready' || order.status === 'in_process'

                return (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="py-3 px-2 sm:py-4 sm:px-4">
                      {isSelectable && (
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => handleOrderSelection(order.id)}
                        />
                      )}
                    </td>
                    
                    <td className="py-3 px-2 sm:py-4 sm:px-4">
                      <div>
                        <div className="font-medium text-slate-900">#{order.id}</div>
                        <div className="text-xs sm:text-sm text-slate-500">{formatDateTime(order.created_at)}</div>
                      </div>
                    </td>
                    
                    <td className="py-3 px-2 sm:py-4 sm:px-4">
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{order.user_name}</div>
                        <div className="text-xs text-slate-500 flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{order.user_email}</span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-3 px-2 sm:py-4 sm:px-4">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">{statusInfo.label}</span>
                        <span className="sm:hidden">{statusInfo.label.slice(0, 4)}</span>
                      </div>
                    </td>

                    <td className="py-3 px-2 sm:py-4 sm:px-4 hidden md:table-cell">
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
                    
                    <td className="py-3 px-2 sm:py-4 sm:px-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{formatDate(order.pickup_date)}</div>
                        <div className="text-xs text-slate-500 hidden sm:block">{order.pickup_time_slot}</div>
                      </div>
                    </td>
                    
                    <td className="py-3 px-2 sm:py-4 sm:px-4">
                      <div className="font-medium text-slate-900 text-sm">
                        ${order.total?.toFixed(2) || '0.00'}
                      </div>
                    </td>
                    
                    <td className="py-3 px-2 sm:py-4 sm:px-4">
                      <div className="flex items-center gap-2">
                        <TumbleButton
                          onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">View</span>
                        </TumbleButton>
                        {order.status === 'failed' && (
                          <TumbleButton
                            onClick={() => {
                              setFailedOrderToResolve(order)
                              setShowFailedOrderResolution(true)
                            }}
                            variant="destructive"
                            size="sm"
                          >
                            <AlertCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Resolve</span>
                          </TumbleButton>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      <TumbleDialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        {selectedOrder && (
          <TumbleDialogContent className="max-w-2xl">
            <TumbleDialogHeader>
              <TumbleDialogTitle>Order #{selectedOrder.id}</TumbleDialogTitle>
            </TumbleDialogHeader>
            <TumbleDialogBody>

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
            </TumbleDialogBody>
            <TumbleDialogFooter>
              <TumbleButton
                onClick={() => router.push(`/dashboard/orders/${selectedOrder.id}`)}
                variant="default"
              >
                View Full Details
              </TumbleButton>
            </TumbleDialogFooter>
          </TumbleDialogContent>
        )}
      </TumbleDialog>

      {/* Route Assignment Modal */}
      <TumbleDialog open={showRouteAssignment} onOpenChange={setShowRouteAssignment}>
        <TumbleDialogContent className="max-w-md">
          <TumbleDialogHeader>
            <TumbleDialogTitle>Assign Route</TumbleDialogTitle>
            <TumbleDialogDescription>
              Assign {selectedOrders.size} selected orders to a driver route
            </TumbleDialogDescription>
          </TumbleDialogHeader>
          <TumbleDialogBody>

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
                  {selectedOrders.size > 1 && (
                    <p className="text-xs text-blue-600 mt-1">
                      ✨ These orders were optimally grouped for efficiency
                    </p>
                  )}
                </div>

              </div>
            </TumbleDialogBody>
            <TumbleDialogFooter>
              <TumbleButton
                onClick={() => setShowRouteAssignment(false)}
                variant="outline"
              >
                Cancel
              </TumbleButton>
              <TumbleButton
                onClick={handleRouteAssignment}
                disabled={!routeAssignment.driver_id}
                variant="default"
              >
                Assign Route
              </TumbleButton>
            </TumbleDialogFooter>
          </TumbleDialogContent>
      </TumbleDialog>

      {/* Bulk Status Update Modal */}
      <TumbleDialog open={showBulkStatusUpdate} onOpenChange={setShowBulkStatusUpdate}>
        <TumbleDialogContent className="max-w-md">
          <TumbleDialogHeader>
            <TumbleDialogTitle>Bulk Status Update</TumbleDialogTitle>
            <TumbleDialogDescription>
              Update the status of {selectedOrders.size} selected orders simultaneously
            </TumbleDialogDescription>
          </TumbleDialogHeader>
          <TumbleDialogBody>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">New Status</label>
                  <select 
                    value={bulkStatusUpdate.status} 
                    onChange={(e) => setBulkStatusUpdate({...bulkStatusUpdate, status: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select status</option>
                    <option value="pending">Pending</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="picked_up">Picked Up</option>
                    <option value="in_process">In Process</option>
                    <option value="ready">Ready</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
                  <textarea 
                    value={bulkStatusUpdate.notes}
                    onChange={(e) => setBulkStatusUpdate({...bulkStatusUpdate, notes: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    placeholder="Add any notes about this status update..."
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm text-slate-600">
                    Updating {selectedOrders.size} orders to "{bulkStatusUpdate.status}" status
                  </p>
                </div>

              </div>
            </TumbleDialogBody>
            <TumbleDialogFooter>
              <TumbleButton
                onClick={() => setShowBulkStatusUpdate(false)}
                variant="outline"
              >
                Cancel
              </TumbleButton>
              <TumbleButton
                onClick={handleBulkStatusUpdate}
                disabled={!bulkStatusUpdate.status}
                variant="default"
              >
                Update Status
              </TumbleButton>
            </TumbleDialogFooter>
          </TumbleDialogContent>
      </TumbleDialog>

      {/* Optimization Suggestions Modal */}
      <TumbleDialog open={showOptimizationSuggestions && !!optimizationSuggestions} onOpenChange={(open) => !open && setShowOptimizationSuggestions(false)}>
        {optimizationSuggestions && (
          <TumbleDialogContent className="max-w-4xl">
            <TumbleDialogHeader>
              <TumbleDialogTitle>Route Optimization Suggestions</TumbleDialogTitle>
              <TumbleDialogDescription>
                Smart grouping recommendations to create efficient delivery routes
              </TumbleDialogDescription>
            </TumbleDialogHeader>
            <TumbleDialogBody>

              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <MapPin className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="font-medium text-blue-900">
                        Found {optimizationSuggestions.total_orders} orders ready for route optimization
                      </span>
                    </div>
                    <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                      Efficiency Analysis
                    </span>
                  </div>
                </div>

                {/* Recommended Route Groups */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-900 text-lg">🎯 Recommended Route Groups</h4>
                  <p className="text-sm text-slate-600 mb-4">
                    These groupings will minimize travel time and maximize delivery efficiency. Click "Create Route" to assign a group to a driver.
                  </p>
                  
                  {optimizationSuggestions.suggestions.map((suggestion, index) => (
                    <div key={index} className="border border-slate-200 rounded-xl p-4 bg-gradient-to-r from-slate-50 to-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-slate-900 capitalize flex items-center">
                          {suggestion.type === 'pickup_delivery_cycle' && <Route className="w-4 h-4 mr-2 text-purple-600" />}
                          {suggestion.type === 'geographic_clusters' && <MapPin className="w-4 h-4 mr-2 text-green-600" />}
                          {suggestion.type === 'time_slot_grouping' && <Clock className="w-4 h-4 mr-2 text-blue-600" />}
                          {suggestion.type.replaceAll('_', ' ')}
                        </h5>
                        <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-full">
                          {Object.values(suggestion.groups).reduce((acc, curr) => acc + curr.length, 0)} orders
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm mb-4">{suggestion.message}</p>
                      
                      <div className="grid gap-3">
                        {Object.entries(suggestion.groups).map(([group, orderIds]) => (
                          <div key={group} className="bg-white p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-slate-800">{group}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-500">{orderIds.length} orders</span>
                                <TumbleButton
                                  onClick={() => {
                                    // Auto-select these orders and open route assignment
                                    setSelectedOrders(new Set(orderIds))
                                    setShowOptimizationSuggestions(false)
                                    setShowRouteAssignment(true)
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="ml-2"
                                >
                                  Create Route
                                </TumbleButton>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {orderIds.map((orderId) => (
                                <span key={orderId} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  #{orderId}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Details - Compact View */}
                <div className="border border-slate-200 rounded-xl">
                  <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h4 className="font-semibold text-slate-900">📋 Order Details</h4>
                    <p className="text-sm text-slate-600">Full address details for route planning</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {optimizationSuggestions.orders.map((order) => (
                      <div key={order.id} className="p-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-900">#{order.id}</span>
                              <span className="text-sm text-slate-600">{order.customer_name}</span>
                              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                                {order.pickup_time_slot}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 space-y-1">
                              <div>📍 Pickup: {order.pickup_address}, {order.pickup_city} {order.pickup_zip}</div>
                              <div>🏠 Delivery: {order.delivery_address}, {order.delivery_city} {order.delivery_zip}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </TumbleDialogBody>
            <TumbleDialogFooter>
              <div className="text-sm text-slate-600 mr-auto">
                💡 Tip: Use "Create Route" buttons above to quickly assign optimized groups to drivers
              </div>
              <TumbleButton
                onClick={() => setShowOptimizationSuggestions(false)}
                variant="outline"
              >
                Close
              </TumbleButton>
            </TumbleDialogFooter>
          </TumbleDialogContent>
        )}
      </TumbleDialog>

      {/* Failed Order Resolution Modal */}
      <TumbleDialog open={showFailedOrderResolution && !!failedOrderToResolve} onOpenChange={(open) => {
        if (!open) {
          setShowFailedOrderResolution(false)
          setFailedOrderToResolve(null)
          setFailedOrderResolution({
            resolution_type: '',
            reschedule_date: new Date().toISOString().split('T')[0],
            refund_amount: 0,
            notes: ''
          })
        }
      }}>
        {failedOrderToResolve && (
          <TumbleDialogContent className="max-w-2xl">
            <TumbleDialogHeader>
              <TumbleDialogTitle>Resolve Failed Order #{failedOrderToResolve.id}</TumbleDialogTitle>
              <TumbleDialogDescription>
                Handle the failed pickup/delivery for {failedOrderToResolve.user_name}
              </TumbleDialogDescription>
            </TumbleDialogHeader>
            <TumbleDialogBody>
              <div className="space-y-6">
                {/* Order Details */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900">Failed Order Details</h4>
                      <p className="text-sm text-red-700 mt-1">
                        Customer: {failedOrderToResolve.user_name} ({failedOrderToResolve.user_email})
                      </p>
                      <p className="text-sm text-red-700">
                        Original Date: {formatDate(failedOrderToResolve.pickup_date)} - {failedOrderToResolve.pickup_time_slot}
                      </p>
                      <p className="text-sm text-red-700">
                        Total Amount: ${failedOrderToResolve.total?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resolution Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Resolution Type</label>
                  <select 
                    value={failedOrderResolution.resolution_type} 
                    onChange={(e) => setFailedOrderResolution({...failedOrderResolution, resolution_type: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select resolution type</option>
                    <option value="reschedule">Reschedule Pickup/Delivery</option>
                    <option value="partial_refund">Issue Partial Refund</option>
                    <option value="full_refund">Issue Full Refund</option>
                    <option value="credit">Apply Account Credit</option>
                    <option value="waive_fee">Waive Service Fee</option>
                  </select>
                </div>

                {/* Conditional Fields Based on Resolution Type */}
                {failedOrderResolution.resolution_type === 'reschedule' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">New Pickup Date</label>
                    <input 
                      type="date" 
                      value={failedOrderResolution.reschedule_date}
                      onChange={(e) => setFailedOrderResolution({...failedOrderResolution, reschedule_date: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                )}

                {(failedOrderResolution.resolution_type === 'partial_refund' || 
                  failedOrderResolution.resolution_type === 'credit') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {failedOrderResolution.resolution_type === 'partial_refund' ? 'Refund Amount' : 'Credit Amount'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={failedOrderResolution.refund_amount}
                        onChange={(e) => setFailedOrderResolution({...failedOrderResolution, refund_amount: parseFloat(e.target.value) || 0})}
                        className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Resolution Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Resolution Notes</label>
                  <textarea 
                    value={failedOrderResolution.notes}
                    onChange={(e) => setFailedOrderResolution({...failedOrderResolution, notes: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={4}
                    placeholder="Explain the resolution and any communication with the customer..."
                  />
                </div>

                {/* Customer Communication Template */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Suggested Customer Message
                  </h4>
                  <p className="text-sm text-blue-800 whitespace-pre-line">
                    {failedOrderResolution.resolution_type === 'reschedule' && 
                      `Dear ${failedOrderToResolve.user_name},\n\nWe apologize for the inconvenience with your recent order. We've rescheduled your pickup for ${new Date(failedOrderResolution.reschedule_date).toLocaleDateString()}.\n\nOur team will ensure priority service for your rescheduled pickup.\n\nThank you for your understanding.`
                    }
                    {failedOrderResolution.resolution_type === 'partial_refund' && 
                      `Dear ${failedOrderToResolve.user_name},\n\nWe apologize for the issue with your recent order. We've processed a partial refund of $${failedOrderResolution.refund_amount.toFixed(2)} to your account.\n\nThe refund should appear within 3-5 business days.\n\nThank you for your patience.`
                    }
                    {failedOrderResolution.resolution_type === 'full_refund' && 
                      `Dear ${failedOrderToResolve.user_name},\n\nWe sincerely apologize for the failed service. We've issued a full refund of $${failedOrderToResolve.total?.toFixed(2) || '0.00'} to your account.\n\nThe refund should appear within 3-5 business days.\n\nWe hope to serve you better in the future.`
                    }
                    {!failedOrderResolution.resolution_type && 'Select a resolution type to see suggested message'}
                  </p>
                </div>
              </div>
            </TumbleDialogBody>
            <TumbleDialogFooter>
              <TumbleButton
                onClick={() => {
                  setShowFailedOrderResolution(false)
                  setFailedOrderToResolve(null)
                }}
                variant="outline"
              >
                Cancel
              </TumbleButton>
              <TumbleButton
                onClick={async () => {
                  if (!session || !failedOrderResolution.resolution_type) return
                  
                  setError(null)
                  setSuccessMessage(null)
                  
                  try {
                    const request: CreateOrderResolutionRequest = {
                      order_id: failedOrderToResolve.id,
                      resolution_type: failedOrderResolution.resolution_type as any,
                      notes: failedOrderResolution.notes
                    }
                    
                    // Add conditional fields based on resolution type
                    if (failedOrderResolution.resolution_type === 'reschedule') {
                      request.reschedule_date = failedOrderResolution.reschedule_date
                    } else if (failedOrderResolution.resolution_type === 'partial_refund') {
                      request.refund_amount = failedOrderResolution.refund_amount
                    } else if (failedOrderResolution.resolution_type === 'full_refund') {
                      request.refund_amount = failedOrderToResolve.total || 0
                    } else if (failedOrderResolution.resolution_type === 'credit') {
                      request.credit_amount = failedOrderResolution.refund_amount
                    }
                    
                    await adminApi.createOrderResolution(session, request)
                    
                    setSuccessMessage(`Order #${failedOrderToResolve.id} has been resolved with ${failedOrderResolution.resolution_type.replace('_', ' ')}`)
                    setShowFailedOrderResolution(false)
                    setFailedOrderToResolve(null)
                    setFailedOrderResolution({
                      resolution_type: '',
                      reschedule_date: new Date().toISOString().split('T')[0],
                      refund_amount: 0,
                      notes: ''
                    })
                    
                    // Reload data to reflect changes
                    await loadData()
                  } catch (err) {
                    console.error('Error resolving order:', err)
                    setError('Failed to resolve order. Please try again.')
                  }
                }}
                disabled={!failedOrderResolution.resolution_type || !failedOrderResolution.notes}
                variant="default"
              >
                Apply Resolution
              </TumbleButton>
            </TumbleDialogFooter>
          </TumbleDialogContent>
        )}
      </TumbleDialog>
    </>
  )
}