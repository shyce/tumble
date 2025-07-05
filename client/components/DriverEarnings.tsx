'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Calendar, Package, Clock, Download, CreditCard } from 'lucide-react'

interface EarningsData {
  today: number
  thisWeek: number
  thisMonth: number
  total: number
  completedOrders: number
  averagePerOrder: number
  hoursWorked: number
  hourlyRate: number
}

interface EarningsHistory {
  date: string
  orders: number
  earnings: number
  hours: number
}

export default function DriverEarnings() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null)
  const [history, setHistory] = useState<EarningsHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week')

  const loadEarnings = async () => {
    try {
      setLoading(true)
      // Mock data for now - replace with actual API call
      const mockEarnings: EarningsData = {
        today: 125.50,
        thisWeek: 847.25,
        thisMonth: 3420.75,
        total: 12847.90,
        completedOrders: 156,
        averagePerOrder: 21.95,
        hoursWorked: 38.5,
        hourlyRate: 22.00
      }
      
      const mockHistory: EarningsHistory[] = [
        { date: '2024-01-15', orders: 8, earnings: 175.25, hours: 7.5 },
        { date: '2024-01-14', orders: 12, earnings: 263.80, hours: 8.2 },
        { date: '2024-01-13', orders: 6, earnings: 132.50, hours: 6.0 },
        { date: '2024-01-12', orders: 10, earnings: 218.75, hours: 7.8 },
        { date: '2024-01-11', orders: 9, earnings: 197.40, hours: 7.2 }
      ]
      
      setEarnings(mockEarnings)
      setHistory(mockHistory)
    } catch (error) {
      console.error('Failed to load earnings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEarnings()
  }, [])

  const downloadEarningsReport = () => {
    // Mock download functionality
    console.log('Downloading earnings report...')
    alert('Earnings report download started!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!earnings) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Unable to load earnings data</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div></div>
        <button
          onClick={downloadEarningsReport}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download Report</span>
        </button>
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
                    ${(day.earnings / day.hours).toFixed(2)}/hr
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