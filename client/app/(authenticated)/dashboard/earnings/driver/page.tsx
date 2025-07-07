'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DollarSign, TrendingUp, Calendar, Package, Clock, Download, CreditCard } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { TumbleButton } from '@/components/ui/tumble-button'
import { driverApi, EarningsData, EarningsHistory } from '@/lib/api'


export default function DriverEarningsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [earnings, setEarnings] = useState<EarningsData | null>(null)
  const [history, setHistory] = useState<EarningsHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week')

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    const user = session.user as any
    if (user.role !== 'driver') {
      router.push('/dashboard')
      return
    }

    loadEarnings()
  }, [session, status, router])

  const loadEarnings = async () => {
    if (!session) return

    try {
      setLoading(true)
      setError(null)
      
      const [earningsData, historyData] = await Promise.all([
        driverApi.getEarnings(session),
        driverApi.getEarningsHistory(session, { period: timeRange })
      ])
      
      setEarnings(earningsData)
      setHistory(historyData)
    } catch (err) {
      console.error('Failed to load earnings:', err)
      setError('Failed to load earnings data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEarnings()
  }, [timeRange])

  const downloadEarningsReport = () => {
    if (!earnings || !history) return
    
    // Create CSV content
    const csvContent = [
      ['Date', 'Orders', 'Earnings', 'Hours', 'Rate'],
      ...history.map(day => [
        day.date,
        day.orders.toString(),
        `$${day.earnings.toFixed(2)}`,
        day.hours.toFixed(1),
        `$${day.hours > 0 ? (day.earnings / day.hours).toFixed(2) : '0.00'}`
      ])
    ].map(row => row.join(',')).join('\n')
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `driver_earnings_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Driver Earnings" subtitle="Track your income and performance metrics" />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Driver Earnings" subtitle="Track your income and performance metrics" />
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 text-center">{error}</p>
        </div>
      </>
    )
  }

  if (!earnings) {
    return (
      <>
        <PageHeader title="Driver Earnings" subtitle="Track your income and performance metrics" />
        <div className="text-center py-12">
          <p className="text-gray-500">No earnings data available</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Driver Earnings" subtitle="Track your income and performance metrics" />
      
      <div className="mb-8 flex items-center justify-between">
        <div></div>
        <TumbleButton
          onClick={downloadEarningsReport}
          variant="default"
          className="flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Download Report</span>
        </TumbleButton>
      </div>

      {/* Earnings Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Earnings */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Today</h3>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.today.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Daily earnings</p>
        </div>

        {/* This Week */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">This Week</h3>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.thisWeek.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Weekly earnings</p>
        </div>

        {/* This Month */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">This Month</h3>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.thisMonth.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Monthly earnings</p>
        </div>

        {/* Total Earnings */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Total</h3>
            <CreditCard className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.total.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">All time earnings</p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Orders</h3>
            <Package className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{earnings.completedOrders}</p>
          <p className="text-sm text-gray-500 mt-1">Completed orders</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Average</h3>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.averagePerOrder.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Per order</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Hours</h3>
            <Clock className="w-8 h-8 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{earnings.hoursWorked}</p>
          <p className="text-sm text-gray-500 mt-1">Hours worked</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Rate</h3>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.hourlyRate.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Per hour</p>
        </div>
      </div>

      {/* Earnings History */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Earnings</h3>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'week' | 'month' | 'year')}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Earnings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((day, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(day.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.orders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${day.earnings.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {day.hours}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${day.hours > 0 ? (day.earnings / day.hours).toFixed(2) : '0.00'}/hr
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}