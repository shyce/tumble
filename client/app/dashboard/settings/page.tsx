'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowLeft, User, Mail, Phone, MapPin, Bell, Shield, Save } from 'lucide-react'

interface UserProfile {
  id: number
  email: string
  firstName: string
  lastName: string
  phone: string
  address: {
    street: string
    apartment: string
    city: string
    state: string
    zipCode: string
  }
  preferences: {
    emailNotifications: boolean
    smsNotifications: boolean
    marketingEmails: boolean
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState<UserProfile>({
    id: 1,
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: {
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: ''
    },
    preferences: {
      emailNotifications: true,
      smsNotifications: true,
      marketingEmails: false
    }
  })

  useEffect(() => {
    // Load user data from localStorage
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setProfile(prev => ({
        ...prev,
        email: user.email || '',
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        phone: user.phone || ''
      }))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }, 1000)
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setProfile(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value
        }
      }))
    } else {
      setProfile(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center space-x-3">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg">
                    <Sparkles className="text-white w-5 h-5" />
                  </div>
                  <span className="text-slate-800 font-bold text-xl tracking-tight">Tumble</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Account Settings</h1>
          <p className="text-lg text-slate-600">Manage your profile and preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center mb-6">
              <User className="w-6 h-6 text-teal-500 mr-3" />
              <h2 className="text-xl font-bold text-slate-800">Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={profile.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={profile.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  <Mail className="inline w-4 h-4 mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={profile.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                  <Phone className="inline w-4 h-4 mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={profile.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Pickup/Delivery Address */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center mb-6">
              <MapPin className="w-6 h-6 text-emerald-500 mr-3" />
              <h2 className="text-xl font-bold text-slate-800">Pickup & Delivery Address</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="street" className="block text-sm font-medium text-slate-700 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  id="street"
                  value={profile.address.street}
                  onChange={(e) => handleInputChange('address.street', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                  placeholder="123 Main Street"
                />
              </div>

              <div>
                <label htmlFor="apartment" className="block text-sm font-medium text-slate-700 mb-2">
                  Apartment, Suite, etc. (Optional)
                </label>
                <input
                  type="text"
                  id="apartment"
                  value={profile.address.apartment}
                  onChange={(e) => handleInputChange('address.apartment', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                  placeholder="Apt 4B"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={profile.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-slate-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    value={profile.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label htmlFor="zipCode" className="block text-sm font-medium text-slate-700 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    id="zipCode"
                    value={profile.address.zipCode}
                    onChange={(e) => handleInputChange('address.zipCode', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                    maxLength={5}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center mb-6">
              <Bell className="w-6 h-6 text-teal-500 mr-3" />
              <h2 className="text-xl font-bold text-slate-800">Notification Preferences</h2>
            </div>

            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.preferences.emailNotifications}
                  onChange={(e) => handleInputChange('preferences.emailNotifications', e.target.checked)}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Email Notifications</span>
                  <p className="text-xs text-slate-600">Receive order updates and pickup reminders via email</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.preferences.smsNotifications}
                  onChange={(e) => handleInputChange('preferences.smsNotifications', e.target.checked)}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">SMS Notifications</span>
                  <p className="text-xs text-slate-600">Get text messages for urgent updates and delivery alerts</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.preferences.marketingEmails}
                  onChange={(e) => handleInputChange('preferences.marketingEmails', e.target.checked)}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Marketing Communications</span>
                  <p className="text-xs text-slate-600">Receive special offers and promotions from Tumble</p>
                </div>
              </label>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center mb-6">
              <Shield className="w-6 h-6 text-emerald-500 mr-3" />
              <h2 className="text-xl font-bold text-slate-800">Security</h2>
            </div>

            <button
              type="button"
              className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              Change Password
            </button>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className={`px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg flex items-center ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Save className="w-5 h-5 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>

            {saved && (
              <div className="flex items-center text-green-600">
                <CheckCircle className="w-5 h-5 mr-2" />
                <span className="font-medium">Changes saved successfully!</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}