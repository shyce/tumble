'use client'

import { useSession } from 'next-auth/react'
import MainNavigation from '@/components/MainNavigation'
import AuthGuard from '@/components/AuthGuard'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { data: session } = useSession()
  const user = session?.user as any

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

  return (
    <AuthGuard>
      <div className={`min-h-screen bg-gradient-to-br ${getGradientColors()}`}>
        <MainNavigation fullWidth={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </div>
    </AuthGuard>
  )
}