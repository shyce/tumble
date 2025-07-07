'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { subscriptionApi, driverApi, adminApi, orderApi, statusConfig, OrderStatus } from '@/lib/api'
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
  TrendingUp,
  AlertCircle
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
          // Drivers get both customer and driver data
          // Fetch customer data first
          const [subscription, orders, routes] = await Promise.all([
            subscriptionApi.getCurrentSubscription(session),
            orderApi.getOrders(session),
            driverApi.getRoutes(session)
          ])

          // Set up customer data for drivers
          const upcomingOrders = orders.filter(order => {
            const isValidStatus = order.status === 'scheduled' || order.status === 'pending'
            const pickupDate = new Date(order.pickup_date)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            return isValidStatus && pickupDate >= today
          })
          
          const nextPickupOrder = upcomingOrders.sort((a, b) => 
            new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime()
          )[0]

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

          // Now process driver-specific data
          
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
            description: `Order ${order.id}`,
            status: order.status,
            orderId: order.id,
            customerName: order.user_name,
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

  // Get button styles based on role and variant
  const getButtonStyles = (variant: 'primary' | 'secondary' | 'tertiary' | 'accent') => {
    const baseStyles = "relative group p-6 rounded-xl hover:shadow-xl transition-all transform hover:scale-105"
    
    switch (user.role) {
      case 'driver':
        switch (variant) {
          case 'primary':
            return `${baseStyles} bg-gradient-to-br from-blue-500 to-blue-600`
          case 'secondary':
            return `${baseStyles} bg-gradient-to-br from-indigo-500 to-indigo-600`
          case 'tertiary':
            return `${baseStyles} bg-gradient-to-br from-sky-500 to-sky-600`
          case 'accent':
            return `${baseStyles} bg-gradient-to-br from-cyan-500 to-cyan-600`
        }
        break
      case 'admin':
        switch (variant) {
          case 'primary':
            return `${baseStyles} bg-gradient-to-br from-purple-500 to-purple-600`
          case 'secondary':
            return `${baseStyles} bg-gradient-to-br from-indigo-500 to-indigo-600`
          case 'tertiary':
            return `${baseStyles} bg-gradient-to-br from-violet-500 to-violet-600`
          case 'accent':
            return `${baseStyles} bg-gradient-to-br from-fuchsia-500 to-fuchsia-600`
        }
        break
      default: // customer
        switch (variant) {
          case 'primary':
            return `${baseStyles} bg-gradient-to-br from-emerald-500 to-emerald-600`
          case 'secondary':
            return `${baseStyles} bg-gradient-to-br from-green-500 to-green-600`
          case 'tertiary':
            return `${baseStyles} bg-gradient-to-br from-teal-500 to-teal-600`
          case 'accent':
            return `${baseStyles} bg-gradient-to-br from-lime-500 to-lime-600`
        }
    }
    return baseStyles
  }

  // Get customer button styles (always brand green variants)
  const getCustomerButtonStyles = (variant: 'primary' | 'secondary' | 'tertiary' | 'accent') => {
    const baseStyles = "relative group p-6 rounded-xl hover:shadow-xl transition-all transform hover:scale-105"
    
    switch (variant) {
      case 'primary':
        // Primary brand: Light Aqua (#A7E7E1) - using teal as closest match
        return `${baseStyles} bg-gradient-to-br from-teal-400 to-teal-500`
      case 'secondary':
        // Accent brand: Mint Green (#8BE2B3) - using emerald as closest match
        return `${baseStyles} bg-gradient-to-br from-emerald-400 to-emerald-500`
      case 'tertiary':
        return `${baseStyles} bg-gradient-to-br from-teal-500 to-teal-600`
      case 'accent':
        return `${baseStyles} bg-gradient-to-br from-emerald-500 to-emerald-600`
    }
  }

  // Get outline button styles
  const getOutlineButtonStyles = (variant: 'primary' | 'secondary' | 'tertiary' | 'accent') => {
    const baseStyles = "relative group bg-white border-2 p-6 rounded-xl hover:shadow-lg transition-all"
    
    switch (user.role) {
      case 'driver':
        switch (variant) {
          case 'primary':
            return `${baseStyles} border-blue-200 hover:border-blue-300`
          case 'secondary':
            return `${baseStyles} border-indigo-200 hover:border-indigo-300`
          case 'tertiary':
            return `${baseStyles} border-sky-200 hover:border-sky-300`
          case 'accent':
            return `${baseStyles} border-cyan-200 hover:border-cyan-300`
        }
        break
      case 'admin':
        switch (variant) {
          case 'primary':
            return `${baseStyles} border-purple-200 hover:border-purple-300`
          case 'secondary':
            return `${baseStyles} border-indigo-200 hover:border-indigo-300`
          case 'tertiary':
            return `${baseStyles} border-violet-200 hover:border-violet-300`
          case 'accent':
            return `${baseStyles} border-fuchsia-200 hover:border-fuchsia-300`
        }
        break
      default: // customer
        switch (variant) {
          case 'primary':
            return `${baseStyles} border-emerald-200 hover:border-emerald-300`
          case 'secondary':
            return `${baseStyles} border-green-200 hover:border-green-300`
          case 'tertiary':
            return `${baseStyles} border-teal-200 hover:border-teal-300`
          case 'accent':
            return `${baseStyles} border-lime-200 hover:border-lime-300`
        }
    }
    return baseStyles
  }

  // Get customer outline button styles (always brand green variants)
  const getCustomerOutlineButtonStyles = (variant: 'primary' | 'secondary' | 'tertiary' | 'accent') => {
    const baseStyles = "relative group bg-white border-2 p-6 rounded-xl hover:shadow-lg transition-all"
    
    switch (variant) {
      case 'primary':
        // Primary brand: Light Aqua (#A7E7E1) - using teal as closest match
        return `${baseStyles} border-teal-200 hover:border-teal-300`
      case 'secondary':
        // Accent brand: Mint Green (#8BE2B3) - using emerald as closest match
        return `${baseStyles} border-emerald-200 hover:border-emerald-300`
      case 'tertiary':
        return `${baseStyles} border-teal-300 hover:border-teal-400`
      case 'accent':
        return `${baseStyles} border-emerald-300 hover:border-emerald-400`
    }
  }

  // Get icon color classes
  const getIconColors = (variant: 'primary' | 'secondary' | 'tertiary' | 'accent', isOutline: boolean = false) => {
    if (!isOutline) return 'text-white'
    
    switch (user.role) {
      case 'driver':
        switch (variant) {
          case 'primary': return 'text-blue-600'
          case 'secondary': return 'text-indigo-600'
          case 'tertiary': return 'text-sky-600'
          case 'accent': return 'text-cyan-600'
        }
        break
      case 'admin':
        switch (variant) {
          case 'primary': return 'text-purple-600'
          case 'secondary': return 'text-indigo-600'
          case 'tertiary': return 'text-violet-600'
          case 'accent': return 'text-fuchsia-600'
        }
        break
      default:
        switch (variant) {
          case 'primary': return 'text-emerald-600'
          case 'secondary': return 'text-green-600'
          case 'tertiary': return 'text-teal-600'
          case 'accent': return 'text-lime-600'
        }
    }
    return 'text-slate-600'
  }

  // Get customer icon colors (always brand green variants)
  const getCustomerIconColors = (variant: 'primary' | 'secondary' | 'tertiary' | 'accent', isOutline: boolean = false) => {
    if (!isOutline) return 'text-white'
    
    switch (variant) {
      case 'primary':
        // Primary brand: Light Aqua (#A7E7E1) - using teal as closest match
        return 'text-teal-600'
      case 'secondary':
        // Accent brand: Mint Green (#8BE2B3) - using emerald as closest match
        return 'text-emerald-600'
      case 'tertiary':
        return 'text-teal-700'
      case 'accent':
        return 'text-emerald-700'
    }
    return 'text-slate-600'
  }

  const gradientColors = getGradientColors()
  const accentColors = getAccentColors()

  // Get quick actions based on role
  const getQuickActions = () => {
    // Customer actions (available to everyone)
    const customerActions = (
      <>
        <Link
          href="/dashboard/schedule"
          className={getCustomerButtonStyles('primary')}
        >
          <div className="flex items-center justify-between">
            <div>
              <Calendar className={`${getCustomerIconColors('primary')} w-8 h-8 mb-3`} />
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
          className={getCustomerButtonStyles('secondary')}
        >
          <div className="flex items-center justify-between">
            <div>
              <CreditCard className={`${getCustomerIconColors('secondary')} w-8 h-8 mb-3`} />
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
          className={getCustomerOutlineButtonStyles('primary')}
        >
          <div className="flex items-center justify-between">
            <div>
              <Package className={`${getCustomerIconColors('primary', true)} w-8 h-8 mb-3`} />
              <h3 className="text-lg font-semibold text-slate-800">
                Order History
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                View past and current orders
              </p>
            </div>
            <span className={`text-slate-400 group-hover:${getCustomerIconColors('primary', true).replace('text-', '')} transition-colors`}>→</span>
          </div>
        </Link>

        <Link
          href="/dashboard/settings"
          className={getCustomerOutlineButtonStyles('secondary')}
        >
          <div className="flex items-center justify-between">
            <div>
              <Settings className={`${getCustomerIconColors('secondary', true)} w-8 h-8 mb-3`} />
              <h3 className="text-lg font-semibold text-slate-800">
                Account Settings
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Update your profile
              </p>
            </div>
            <span className={`text-slate-400 group-hover:${getCustomerIconColors('secondary', true).replace('text-', '')} transition-colors`}>→</span>
          </div>
        </Link>
      </>
    )

    // Driver-specific actions
    const driverActions = (
      <>
        <Link
          href="/dashboard/routes"
          className={getButtonStyles('primary')}
        >
          <div className="flex items-center justify-between">
            <div>
              <Map className={`${getIconColors('primary')} w-8 h-8 mb-3`} />
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
          className={getButtonStyles('secondary')}
        >
          <div className="flex items-center justify-between">
            <div>
              <DollarSign className={`${getIconColors('secondary')} w-8 h-8 mb-3`} />
              <h3 className="text-lg font-semibold text-white">
                Driver Earnings
              </h3>
              <p className="mt-1 text-sm text-white/90">
                Track your delivery income
              </p>
            </div>
            <span className="text-white/50 group-hover:text-white transition-colors">→</span>
          </div>
        </Link>

        <Link
          href="/dashboard/driver-schedule"
          className={getOutlineButtonStyles('tertiary')}
        >
          <div className="flex items-center justify-between">
            <div>
              <Clock className={`${getIconColors('tertiary', true)} w-8 h-8 mb-3`} />
              <h3 className="text-lg font-semibold text-slate-800">
                Driver Schedule
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Set your availability
              </p>
            </div>
            <span className={`text-slate-400 group-hover:${getIconColors('tertiary', true).replace('text-', '')} transition-colors`}>→</span>
          </div>
        </Link>

        <Link
          href="/dashboard/deliveries"
          className={getOutlineButtonStyles('accent')}
        >
          <div className="flex items-center justify-between">
            <div>
              <Truck className={`${getIconColors('accent', true)} w-8 h-8 mb-3`} />
              <h3 className="text-lg font-semibold text-slate-800">
                Deliveries
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                View completed deliveries
              </p>
            </div>
            <span className={`text-slate-400 group-hover:${getIconColors('accent', true).replace('text-', '')} transition-colors`}>→</span>
          </div>
        </Link>
      </>
    )

    if (user.role === 'admin') {
      return (
        <>
          <Link
            href="/dashboard/users"
            className={getButtonStyles('primary')}
          >
            <div className="flex items-center justify-between">
              <div>
                <Users className={`${getIconColors('primary')} w-8 h-8 mb-3`} />
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
            className={getButtonStyles('secondary')}
          >
            <div className="flex items-center justify-between">
              <div>
                <FileText className={`${getIconColors('secondary')} w-8 h-8 mb-3`} />
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
            className={getOutlineButtonStyles('primary')}
          >
            <div className="flex items-center justify-between">
              <div>
                <Package className={`${getIconColors('primary', true)} w-8 h-8 mb-3`} />
                <h3 className="text-lg font-semibold text-slate-800">
                  Order Management
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Manage all orders & routes
                </p>
              </div>
              <span className={`text-slate-400 group-hover:${getIconColors('primary', true).replace('text-', '')} transition-colors`}>→</span>
            </div>
          </Link>

          <Link
            href="/dashboard/earnings/company"
            className={getOutlineButtonStyles('secondary')}
          >
            <div className="flex items-center justify-between">
              <div>
                <TrendingUp className={`${getIconColors('secondary', true)} w-8 h-8 mb-3`} />
                <h3 className="text-lg font-semibold text-slate-800">
                  Revenue Reports
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Platform analytics
                </p>
              </div>
              <span className={`text-slate-400 group-hover:${getIconColors('secondary', true).replace('text-', '')} transition-colors`}>→</span>
            </div>
          </Link>
        </>
      )
    }

    // Return appropriate actions based on role
    if (user.role === 'driver') {
      // Drivers get customer features + driver features
      return (
        <>
          {customerActions}
          
          {/* Beautiful divider between customer and driver features */}
          <div className="col-span-full flex items-center my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
            <div className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-lg">
              <span className="text-white text-sm font-medium flex items-center space-x-2">
                <Truck className="w-4 h-4" />
                <span>Driver Features</span>
              </span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
          </div>
          
          {driverActions}
        </>
      )
    }

    // Regular customers get customer actions + apply to be driver
    return (
      <>
        {customerActions}
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
                    {(user.role === 'customer' || !user.role) ? (
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
                        {/* Customer data for drivers */}
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

                        {/* Driver-specific data */}
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
                          <dt className="text-sm font-medium text-slate-500">Driver Earnings</dt>
                          <dd className="text-sm font-semibold text-slate-900">
                            {loading ? (
                              <div className="w-16 h-4 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                              `$${driverData?.weeklyEarnings?.toFixed(2) || '0.00'} this week`
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
                  
                  {(user.role === 'customer' || !user.role || user.role === 'driver') && !loading && (
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
                      {(user.role === 'customer' || !user.role) ? (
                        customerData?.recentOrders?.length ? (
                          customerData.recentOrders.map((order, index) => {
                            const statusInfo = statusConfig[order.status] || statusConfig.pending
                            const StatusIcon = statusInfo.icon
                            
                            return (
                              <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusInfo.color.replace('text-', 'bg-').replace('-800', '-100').replace('-700', '-100')}`}>
                                      <StatusIcon className={`w-5 h-5 ${statusInfo.color.replace('bg-', 'text-').replace('-100', '-600')}`} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">
                                        Order #{order.id}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {new Date(order.created_at).toLocaleDateString()} • ${order.total?.toFixed(2) || '0.00'}
                                      </p>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusInfo.color}`}>
                                    {statusInfo.label}
                                  </span>
                                </div>
                              </Link>
                            )
                          })
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
                        <div className="space-y-3">
                          {/* Show customer orders first */}
                          {customerData?.recentOrders?.length ? (
                            <>
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">My Orders</div>
                              {customerData.recentOrders.slice(0, 2).map((order, index) => {
                                const statusInfo = statusConfig[order.status] || statusConfig.pending
                                const StatusIcon = statusInfo.icon
                                
                                return (
                                  <Link key={`order-${order.id}`} href={`/dashboard/orders/${order.id}`}>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                                      <div className="flex items-center space-x-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusInfo.color.replace('text-', 'bg-').replace('-800', '-100').replace('-700', '-100')}`}>
                                          <StatusIcon className={`w-5 h-5 ${statusInfo.color.replace('bg-', 'text-').replace('-100', '-600')}`} />
                                        </div>
                                        <div>
                                          <p className="text-sm font-semibold text-slate-900">
                                            Order #{order.id}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {new Date(order.created_at).toLocaleDateString()} • ${order.total?.toFixed(2) || '0.00'}
                                          </p>
                                        </div>
                                      </div>
                                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusInfo.color}`}>
                                        {statusInfo.label}
                                      </span>
                                    </div>
                                  </Link>
                                )
                              })}
                            </>
                          ) : null}

                          {/* Show driver deliveries */}
                          {driverData?.recentDeliveries?.length ? (
                            <>
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Driver Routes</div>
                              {driverData.recentDeliveries.slice(0, 3).map((delivery, index) => {
                                const routeDate = new Date(delivery.route_date)
                                const isCompleted = routeDate < new Date()
                                const displayStatus = isCompleted ? 'completed' : delivery.status
                                
                                return (
                                  <div key={`delivery-${delivery.id}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
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
                              })}
                            </>
                          ) : null}

                          {/* Show empty state if no activity */}
                          {(!customerData?.recentOrders?.length && !driverData?.recentDeliveries?.length) && (
                            <div className="text-center py-6">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Truck className="w-6 h-6 text-blue-600" />
                              </div>
                              <p className="text-sm font-medium text-slate-700">No recent activity</p>
                              <p className="text-xs text-slate-500 mt-1">Your orders and deliveries will appear here</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        adminData?.recentActivity?.length ? (
                          adminData.recentActivity.map((activity, index) => {
                            const isOrderActivity = activity.type === 'order_update'
                            
                            if (isOrderActivity && activity.orderId) {
                              const statusInfo = statusConfig[activity.status as OrderStatus] || statusConfig.pending
                              const StatusIcon = statusInfo.icon
                              const isFailed = activity.status === 'failed'
                              
                              return (
                                <Link key={index} href={`/dashboard/orders/${activity.orderId}`}>
                                  <div className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                                    isFailed ? 'bg-red-50 hover:bg-red-100 ring-1 ring-red-200' : 'bg-slate-50 hover:bg-slate-100'
                                  }`}>
                                    <div className="flex items-center space-x-3">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusInfo.color.replace('text-', 'bg-').replace('-800', '-100').replace('-700', '-100')}`}>
                                        <StatusIcon className={`w-5 h-5 ${statusInfo.color.replace('bg-', 'text-').replace('-100', '-600')}`} />
                                      </div>
                                      <div>
                                        <p className={`text-sm font-semibold ${isFailed ? 'text-red-900' : 'text-slate-900'}`}>
                                          Order #{activity.orderId} {isFailed && '- Requires Attention'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {activity.customerName} • {new Date(activity.timestamp).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusInfo.color}`}>
                                      {statusInfo.label}
                                    </span>
                                  </div>
                                </Link>
                              )
                            } else {
                              // Extract user role and email from description
                              const userRoleMatch = activity.description.match(/New (\w+) registered: (.+)/)
                              const userRole = userRoleMatch ? userRoleMatch[1] : 'user'
                              const userEmail = userRoleMatch ? userRoleMatch[2] : ''
                              
                              return (
                                <Link key={index} href={`/dashboard/users?filter=${userRole}&highlight=${encodeURIComponent(userEmail)}`}>
                                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                                    <div className="flex items-center space-x-3">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                        userRole === 'driver' ? 'bg-blue-100' : 
                                        userRole === 'admin' ? 'bg-purple-100' : 'bg-emerald-100'
                                      }`}>
                                        <Users className={`w-5 h-5 ${
                                          userRole === 'driver' ? 'text-blue-600' : 
                                          userRole === 'admin' ? 'text-purple-600' : 'text-emerald-600'
                                        }`} />
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900 capitalize">
                                          New {userRole}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {userEmail} • {new Date(activity.timestamp).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                      userRole === 'driver' ? 'bg-blue-500 text-white' : 
                                      userRole === 'admin' ? 'bg-purple-500 text-white' : 'bg-emerald-500 text-white'
                                    }`}>
                                      View
                                    </span>
                                  </div>
                                </Link>
                              )
                            }
                          })
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