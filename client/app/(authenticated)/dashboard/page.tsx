'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { subscriptionApi, driverApi, adminApi, orderApi } from '@/lib/api'
import { 
  Sparkles, 
  Calendar, 
  Package, 
  Settings, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  Truck,
  Map,
  DollarSign,
  Users,
  FileText,
  Shield,
  TrendingUp
} from 'lucide-react'

interface CustomerData {
  subscription: {
    plan: string | null
    status: string
  }
  nextPickup: string | null
  recentOrders: any[]
}

interface DriverData {
  todayRoutes: number
  weeklyEarnings: number
  recentDeliveries: any[]
}

interface AdminData {
  totalUsers: number
  activeOrders: number
  recentActivity: any[]
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [driverData, setDriverData] = useState<DriverData | null>(null)
  const [adminData, setAdminData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  useEffect(() => {
    if (!session?.user) return
    
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        const user = session.user as any
        
        if (user.role === 'customer' || !user.role) {
          // Fetch customer subscription and derive next pickup from orders
          const [subscription, orders] = await Promise.all([
            subscriptionApi.getCurrentSubscription(session),
            orderApi.getOrders(session)
          ])

          // Find next scheduled pickup from orders
          const upcomingOrders = orders.filter(order => {
            const isValidStatus = order.status === 'scheduled' || order.status === 'pending'
            const pickupDate = new Date(order.pickup_date)
            const today = new Date()
            today.setHours(0, 0, 0, 0) // Start of today
            
            // Include orders from today onwards
            return isValidStatus && pickupDate >= today
          })
          
          const nextPickupOrder = upcomingOrders.sort((a, b) => 
            new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime()
          )[0]

          // Get recent orders (last 5)
          const recentOrders = orders
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)

          setCustomerData({
            subscription: {
              plan: subscription?.plan?.name || null,
              status: subscription?.status || 'inactive'
            },
            nextPickup: nextPickupOrder?.pickup_date || null,
            recentOrders
          })
        } else if (user.role === 'driver') {
          // Fetch driver routes and calculate stats
          const routes = await driverApi.getRoutes(session)
          
          // Calculate today's routes
          const todayStr = new Date().toISOString().split('T')[0]
          const todayRoutes = routes.filter(route => 
            route.scheduled_date?.startsWith(todayStr)
          ).length

          // Get weekly earnings from the earnings API
          let weeklyEarnings = 0
          try {
            const earningsData = await driverApi.getEarnings(session)
            weeklyEarnings = earningsData.thisWeek || 0
          } catch (error) {
            console.error('Failed to fetch earnings:', error)
          }

          // Get recent deliveries - include past routes and routes with orders
          const currentDate = new Date()
          const recentRoutes = routes
            .filter(route => {
              const routeDate = new Date(route.route_date)
              // Include routes from the past week and routes with orders
              const weekAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000)
              return routeDate >= weekAgo && (route.orders?.length > 0 || routeDate < currentDate)
            })
            .sort((a, b) => new Date(b.route_date).getTime() - new Date(a.route_date).getTime())
            .slice(0, 5)

          setDriverData({
            todayRoutes,
            weeklyEarnings,
            recentDeliveries: recentRoutes
          })
        } else if (user.role === 'admin') {
          // Fetch admin data using existing endpoints
          const [users, ordersSummary] = await Promise.all([
            adminApi.getUsers(session),
            adminApi.getOrdersSummary(session)
          ])

          // Get recent activity (recent orders and user registrations)
          const recentOrders = await adminApi.getAllOrders(session, { limit: 3 })
          const recentUsers = users
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 2)
            .map(user => ({
              type: 'user_registration',
              description: `New ${user.role} registered: ${user.email}`,
              timestamp: user.created_at
            }))

          const recentOrderActivity = recentOrders.slice(0, 3).map(order => ({
            type: 'order_update',
            description: `Order ${order.id} - ${order.status}`,
            timestamp: order.updated_at || order.created_at
          }))

          const recentActivity = [...recentOrderActivity, ...recentUsers]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5)

