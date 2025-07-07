'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import { TumbleButton } from '@/components/ui/tumble-button'
import { TumbleIconButton } from '@/components/ui/tumble-icon-button'
import { Calendar, Clock, Save, CheckCircle, Plus, Trash2 } from 'lucide-react'

interface ScheduleSlot {
  id: number
  day_of_week: number // 0-6 (Sunday-Saturday)
  start_time: string // HH:MM format
  end_time: string
  is_available: boolean
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

export default function DriverSchedulePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

    loadSchedule()
  }, [session, status, router])

  const loadSchedule = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockSchedule: ScheduleSlot[] = [
        { id: 1, day_of_week: 1, start_time: '09:00', end_time: '17:00', is_available: true },
        { id: 2, day_of_week: 2, start_time: '09:00', end_time: '17:00', is_available: true },
        { id: 3, day_of_week: 3, start_time: '09:00', end_time: '17:00', is_available: true },
        { id: 4, day_of_week: 4, start_time: '09:00', end_time: '17:00', is_available: true },
        { id: 5, day_of_week: 5, start_time: '09:00', end_time: '17:00', is_available: true },
      ]
      setSchedule(mockSchedule)
    } catch (error) {
      console.error('Failed to load schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const addTimeSlot = (dayOfWeek: number) => {
    const newSlot: ScheduleSlot = {
      id: Date.now(), // Temporary ID
      day_of_week: dayOfWeek,
      start_time: '09:00',
      end_time: '17:00',
      is_available: true
    }
    setSchedule(prev => [...prev, newSlot])
  }

  const updateTimeSlot = (id: number, updates: Partial<ScheduleSlot>) => {
    setSchedule(prev => prev.map(slot => 
      slot.id === id ? { ...slot, ...updates } : slot
    ))
  }

  const removeTimeSlot = (id: number) => {
    setSchedule(prev => prev.filter(slot => slot.id !== id))
  }

  const saveSchedule = async () => {
    setSaving(true)
    try {
      // Mock save - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save schedule:', error)
      alert('Failed to save schedule. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getScheduleForDay = (dayOfWeek: number) => {
    return schedule.filter(slot => slot.day_of_week === dayOfWeek)
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="My Schedule" subtitle="Set your availability for deliveries" />
      <div className="max-w-4xl mx-auto">
        {/* Success Message */}
        {saved && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center text-emerald-700">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">Schedule saved successfully!</span>
            </div>
          </div>
        )}

        {/* Schedule Grid */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-xl font-bold text-gray-900">Weekly Availability</h2>
              </div>
              <TumbleButton
                onClick={saveSchedule}
                disabled={saving}
                variant="default"
                size="default"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Schedule'}
              </TumbleButton>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-6">
              {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                const daySchedule = getScheduleForDay(dayIndex)
                return (
                  <div key={dayIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{dayName}</h3>
                      <TumbleButton
                        onClick={() => addTimeSlot(dayIndex)}
                        variant="ghost"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Time Slot
                      </TumbleButton>
                    </div>

                    {daySchedule.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No availability set for {dayName}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {daySchedule.map((slot) => (
                          <div key={slot.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={slot.is_available}
                                onChange={(e) => updateTimeSlot(slot.id, { is_available: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm font-medium text-gray-700">Available</span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="time"
                                value={slot.start_time}
                                onChange={(e) => updateTimeSlot(slot.id, { start_time: e.target.value })}
                                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <span className="text-gray-500">to</span>
                              <input
                                type="time"
                                value={slot.end_time}
                                onChange={(e) => updateTimeSlot(slot.id, { end_time: e.target.value })}
                                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            <TumbleIconButton
                              onClick={() => removeTimeSlot(slot.id)}
                              variant="destructive"
                              size="sm"
                              tooltip="Remove time slot"
                            >
                              <Trash2 className="w-4 h-4" />
                            </TumbleIconButton>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Instructions */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">How it works</h4>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Set your availability for each day of the week</li>
                <li>• You can add multiple time slots per day</li>
                <li>• Orders will only be assigned during your available hours</li>
                <li>• Changes take effect immediately after saving</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}