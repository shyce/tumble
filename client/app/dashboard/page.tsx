'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
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

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
    }
  }, [session, status, router])


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
            href="/dashboard/earnings"
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
            href="/dashboard/orders"
            className="relative group bg-white border-2 border-slate-200 p-6 rounded-xl hover:border-purple-200 hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <Package className="text-purple-600 w-8 h-8 mb-3" />
                <h3 className="text-lg font-semibold text-slate-800">
                  All Orders
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  View system orders
                </p>
              </div>
              <span className="text-slate-400 group-hover:text-purple-600 transition-colors">→</span>
            </div>
          </Link>

          <Link
            href="/dashboard/earnings"
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
          href="/apply-driver"
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
    <Layout requireAuth={true} title={getDashboardTitle()} subtitle={getDashboardSubtitle()}>
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
                          <dd className="text-sm font-semibold text-slate-900">No active subscription</dd>
                        </div>
                        
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">Next Pickup</dt>
                          <dd className="text-sm font-semibold text-slate-900">Not scheduled</dd>
                        </div>
                      </>
                    ) : user.role === 'driver' ? (
                      <>
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">Today's Routes</dt>
                          <dd className="text-sm font-semibold text-slate-900">0 assigned</dd>
                        </div>
                        
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">This Week</dt>
                          <dd className="text-sm font-semibold text-slate-900">$0.00 earned</dd>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">Total Users</dt>
                          <dd className="text-sm font-semibold text-slate-900">0</dd>
                        </div>
                        
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <dt className="text-sm font-medium text-slate-500">Active Orders</dt>
                          <dd className="text-sm font-semibold text-slate-900">0</dd>
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
                  
                  {(user.role === 'customer' || !user.role) && (
                    <div className="mt-6">
                      <Link
                        href="/dashboard/subscription"
                        className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-center py-3 px-4 rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg inline-block"
                      >
                        Choose a Plan
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
                  
                  <div className="text-center py-8">
                    <div className={`w-16 h-16 bg-gradient-to-br ${
                      user.role === 'driver' ? 'from-blue-100 to-indigo-100' :
                      user.role === 'admin' ? 'from-purple-100 to-indigo-100' :
                      'from-teal-100 to-emerald-100'
                    } rounded-full flex items-center justify-center mx-auto mb-4`}>
                      <Truck className={`w-8 h-8 ${
                        user.role === 'driver' ? 'text-blue-600' :
                        user.role === 'admin' ? 'text-purple-600' :
                        'text-teal-600'
                      }`} />
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      No recent {user.role === 'driver' ? 'deliveries' : 'orders'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Your {user.role === 'driver' ? 'delivery' : 'order'} history will appear here
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </Layout>
  )
}