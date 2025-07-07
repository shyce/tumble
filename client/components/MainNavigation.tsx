'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
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
  Users,
  ChevronDown,
  Map,
  Truck,
  Clock,
  FileText,
  Shield
} from 'lucide-react'
import TumbleLogo from './TumbleLogo'
import { TumbleButton } from './ui/tumble-button'
import { TumbleIconButton } from './ui/tumble-icon-button'


export default function MainNavigation() {
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const pathname = usePathname()
  const user = session?.user as any
  const navRef = useRef<HTMLDivElement>(null)

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/auth/signin' })
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const getNavigationStructure = () => {
    const baseItems = [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', type: 'link' as const }
    ]

    if (user?.role === 'admin') {
      return [
        ...baseItems,
        {
          label: 'Management',
          icon: Shield,
          type: 'dropdown' as const,
          items: [
            { href: '/dashboard/users', icon: Users, label: 'Users' },
            { href: '/dashboard/admin/orders', icon: Package, label: 'Orders' },
            { href: '/dashboard/driver-applications', icon: FileText, label: 'Driver Applications' },
          ]
        },
        {
          label: 'Analytics',
          icon: TrendingUp,
          type: 'dropdown' as const,
          items: [
            { href: '/dashboard/earnings/company', icon: TrendingUp, label: 'Revenue Reports' },
          ]
        },
        { href: '/dashboard/settings', icon: Settings, label: 'Settings', type: 'link' as const },
      ]
    } else if (user?.role === 'driver') {
      return [
        ...baseItems,
        {
          label: 'Customer',
          icon: Package,
          type: 'dropdown' as const,
          items: [
            { href: '/dashboard/schedule', icon: Calendar, label: 'Schedule Pickup' },
            { href: '/dashboard/orders', icon: Package, label: 'My Orders' },
            { href: '/dashboard/subscription', icon: CreditCard, label: 'Subscription' },
          ]
        },
        {
          label: 'Driver',
          icon: Truck,
          type: 'dropdown' as const,
          items: [
            { href: '/dashboard/routes', icon: Map, label: 'My Routes' },
            { href: '/dashboard/earnings/driver', icon: DollarSign, label: 'Earnings' },
            { href: '/dashboard/deliveries', icon: Truck, label: 'Deliveries' },
            { href: '/dashboard/driver-schedule', icon: Clock, label: 'Schedule' },
          ]
        },
        { href: '/dashboard/settings', icon: Settings, label: 'Settings', type: 'link' as const },
      ]
    } else {
      return [
        ...baseItems,
        { href: '/dashboard/schedule', icon: Calendar, label: 'Schedule', type: 'link' as const },
        { href: '/dashboard/orders', icon: Package, label: 'Orders', type: 'link' as const },
        { href: '/dashboard/subscription', icon: CreditCard, label: 'Subscription', type: 'link' as const },
        { href: '/dashboard/settings', icon: Settings, label: 'Settings', type: 'link' as const },
      ]
    }
  }

  const navigationItems = getNavigationStructure()

  const toggleDropdown = (label: string) => {
    setOpenDropdown(openDropdown === label ? null : label)
  }

  const isPathActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    if (href.includes('/earnings')) {
      return pathname.startsWith('/dashboard/earnings')
    }
    if (href.includes('/admin/orders')) {
      return pathname.startsWith('/dashboard/admin/orders')
    }
    return pathname === href
  }

  const isDropdownActive = (items: any[]) => {
    return items.some(item => isPathActive(item.href))
  }

  return (
    <nav ref={navRef} className="bg-white/90 backdrop-blur-xl border-b border-white/20 shadow-lg sticky top-0 z-50">
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
              {navigationItems.map((item) => {
                if (item.type === 'link') {
                  const Icon = item.icon
                  const isActive = isPathActive(item.href)
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
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
                      <span className="hidden lg:inline">{item.label}</span>
                    </Link>
                  )
                } else {
                  // Dropdown menu
                  const Icon = item.icon
                  const isActive = isDropdownActive(item.items)
                  const isOpen = openDropdown === item.label
                  
                  return (
                    <div key={item.label} className="relative">
                      <TumbleButton
                        onClick={() => toggleDropdown(item.label)}
                        variant="ghost"
                        size="sm"
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
                        <span className="hidden lg:inline">{item.label}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </TumbleButton>
                      
                      {isOpen && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                          {item.items.map((subItem) => {
                            const SubIcon = subItem.icon
                            const isSubActive = isPathActive(subItem.href)
                            
                            return (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                onClick={() => setOpenDropdown(null)}
                                className={`flex items-center space-x-3 px-3 py-2 text-sm transition-colors ${
                                  isSubActive
                                    ? `${
                                        user.role === 'driver' ? 'bg-blue-50 text-blue-700' :
                                        user.role === 'admin' ? 'bg-purple-50 text-purple-700' :
                                        'bg-teal-50 text-teal-700'
                                      }`
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <SubIcon className="w-4 h-4" />
                                <span>{subItem.label}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }
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
                  <TumbleButton
                    onClick={handleSignOut}
                    variant="ghost"
                    size="sm"
                    className="flex items-center space-x-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </TumbleButton>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden flex items-center space-x-2">
                  <TumbleIconButton
                    onClick={handleSignOut}
                    variant="ghost"
                    size="default"
                    tooltip="Sign Out"
                    className="text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                  </TumbleIconButton>
                  <TumbleIconButton
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    variant="ghost"
                    size="default"
                    tooltip={mobileMenuOpen ? "Close Menu" : "Open Menu"}
                    className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </TumbleIconButton>
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
              {navigationItems.map((item) => {
                if (item.type === 'link') {
                  const Icon = item.icon
                  const isActive = isPathActive(item.href)
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
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
                      <span>{item.label}</span>
                    </Link>
                  )
                } else {
                  // Mobile: Show section header + items
                  return (
                    <div key={item.label} className="space-y-2">
                      <div className="px-3 py-2">
                        <div className="flex items-center space-x-2">
                          <item.icon className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {item.label}
                          </span>
                        </div>
                      </div>
                      {item.items.map((subItem) => {
                        const SubIcon = subItem.icon
                        const isActive = isPathActive(subItem.href)
                        
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center space-x-3 px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              isActive
                                ? `${
                                    user.role === 'driver' ? 'bg-blue-100 text-blue-700' :
                                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                    'bg-teal-100 text-teal-700'
                                  } shadow-sm`
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            <SubIcon className="w-4 h-4" />
                            <span>{subItem.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )
                }
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