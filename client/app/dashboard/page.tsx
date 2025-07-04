'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Calendar, Package, Settings, CreditCard, Clock, CheckCircle, Truck } from 'lucide-react'

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  role: string
  avatar_url?: string
  email_verified_at?: string
  created_at: string
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/auth/signin')
      return
    }

    try {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
    } catch (error) {
      router.push('/auth/signin')
      return
    }
    
    setLoading(false)
  }, [router])

  const handleSignOut = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg">
                  <Sparkles className="text-white w-5 h-5" />
                </div>
                <span className="text-slate-800 font-bold text-xl tracking-tight">Tumble</span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-slate-700">Welcome, {user.first_name}!</span>
              <button
                onClick={handleSignOut}
                className="text-slate-500 hover:text-slate-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-4xl font-bold text-slate-900">Your Dashboard</h1>
          <p className="mt-2 text-lg text-slate-600">
            Manage your laundry service and track your orders
          </p>
        </div>

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
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <dt className="text-sm font-medium text-slate-500">Current Plan</dt>
                      <dd className="text-sm font-semibold text-slate-900">No active subscription</dd>
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <dt className="text-sm font-medium text-slate-500">Next Pickup</dt>
                      <dd className="text-sm font-semibold text-slate-900">Not scheduled</dd>
                    </div>
                    
                    <div className="flex items-center justify-between py-3">
                      <dt className="text-sm font-medium text-slate-500">Account Status</dt>
                      <dd className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mr-1" />
                        <span className="text-sm font-semibold text-emerald-600">Active</span>
                      </dd>
                    </div>
                  </dl>
                  
                  <div className="mt-6">
                    <Link
                      href="/dashboard/subscription"
                      className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-center py-3 px-4 rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg inline-block"
                    >
                      Choose a Plan
                    </Link>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white overflow-hidden shadow-lg rounded-2xl">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Recent Activity
                  </h3>
                  
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Truck className="w-8 h-8 text-teal-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      No recent orders
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Your order history will appear here
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}