          setAdminData({
            totalUsers: users.length,
            activeOrders: ordersSummary.active_orders || 0,
            recentActivity
          })
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
        // Set default/empty state on error
        const user = session.user as any
        if (user.role === 'customer' || !user.role) {
          setCustomerData({
            subscription: { plan: null, status: 'inactive' },
            nextPickup: null,
            recentOrders: []
          })
        } else if (user.role === 'driver') {
          setDriverData({ todayRoutes: 0, weeklyEarnings: 0, recentDeliveries: [] })
        } else if (user.role === 'admin') {
          setAdminData({ totalUsers: 0, activeOrders: 0, recentActivity: [] })
        }
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [session?.user?.id])


  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  const user = session.user as any

  // Get gradient colors based on role
  const getGradientColors = () => {
    switch (user.role) {
      case 'driver':
        return 'from-slate-50 via-blue-50 to-indigo-50'
      case 'admin':
        return 'from-slate-50 via-purple-50 to-indigo-50'
      default:
        return 'from-slate-50 via-teal-50 to-emerald-50'
    }
  }

  // Get accent colors based on role
  const getAccentColors = () => {
    switch (user.role) {
      case 'driver':
        return { primary: 'blue', secondary: 'indigo' }
      case 'admin':
        return { primary: 'purple', secondary: 'indigo' }
      default:
        return { primary: 'teal', secondary: 'emerald' }
    }
  }

  const gradientColors = getGradientColors()
  const accentColors = getAccentColors()

  // Get quick actions based on role
  const getQuickActions = () => {
    if (user.role === 'driver') {
      return (
        <>
          <Link
            href="/dashboard/routes"
            className="relative group bg-gradient-to-br from-blue-500 to-indigo-500 p-6 rounded-xl hover:shadow-xl transition-all transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div>
                <Map className="text-white w-8 h-8 mb-3" />
                <h3 className="text-lg font-semibold text-white">
                  My Routes
                </h3>
                <p className="mt-1 text-sm text-white/90">
                  View today's routes
                </p>
              </div>
              <span className="text-white/50 group-hover:text-white transition-colors">→</span>
            </div>
          </Link>

          <Link
            href="/dashboard/earnings/driver"
            className="relative group bg-gradient-to-br from-green-500 to-emerald-500 p-6 rounded-xl hover:shadow-xl transition-all transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div>
                <DollarSign className="text-white w-8 h-8 mb-3" />
                <h3 className="text-lg font-semibold text-white">
                  Earnings
                </h3>
                <p className="mt-1 text-sm text-white/90">
                  Track your income
                </p>
              </div>
              <span className="text-white/50 group-hover:text-white transition-colors">→</span>
            </div>
          </Link>

          <Link
            href="/dashboard/driver-schedule"
            className="relative group bg-white border-2 border-slate-200 p-6 rounded-xl hover:border-blue-200 hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <Clock className="text-blue-600 w-8 h-8 mb-3" />
                <h3 className="text-lg font-semibold text-slate-800">
                  My Schedule
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Set your availability
                </p>
              </div>
              <span className="text-slate-400 group-hover:text-blue-600 transition-colors">→</span>
            </div>
          </Link>

          <Link
            href="/dashboard/deliveries"
            className="relative group bg-white border-2 border-slate-200 p-6 rounded-xl hover:border-indigo-200 hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <Package className="text-indigo-600 w-8 h-8 mb-3" />
                <h3 className="text-lg font-semibold text-slate-800">
                  Deliveries
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  View completed deliveries
                </p>
              </div>
              <span className="text-slate-400 group-hover:text-indigo-600 transition-colors">→</span>
            </div>
          </Link>
        </>
      )
    }

    if (user.role === 'admin') {
      return (
        <>
          <Link
            href="/dashboard/users"
            className="relative group bg-gradient-to-br from-purple-500 to-indigo-500 p-6 rounded-xl hover:shadow-xl transition-all transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div>
                <Users className="text-white w-8 h-8 mb-3" />
                <h3 className="text-lg font-semibold text-white">
                  User Management
                </h3>
                <p className="mt-1 text-sm text-white/90">
                  Manage all users
                </p>
              </div>
              <span className="text-white/50 group-hover:text-white transition-colors">→</span>
            </div>
          </Link>

          <Link
            href="/dashboard/driver-applications"
            className="relative group bg-gradient-to-br from-indigo-500 to-purple-500 p-6 rounded-xl hover:shadow-xl transition-all transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div>
                <FileText className="text-white w-8 h-8 mb-3" />
                <h3 className="text-lg font-semibold text-white">
                  Driver Applications
                </h3>
                <p className="mt-1 text-sm text-white/90">
                  Review applications
                </p>
              </div>
              <span className="text-white/50 group-hover:text-white transition-colors">→</span>
            </div>
          </Link>

          <Link
            href="/dashboard/admin/orders"
            className="relative group bg-white border-2 border-slate-200 p-6 rounded-xl hover:border-purple-200 hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <Package className="text-purple-600 w-8 h-8 mb-3" />
                <h3 className="text-lg font-semibold text-slate-800">
                  Order Management
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Manage all orders & routes
                </p>
              </div>
              <span className="text-slate-400 group-hover:text-purple-600 transition-colors">→</span>
            </div>
          </Link>

          <Link
            href="/dashboard/earnings/company"
            className="relative group bg-white border-2 border-slate-200 p-6 rounded-xl hover:border-green-200 hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <TrendingUp className="text-green-600 w-8 h-8 mb-3" />
                <h3 className="text-lg font-semibold text-slate-800">
                  Revenue Reports
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Platform analytics
                </p>
              </div>
              <span className="text-slate-400 group-hover:text-green-600 transition-colors">→</span>
            </div>
          </Link>
        </>
      )
    }

    // Customer quick actions
    return (
      <>
        <Link
          href="/dashboard/schedule"
          className="relative group bg-gradient-to-br from-teal-500 to-emerald-500 p-6 rounded-xl hover:shadow-xl transition-all transform hover:scale-105"
        >
          <div className="flex items-center justify-between">
            <div>
              <Calendar className="text-white w-8 h-8 mb-3" />
              <h3 className="text-lg font-semibold text-white">
                Schedule Pickup
              </h3>
              <p className="mt-1 text-sm text-white/90">
                Book your next pickup
              </p>
            </div>
            <span className="text-white/50 group-hover:text-white transition-colors">→</span>
          </div>
        </Link>

        <Link
          href="/dashboard/subscription"
          className="relative group bg-gradient-to-br from-emerald-500 to-teal-500 p-6 rounded-xl hover:shadow-xl transition-all transform hover:scale-105"
        >
          <div className="flex items-center justify-between">
            <div>
              <CreditCard className="text-white w-8 h-8 mb-3" />
              <h3 className="text-lg font-semibold text-white">
                Manage Subscription
              </h3>
              <p className="mt-1 text-sm text-white/90">
                View and update your plan
              </p>
            </div>
            <span className="text-white/50 group-hover:text-white transition-colors">→</span>
          </div>
        </Link>

        <Link
          href="/dashboard/orders"
          className="relative group bg-white border-2 border-slate-200 p-6 rounded-xl hover:border-teal-200 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <Package className="text-teal-600 w-8 h-8 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800">
                Order History
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                View past and current orders
              </p>
            </div>
            <span className="text-slate-400 group-hover:text-teal-600 transition-colors">→</span>
          </div>
        </Link>

        <Link
          href="/dashboard/settings"
          className="relative group bg-white border-2 border-slate-200 p-6 rounded-xl hover:border-emerald-200 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <Settings className="text-emerald-600 w-8 h-8 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800">
                Account Settings
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Update your profile
              </p>
            </div>
            <span className="text-slate-400 group-hover:text-emerald-600 transition-colors">→</span>
          </div>
        </Link>

        <Link
          href="/dashboard/apply-driver"
          className="relative group bg-gradient-to-br from-blue-500 to-indigo-500 p-6 rounded-xl hover:shadow-xl transition-all transform hover:scale-105 sm:col-span-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <Truck className="text-white w-8 h-8 mb-3" />
              <h3 className="text-lg font-semibold text-white">
                Apply to be a Driver
              </h3>
              <p className="mt-1 text-sm text-white/90">
                Join our driver network and start earning with Tumble
              </p>
            </div>
            <span className="text-white/50 group-hover:text-white transition-colors">→</span>
          </div>
        </Link>
      </>
    )
  }

  // Get dashboard title based on role
  const getDashboardTitle = () => {
    switch (user.role) {
      case 'driver':
        return 'Driver Dashboard'
      case 'admin':
        return 'Admin Dashboard'
      default:
        return 'Your Dashboard'
    }
  }

  // Get dashboard subtitle based on role
  const getDashboardSubtitle = () => {
    switch (user.role) {
      case 'driver':
        return 'Manage your deliveries and earnings'
      case 'admin':
        return 'Manage the Tumble platform'
      default:
        return 'Manage your laundry service and track your orders'
    }
  }

  return (
    <>
      <PageHeader title={getDashboardTitle()} subtitle={getDashboardSubtitle()} />
        {/* Main Content */}
        <div className="px-4 sm:px-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            
            {/* Quick Actions */}
            <div className="lg:col-span-2">
              <div className="bg-white overflow-hidden shadow-lg rounded-2xl">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-6">
                    Quick Actions
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {getQuickActions()}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Summary */}
            <div className="space-y-6">
              <div className="bg-white overflow-hidden shadow-lg rounded-2xl">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Account Summary
                  </h3>
                  
                  <dl className="space-y-3">
                    {user.role === 'customer' || !user.role ? (
                      <>
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">Current Plan</dt>
                          <dd className="text-sm font-semibold text-slate-900">
                            {loading ? (
                              <div className="w-16 h-4 bg-slate-200 animate-pulse rounded"></div>
                            ) : customerData?.subscription.plan ? (
                              customerData.subscription.plan
                            ) : (
                              'No active subscription'
                            )}
                          </dd>
                        </div>
                        
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">Next Pickup</dt>
                          <dd className="text-sm font-semibold text-slate-900">
                            {loading ? (
                              <div className="w-20 h-4 bg-slate-200 animate-pulse rounded"></div>
                            ) : customerData?.nextPickup ? (
                              new Date(customerData.nextPickup).toLocaleDateString()
                            ) : (
                              'Not scheduled'
                            )}
                          </dd>
                        </div>
                      </>
                    ) : user.role === 'driver' ? (
                      <>
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">Today's Routes</dt>
                          <dd className="text-sm font-semibold text-slate-900">
                            {loading ? (
                              <div className="w-12 h-4 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                              `${driverData?.todayRoutes || 0} assigned`
                            )}
                          </dd>
                        </div>
                        
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">This Week</dt>
                          <dd className="text-sm font-semibold text-slate-900">
                            {loading ? (
                              <div className="w-16 h-4 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                              `$${driverData?.weeklyEarnings?.toFixed(2) || '0.00'} earned`
                            )}
                          </dd>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">Total Users</dt>
                          <dd className="text-sm font-semibold text-slate-900">
                            {loading ? (
                              <div className="w-8 h-4 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                              adminData?.totalUsers || 0
                            )}
                          </dd>
                        </div>
                        
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">Active Orders</dt>
                          <dd className="text-sm font-semibold text-slate-900">
                            {loading ? (
                              <div className="w-8 h-4 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                              adminData?.activeOrders || 0
                            )}
                          </dd>
                        </div>
                      </>
                    )}
                    
                    <div className="flex items-center justify-between py-3">
                      <dt className="text-sm font-medium text-slate-500">Account Status</dt>
                      <dd className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mr-1" />
                        <span className="text-sm font-semibold text-emerald-600">Active</span>
                      </dd>
                    </div>
                  </dl>
                  
                  {(user.role === 'customer' || !user.role) && !loading && (
                    <div className="mt-6">
                      <Link
                        href="/dashboard/subscription"
                        className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-center py-3 px-4 rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg inline-block"
                      >
                        {customerData?.subscription.plan ? 'Manage Plan' : 'Choose a Plan'}
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white overflow-hidden shadow-lg rounded-2xl">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Recent Activity
                  </h3>
                  
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center space-x-3 py-2">
                          <div className="w-8 h-8 bg-slate-200 animate-pulse rounded-full"></div>
                          <div className="flex-1">
                            <div className="w-3/4 h-3 bg-slate-200 animate-pulse rounded mb-1"></div>
                            <div className="w-1/2 h-2 bg-slate-200 animate-pulse rounded"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {user.role === 'customer' || !user.role ? (
                        customerData?.recentOrders?.length ? (
                          customerData.recentOrders.map((order, index) => (
                            <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                              <div className="flex items-center space-x-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  order.status === 'completed' ? 'bg-emerald-100' :
                                  order.status === 'in_progress' ? 'bg-blue-100' :
                                  order.status === 'scheduled' ? 'bg-yellow-100' :
                                  'bg-slate-100'
                                }`}>
                                  {order.status === 'completed' ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                                  ) : order.status === 'in_progress' ? (
                                    <Clock className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Package className="w-5 h-5 text-yellow-600" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    Order #{order.id}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(order.created_at).toLocaleDateString()} • ${order.total || '0.00'}
                                  </p>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                order.status === 'completed' ? 'bg-emerald-500 text-white' :
                                order.status === 'in_progress' ? 'bg-blue-500 text-white' :
                                order.status === 'scheduled' ? 'bg-yellow-500 text-white' :
                                'bg-slate-500 text-white'
                              }`}>
                                {order.status === 'completed' ? 'Done' :
                                 order.status === 'in_progress' ? 'Active' :
                                 order.status === 'scheduled' ? 'Scheduled' :
                                 order.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Package className="w-6 h-6 text-teal-600" />
                            </div>
                            <p className="text-sm font-medium text-slate-700">No recent orders</p>
                            <p className="text-xs text-slate-500 mt-1">Your order history will appear here</p>
                          </div>
                        )
                      ) : user.role === 'driver' ? (
                        driverData?.recentDeliveries?.length ? (
                          driverData.recentDeliveries.map((delivery, index) => {
                            const routeDate = new Date(delivery.route_date)
                            const isCompleted = routeDate < new Date() // Past routes are considered completed
                            const displayStatus = isCompleted ? 'completed' : delivery.status
                            
                            return (
                              <div key={delivery.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    isCompleted ? 'bg-emerald-100' : 
                                    displayStatus === 'in_progress' ? 'bg-blue-100' : 'bg-yellow-100'
                                  }`}>
                                    {isCompleted ? (
                                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                                    ) : displayStatus === 'in_progress' ? (
                                      <Clock className="w-5 h-5 text-blue-600" />
                                    ) : (
                                      <Calendar className="w-5 h-5 text-yellow-600" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900 capitalize">
                                      {delivery.route_type} Route
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {routeDate.toLocaleDateString()} • {delivery.orders?.length || 0} orders
                                    </p>
                                  </div>
                                </div>
                                <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                  isCompleted ? 'bg-emerald-500 text-white' :
                                  displayStatus === 'in_progress' ? 'bg-blue-500 text-white' :
                                  'bg-yellow-500 text-white'
                                }`}>
                                  {isCompleted ? 'Done' : displayStatus === 'in_progress' ? 'Active' : 'Scheduled'}
                                </span>
                              </div>
                            )
                          })
                        ) : (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Truck className="w-6 h-6 text-blue-600" />
                            </div>
                            <p className="text-sm font-medium text-slate-700">No recent deliveries</p>
                            <p className="text-xs text-slate-500 mt-1">Your delivery history will appear here</p>
                          </div>
                        )
                      ) : (
                        adminData?.recentActivity?.length ? (
                          adminData.recentActivity.map((activity, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                              <div className="flex items-center space-x-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  activity.type === 'user_registration' ? 'bg-purple-100' : 'bg-indigo-100'
                                }`}>
                                  {activity.type === 'user_registration' ? (
                                    <Users className="w-5 h-5 text-purple-600" />
                                  ) : (
                                    <Package className="w-5 h-5 text-indigo-600" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {activity.type === 'user_registration' ? 'New User' : 'Order Update'}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(activity.timestamp).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                activity.type === 'user_registration' ? 'bg-purple-500 text-white' : 'bg-indigo-500 text-white'
                              }`}>
                                {activity.type === 'user_registration' ? 'New' : 'Updated'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <TrendingUp className="w-6 h-6 text-purple-600" />
                            </div>
                            <p className="text-sm font-medium text-slate-700">No recent activity</p>
                            <p className="text-xs text-slate-500 mt-1">Platform activity will appear here</p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
    </>
  )
}