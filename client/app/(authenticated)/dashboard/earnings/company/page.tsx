'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DollarSign, TrendingUp, Calendar, Package, Users, Download, BarChart3 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { adminApi } from '@/lib/api'
import { TumbleButton } from '@/components/ui/tumble-button'

interface CompanyEarningsData {
  todayRevenue: number
  thisWeekRevenue: number
  thisMonthRevenue: number
  totalRevenue: number
  totalOrders: number
  activeDrivers: number
  averageOrderValue: number
  monthlyGrowth: number
}

interface MonthlyData {
  month: string
  revenue: number
  orders: number
  drivers: number
}

interface DriverPerformance {
  id: number
  name: string
  orders: number
  earnings: number
  rating: number
}

export default function CompanyEarningsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [earnings, setEarnings] = useState<CompanyEarningsData | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [topDrivers, setTopDrivers] = useState<DriverPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    const user = session.user as any
    if (user.role !== 'admin') {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  const loadCompanyEarnings = async () => {
    if (!session) return
    
    try {
      setLoading(true)
      
      // Fetch real data from APIs
      const [ordersSummary, revenueAnalytics, driverStats] = await Promise.all([
        adminApi.getOrdersSummary(session),
        adminApi.getRevenueAnalytics(session, timeRange === 'year' ? 'month' : timeRange === 'week' ? 'day' : 'month'),
        adminApi.getDriverStats(session)
      ])

      // Calculate real earnings data
      const earningsData: CompanyEarningsData = {
        todayRevenue: ordersSummary.today_revenue || 0,
        thisWeekRevenue: 0, // Calculate from analytics
        thisMonthRevenue: ordersSummary.total_revenue || 0,
        totalRevenue: ordersSummary.total_revenue || 0,
        totalOrders: ordersSummary.total_orders || 0,
        activeDrivers: driverStats.length || 0,
        averageOrderValue: ordersSummary.total_orders > 0 ? (ordersSummary.total_revenue / ordersSummary.total_orders) : 0,
        monthlyGrowth: 0 // Calculate from analytics
      }

      // Transform revenue analytics to monthly data
      const monthlyData: MonthlyData[] = revenueAnalytics.map(item => ({
        month: new Date(item.date).toLocaleDateString('en-US', { month: 'short' }),
        revenue: item.revenue,
        orders: item.order_count,
        drivers: driverStats.length // Simplified - could be more sophisticated
      }))

      // Calculate week revenue from daily analytics if available
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const weeklyRevenue = revenueAnalytics
        .filter(item => new Date(item.date) >= weekAgo)
        .reduce((sum, item) => sum + item.revenue, 0)
      earningsData.thisWeekRevenue = weeklyRevenue

      // Calculate monthly growth
      if (revenueAnalytics.length >= 2) {
        const currentMonth = revenueAnalytics[0]?.revenue || 0
        const lastMonth = revenueAnalytics[1]?.revenue || 0
        if (lastMonth > 0) {
          earningsData.monthlyGrowth = ((currentMonth - lastMonth) / lastMonth) * 100
        }
      }

      // Transform driver stats to top performers
      const topDrivers: DriverPerformance[] = driverStats
        .sort((a, b) => b.total_deliveries - a.total_deliveries)
        .slice(0, 5)
        .map(driver => ({
          id: driver.driver_id,
          name: driver.driver_name,
          orders: driver.total_deliveries,
          earnings: driver.total_deliveries * 25, // Estimated earnings - could be more accurate
          rating: driver.rating || 4.5
        }))
      
      setEarnings(earningsData)
      setMonthlyData(monthlyData.slice(0, 4)) // Show last 4 months
      setTopDrivers(topDrivers)
    } catch (error) {
      console.error('Failed to load company earnings:', error)
      // Set empty/default state on error
      setEarnings({
        todayRevenue: 0,
        thisWeekRevenue: 0,
        thisMonthRevenue: 0,
        totalRevenue: 0,
        totalOrders: 0,
        activeDrivers: 0,
        averageOrderValue: 0,
        monthlyGrowth: 0
      })
      setMonthlyData([])
      setTopDrivers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      loadCompanyEarnings()
    }
  }, [session, timeRange])

  const downloadReport = () => {
    // Mock download functionality
    console.log('Downloading company report...')
    alert('Company earnings report download started!')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Company Earnings" subtitle="Monitor company revenue and performance" />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </>
    )
  }

  if (!earnings) {
    return (
      <>
        <PageHeader title="Company Earnings" subtitle="Monitor company revenue and performance" />
        <div className="text-center py-12">
          <p className="text-gray-500">Unable to load company earnings data</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Company Earnings" subtitle="Monitor company revenue and performance" />
      
      <div className="mb-8 flex items-center justify-between">
        <div></div>
        <TumbleButton
          onClick={downloadReport}
          variant="default"
        >
          <Download className="w-4 h-4" />
          Download Report
        </TumbleButton>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Revenue */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Today</h3>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.todayRevenue.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Daily revenue</p>
        </div>

        {/* This Week */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">This Week</h3>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.thisWeekRevenue.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Weekly revenue</p>
        </div>

        {/* This Month */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">This Month</h3>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.thisMonthRevenue.toFixed(2)}</p>
          <p className="text-sm text-green-600 mt-1">+{earnings.monthlyGrowth}% growth</p>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Total Revenue</h3>
            <BarChart3 className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.totalRevenue.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">All time revenue</p>
        </div>
      </div>

      {/* Business Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Total Orders</h3>
            <Package className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{earnings.totalOrders}</p>
          <p className="text-sm text-gray-500 mt-1">This month</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Drivers</h3>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{earnings.activeDrivers}</p>
          <p className="text-sm text-gray-500 mt-1">Currently active</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Avg Order</h3>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">${earnings.averageOrderValue.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Order value</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Growth</h3>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{earnings.monthlyGrowth}%</p>
          <p className="text-sm text-gray-500 mt-1">Monthly growth</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Monthly Trends */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Trends</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {monthlyData.map((data, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">{data.month}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">${data.revenue.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{data.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Performing Drivers */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Top Drivers</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {topDrivers.map((driver, index) => (
                <div key={driver.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{driver.name}</p>
                      <p className="text-xs text-gray-500">{driver.orders} orders • ⭐ {driver.rating}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">${driver.earnings.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Revenue History Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Revenue History</h3>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'week' | 'month' | 'year')}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Drivers
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Order Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monthlyData.map((data, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.month} 2024
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${data.revenue.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.orders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data.drivers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${(data.revenue / data.orders).toFixed(2)}
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