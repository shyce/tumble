'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  Sparkles, 
  LayoutDashboard, 
  User, 
  LogOut, 
  Menu, 
  X,
  Calendar,
  Package,
  Settings,
  CreditCard
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  requireAuth?: boolean
}

export default function Layout({ children, title, subtitle, requireAuth = true }: LayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!requireAuth) return
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
    }
  }, [session, status, router, requireAuth])

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/' })
  }

  if (requireAuth && status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  if (requireAuth && !session?.user) {
    return null
  }

  const user = session?.user as any

  // Get gradient colors based on role
  const getGradientColors = () => {
    if (!user) return 'from-slate-50 via-teal-50 to-emerald-50'
    
    switch (user.role) {
      case 'driver':
        return 'from-slate-50 via-blue-50 to-indigo-50'
      case 'admin':
        return 'from-slate-50 via-purple-50 to-indigo-50'
      default:
        return 'from-slate-50 via-teal-50 to-emerald-50'
    }
  }

  const dashboardLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/dashboard/schedule', icon: Calendar, label: 'Schedule' },
    { href: '/dashboard/orders', icon: Package, label: 'Orders' },
    { href: '/dashboard/subscription', icon: CreditCard, label: 'Subscription' },
    { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className={`min-h-screen bg-gradient-to-br ${getGradientColors()}`}>
      {/* Enhanced Navigation */}
      <nav className="bg-white/90 backdrop-blur-xl border-b border-white/20 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className={`w-10 h-10 bg-gradient-to-br ${
                  user?.role === 'driver' ? 'from-blue-400 to-indigo-400' :
                  user?.role === 'admin' ? 'from-purple-400 to-indigo-400' :
                  'from-teal-400 to-emerald-400'
                } rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200 group-hover:scale-105`}>
                  <Sparkles className="text-white w-5 h-5" />
                </div>
                <span className="text-slate-800 font-bold text-xl tracking-tight">Tumble</span>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            {user && (
              <div className="hidden md:flex items-center space-x-1">
                {dashboardLinks.map((link) => {
                  const Icon = link.icon
                  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
                  
                  // Smart active detection logic
                  const isActive = (() => {
                    if (link.href === '/dashboard') {
                      // Dashboard is active only when exactly on /dashboard, not on sub-pages
                      return currentPath === '/dashboard'
                    } else {
                      // Other pages are active when the current path matches exactly
                      return currentPath === link.href
                    }
                  })()
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
                  {/* User Info */}
                  <div className="hidden sm:flex items-center space-x-3">
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
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>

                  {/* Mobile Menu Button */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
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
                  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
                  
                  // Smart active detection logic
                  const isActive = (() => {
                    if (link.href === '/dashboard') {
                      // Dashboard is active only when exactly on /dashboard, not on sub-pages
                      return currentPath === '/dashboard'
                    } else {
                      // Other pages are active when the current path matches exactly
                      return currentPath === link.href
                    }
                  })()
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Enhanced Header */}
        {(title || subtitle) && (
          <div className="mb-8">
            {title && (
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-lg text-slate-600 max-w-3xl">{subtitle}</p>
            )}
          </div>
        )}

        {/* Page Content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  )
}