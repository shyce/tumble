'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  User, Mail, Phone, MapPin, Bell, Shield, 
  Save, CheckCircle, Plus, Edit, Trash2, Home, Building2 
} from 'lucide-react'
import { addressApi, Address, CreateAddressRequest, UpdateAddressRequest } from '@/lib/api'
import Layout from '@/components/Layout'

interface UserProfile {
  id: number
  email: string
  firstName: string
  lastName: string
  phone: string
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [profile, setProfile] = useState<UserProfile>({
    id: 1,
    email: '',
    firstName: '',
    lastName: '',
    phone: ''
  })

  const [addressForm, setAddressForm] = useState<CreateAddressRequest>({
    type: 'home',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    delivery_instructions: '',
    is_default: false
  })

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    // Load user data from session
    const user = session.user as any
    setProfile({
      id: user.id || 1,
      email: user.email || '',
      firstName: user.first_name || user.name?.split(' ')[0] || '',
      lastName: user.last_name || user.name?.split(' ')[1] || '',
      phone: user.phone || ''
    })

    // Load addresses
    loadAddresses()
  }, [session, status, router])

  const loadAddresses = async () => {
    if (!session) return
    try {
      const addressData = await addressApi.getAddresses(session)
      setAddresses(addressData)
    } catch (error) {
      console.error('Failed to load addresses:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Simulate API call for profile update
    setTimeout(() => {
      setLoading(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }, 1000)
  }

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editingAddress) {
        // Update existing address
        const updatedAddress = await addressApi.updateAddress(session, editingAddress.id, addressForm)
        setAddresses(prev => prev.map(addr => 
          addr.id === editingAddress.id ? updatedAddress : addr
        ))
      } else {
        // Create new address
        const newAddress = await addressApi.createAddress(session, addressForm)
        setAddresses(prev => [...prev, newAddress])
      }

      // Reset form
      setAddressForm({
        type: 'home',
        street_address: '',
        city: '',
        state: '',
        zip_code: '',
        delivery_instructions: '',
        is_default: false
      })
      setShowAddressForm(false)
      setEditingAddress(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save address:', error)
      alert('Failed to save address. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEditAddress = (address: Address) => {
    setAddressForm({
      type: address.type,
      street_address: address.street_address,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      delivery_instructions: address.delivery_instructions || '',
      is_default: address.is_default
    })
    setEditingAddress(address)
    setShowAddressForm(true)
  }

  const handleDeleteAddress = async (addressId: number) => {
    if (!confirm('Are you sure you want to delete this address?')) {
      return
    }

    try {
      await addressApi.deleteAddress(session, addressId)
      setAddresses(prev => prev.filter(addr => addr.id !== addressId))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to delete address:', error)
      alert('Failed to delete address. Please try again.')
    }
  }

  const handleSetDefault = async (addressId: number) => {
    try {
      await addressApi.updateAddress(session, addressId, { is_default: true })
      // Reload addresses to get updated default status
      await loadAddresses()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to set default address:', error)
      alert('Failed to set default address. Please try again.')
    }
  }

  const cancelAddressForm = () => {
    setShowAddressForm(false)
    setEditingAddress(null)
    setAddressForm({
      type: 'home',
      street_address: '',
      city: '',
      state: '',
      zip_code: '',
      delivery_instructions: '',
      is_default: false
    })
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  return (
    <Layout requireAuth={true} title="Account Settings" subtitle="Manage your profile and addresses">
      <div className="max-w-4xl mx-auto">

        {/* Success Message */}
        {saved && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center text-emerald-700">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">Changes saved successfully!</span>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* Personal Information */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="flex items-center mb-6">
                <User className="w-6 h-6 text-teal-500 mr-3" />
                <h2 className="text-xl font-bold text-slate-800">Personal Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-semibold text-slate-800 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-semibold text-slate-800 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-800 mb-2">
                    <Mail className="inline w-4 h-4 mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={profile.email}
                    onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-slate-800 mb-2">
                    <Phone className="inline w-4 h-4 mr-1" />
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all flex items-center ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          </form>

          {/* Address Management */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <MapPin className="w-6 h-6 text-emerald-500 mr-3" />
                <h2 className="text-xl font-bold text-slate-800">Delivery Addresses</h2>
              </div>
              <button
                onClick={() => setShowAddressForm(true)}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Address
              </button>
            </div>

            {/* Address List */}
            {addresses.length > 0 ? (
              <div className="space-y-4">
                {addresses.map((address) => (
                  <div key={address.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {address.type === 'home' ? (
                            <Home className="w-4 h-4 text-slate-500" />
                          ) : (
                            <Building2 className="w-4 h-4 text-slate-500" />
                          )}
                          <span className="font-medium text-slate-800 capitalize">{address.type}</span>
                          {address.is_default && (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full font-medium">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-slate-700">
                          {address.street_address}
                        </p>
                        <p className="text-slate-600">
                          {address.city}, {address.state} {address.zip_code}
                        </p>
                        {address.delivery_instructions && (
                          <p className="text-slate-500 text-sm mt-1">
                            Instructions: {address.delivery_instructions}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {!address.is_default && (
                          <button
                            onClick={() => handleSetDefault(address.id)}
                            className="px-3 py-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                          >
                            Set as Default
                          </button>
                        )}
                        <button
                          onClick={() => handleEditAddress(address)}
                          className="p-2 text-slate-500 hover:text-slate-700"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {!address.is_default && (
                          <button
                            onClick={() => handleDeleteAddress(address.id)}
                            className="p-2 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No addresses added yet</p>
                <p className="text-slate-400 text-sm">Add an address to schedule pickups</p>
              </div>
            )}

            {/* Address Form */}
            {showAddressForm && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </h3>
                
                <form onSubmit={handleAddressSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Address Type
                      </label>
                      <select
                        value={addressForm.type}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white"
                        required
                      >
                        <option value="home">Home</option>
                        <option value="work">Work</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center space-x-2 mt-6">
                        <input
                          type="checkbox"
                          checked={addressForm.is_default}
                          onChange={(e) => setAddressForm(prev => ({ ...prev, is_default: e.target.checked }))}
                          className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                        />
                        <span className="text-sm font-medium text-slate-800">Set as default</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={addressForm.street_address}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, street_address: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white"
                      placeholder="123 Main Street"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        value={addressForm.state}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white"
                        maxLength={2}
                        placeholder="CA"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={addressForm.zip_code}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, zip_code: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white"
                        maxLength={10}
                        placeholder="12345"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Delivery Instructions (Optional)
                    </label>
                    <textarea
                      value={addressForm.delivery_instructions}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, delivery_instructions: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors text-slate-900 bg-white placeholder-slate-500"
                      placeholder="Leave at front door, ring doorbell, etc."
                      rows={3}
                    />
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-emerald-600 transition-all flex items-center ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelAddressForm}
                      className="px-6 py-3 bg-slate-500 text-white rounded-lg font-semibold hover:bg-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
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
        </div>
      </div>
    </Layout>
  )
}