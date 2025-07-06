'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  User, 
  LogOut, 
  Menu, 
  X,
  Calendar,
  Package,
  Settings,
  CreditCard,
  DollarSign,
  TrendingUp,
  Users
} from 'lucide-react'
import TumbleLogo from './TumbleLogo'

interface MainNavigationProps {
  fullWidth?: boolean
}

export default function MainNavigation({ fullWidth = false }: MainNavigationProps) {
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const user = session?.user as any

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/' })
  }

  const getDashboardLinks = () => {
    const baseLinks = [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }
    ]

    if (user?.role === 'driver') {
      return [
        ...baseLinks,
        { href: '/dashboard/routes', icon: Calendar, label: 'Routes' },
        { href: '/dashboard/earnings/driver', icon: DollarSign, label: 'Earnings' },
        { href: '/dashboard/deliveries', icon: Package, label: 'Deliveries' },
        { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
      ]
    } else if (user?.role === 'admin') {
      return [
        ...baseLinks,
        { href: '/dashboard/users', icon: Users, label: 'Users' },
        { href: '/dashboard/orders', icon: Package, label: 'Orders' },
        { href: '/dashboard/earnings/company', icon: TrendingUp, label: 'Revenue' },
        { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
      ]
    } else {
      return [
        ...baseLinks,
        { href: '/dashboard/schedule', icon: Calendar, label: 'Schedule' },
        { href: '/dashboard/orders', icon: Package, label: 'Orders' },
        { href: '/dashboard/subscription', icon: CreditCard, label: 'Subscription' },
        { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
      ]
    }
  }

  const dashboardLinks = getDashboardLinks()

  return (
    <nav className="bg-white/90 backdrop-blur-xl border-b border-white/20 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center group py-2">
              <TumbleLogo 
                className="h-8 w-auto px-2 transition-all duration-200 group-hover:scale-105" 
                fill={user?.role === 'driver' ? '#3b82f6' : user?.role === 'admin' ? '#8b5cf6' : '#14b8a6'}
              />
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          {user && (
            <div className="hidden md:flex items-center space-x-1">
              {dashboardLinks.map((link) => {
                const Icon = link.icon
                const isActive = link.href === '/dashboard' 
                  ? pathname === '/dashboard'
                  : link.href.includes('/earnings') 
                    ? pathname.startsWith('/dashboard/earnings')
                    : pathname === link.href
                
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? `${
                            user.role === 'driver' ? 'bg-blue-100 text-blue-700' :
                            user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            'bg-teal-100 text-teal-700'
                          } shadow-sm`
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{link.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
          
          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* Desktop Layout */}
                <div className="hidden md:flex items-center">
                  {/* User Info */}
                  <div className="hidden sm:flex items-center space-x-3 mr-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {user.first_name || user.name}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                    </div>
                    <div className={`w-8 h-8 bg-gradient-to-br ${
                      user.role === 'driver' ? 'from-blue-400 to-indigo-400' :
                      user.role === 'admin' ? 'from-purple-400 to-indigo-400' :
                      'from-teal-400 to-emerald-400'
                    } rounded-full flex items-center justify-center`}>
                      <User className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Sign Out Button */}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden flex items-center space-x-2">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link 
                  href="/auth/signin" 
                  className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link 
                  href="/auth/signup" 
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {user && mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 py-4">
            <div className="space-y-2">
              {dashboardLinks.map((link) => {
                const Icon = link.icon
                const isActive = link.href === '/dashboard' 
                  ? pathname === '/dashboard'
                  : link.href.includes('/earnings') 
                    ? pathname.startsWith('/dashboard/earnings')
                    : pathname === link.href
                
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? `${
                            user.role === 'driver' ? 'bg-blue-100 text-blue-700' :
                            user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            'bg-teal-100 text-teal-700'
                          } shadow-sm`
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Mobile User Info */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center space-x-3 px-3 py-2">
                <div className={`w-8 h-8 bg-gradient-to-br ${
                  user.role === 'driver' ? 'from-blue-400 to-indigo-400' :
                  user.role === 'admin' ? 'from-purple-400 to-indigo-400' :
                  'from-teal-400 to-emerald-400'
                } rounded-full flex items-center justify-center`}>
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {user.first_name || user.name}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}