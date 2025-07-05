'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import DriverEarnings from '@/components/DriverEarnings'
import CompanyEarnings from '@/components/CompanyEarnings'

export default function EarningsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    const user = session.user as any
    if (user.role !== 'driver' && user.role !== 'admin') {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
      </div>
    )
  }

  const user = session?.user as any
  const isDriver = user?.role === 'driver'
  const title = isDriver ? 'Driver Earnings' : 'Company Earnings'
  const subtitle = isDriver ? 'Track your income and performance metrics' : 'Monitor company revenue and performance'

  return (
    <Layout requireAuth={true} title={title} subtitle={subtitle}>
      {isDriver ? <DriverEarnings /> : <CompanyEarnings />}
    </Layout>
  )
}