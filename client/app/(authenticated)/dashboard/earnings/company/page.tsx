'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DollarSign, TrendingUp, Calendar, Package, Users, Download, BarChart3 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

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
    try {
      setLoading(true)
      // Mock data for now - replace with actual API call
      const mockEarnings: CompanyEarningsData = {
        todayRevenue: 2847.50,
        thisWeekRevenue: 18423.75,
        thisMonthRevenue: 72890.25,
        totalRevenue: 234567.80,
        totalOrders: 1247,
        activeDrivers: 23,
        averageOrderValue: 58.45,
        monthlyGrowth: 12.5
      }
      
      const mockMonthlyData: MonthlyData[] = [
        { month: 'Jan', revenue: 65432.10, orders: 1120, drivers: 18 },
        { month: 'Feb', revenue: 71250.75, orders: 1285, drivers: 20 },
        { month: 'Mar', revenue: 68905.50, orders: 1198, drivers: 19 },
        { month: 'Apr', revenue: 72890.25, orders: 1247, drivers: 23 },
      ]

      const mockTopDrivers: DriverPerformance[] = [
        { id: 1, name: 'Alex Johnson', orders: 156, earnings: 3420.75, rating: 4.9 },
        { id: 2, name: 'Sarah Miller', orders: 142, earnings: 3124.50, rating: 4.8 },
        { id: 3, name: 'Mike Chen', orders: 134, earnings: 2987.25, rating: 4.7 },
        { id: 4, name: 'Emma Davis', orders: 128, earnings: 2845.90, rating: 4.8 },
        { id: 5, name: 'James Wilson', orders: 125, earnings: 2756.40, rating: 4.6 },
      ]
      
      setEarnings(mockEarnings)
      setMonthlyData(mockMonthlyData)
      setTopDrivers(mockTopDrivers)
    } catch (error) {
      console.error('Failed to load company earnings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanyEarnings()
  }, [])

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
        <button
          onClick={downloadReport}
          className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download Report</span>
        </button>
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