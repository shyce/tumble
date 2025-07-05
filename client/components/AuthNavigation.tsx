'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

export default function AuthNavigation() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const userData = localStorage.getItem('user')
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      } catch {
        // Invalid user data, clear it
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
      }
    }
    
    setLoading(false)
  }, [])

  const handleSignOut = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    setUser(null)
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="space-x-4">
        <div className="inline-block w-16 h-8 bg-white/20 rounded animate-pulse"></div>
        <div className="inline-block w-20 h-8 bg-white/20 rounded animate-pulse"></div>
      </div>
    )
  }

  if (user) {
    const getDashboardLink = () => {
      switch (user.role) {
        case 'admin':
          return '/dashboard/driver-applications'
        default:
          return '/dashboard'
      }
    }

    return (
      <div className="flex items-center space-x-4">
        <span className="text-white/90 hidden sm:inline">
          Hi, {user.first_name}!
        </span>
        {user.role !== 'driver' && user.role !== 'admin' && (
          <Link 
            href="/apply-driver" 
            className="text-white hover:text-white/80 transition-colors hidden sm:inline"
          >
            Drive with Us
          </Link>
        )}
        <Link 
          href={getDashboardLink()} 
          className="bg-white text-teal-600 px-4 py-2 rounded-full font-medium hover:bg-white/90 transition-colors"
        >
          {user.role === 'admin' ? 'Admin' : user.role === 'driver' ? 'Driver' : 'Dashboard'}
        </Link>
        <button
          onClick={handleSignOut}
          className="text-white hover:text-white/80 transition-colors"
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div className="space-x-4">
      <Link 
        href="/apply-driver" 
        className="text-white hover:text-white/80 transition-colors"
      >
        Drive with Us
      </Link>
      <Link 
        href="/auth/signin" 
        className="text-white hover:text-white/80 transition-colors"
      >
        Sign In
      </Link>
      <Link 
        href="/auth/signup" 
        className="bg-white text-teal-600 px-4 py-2 rounded-full font-medium hover:bg-white/90 transition-colors"
      >
        Get Started
      </Link>
    </div>
  )
}