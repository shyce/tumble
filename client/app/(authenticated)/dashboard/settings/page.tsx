'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  User, Mail, Phone, MapPin, Bell, Shield, 
  Save, CheckCircle, Plus, Edit, Trash2, Home, Building2 
} from 'lucide-react'
import { addressApi, Address, CreateAddressRequest, UpdateAddressRequest } from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import { TumbleInput } from '@/components/ui/tumble-input'
import { TumbleButton } from '@/components/ui/tumble-button'
import { TumbleSelect } from '@/components/ui/tumble-select'
import { TumbleTextarea } from '@/components/ui/tumble-textarea'
import { TumbleCheckbox } from '@/components/ui/tumble-checkbox'
import { TumbleIconButton } from '@/components/ui/tumble-icon-button'
import { ChangePasswordModal } from '@/components/ui/change-password-modal'

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
    <>
      <PageHeader title="Account Settings" subtitle="Manage your profile and addresses" />

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
                <TumbleInput
                  type="text"
                  id="firstName"
                  label="First Name"
                  value={profile.firstName}
                  onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />

                <TumbleInput
                  type="text"
                  id="lastName"
                  label="Last Name"
                  value={profile.lastName}
                  onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />

                <TumbleInput
                  type="email"
                  id="email"
                  label={
                    <span className="flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      Email
                    </span>
                  }
                  value={profile.email}
                  onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                  required
                />

                <TumbleInput
                  type="tel"
                  id="phone"
                  label={
                    <span className="flex items-center">
                      <Phone className="w-4 h-4 mr-1" />
                      Phone
                    </span>
                  }
                  value={profile.phone}
                  onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="mt-6">
                <TumbleButton
                  type="submit"
                  disabled={loading}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Profile'}
                </TumbleButton>
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
              <TumbleButton
                onClick={() => setShowAddressForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Address
              </TumbleButton>
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
                          <TumbleButton
                            onClick={() => handleSetDefault(address.id)}
                            variant="ghost"
                            size="sm"
                          >
                            Set as Default
                          </TumbleButton>
                        )}
                        <TumbleIconButton
                          onClick={() => handleEditAddress(address)}
                          variant="ghost"
                          size="sm"
                        >
                          <Edit className="w-4 h-4" />
                        </TumbleIconButton>
                        {!address.is_default && (
                          <TumbleIconButton
                            onClick={() => handleDeleteAddress(address.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </TumbleIconButton>
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
                    <TumbleSelect
                      label="Address Type"
                      value={addressForm.type}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, type: e.target.value }))}
                      required
                    >
                      <option value="home">Home</option>
                      <option value="work">Work</option>
                      <option value="other">Other</option>
                    </TumbleSelect>

                    <div className="flex items-center">
                      <TumbleCheckbox
                        checked={addressForm.is_default}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, is_default: e.target.checked }))}
                        label="Set as default"
                      />
                    </div>
                  </div>

                  <TumbleInput
                    type="text"
                    label="Street Address"
                    value={addressForm.street_address}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, street_address: e.target.value }))}
                    placeholder="123 Main Street"
                    required
                  />

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="col-span-2 md:col-span-1">
                      <TumbleInput
                        type="text"
                        label="City"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                        required
                      />
                    </div>

                    <TumbleInput
                      type="text"
                      label="State"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value }))}
                      maxLength={2}
                      placeholder="CA"
                      required
                    />

                    <TumbleInput
                      type="text"
                      label="ZIP Code"
                      value={addressForm.zip_code}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, zip_code: e.target.value }))}
                      maxLength={10}
                      placeholder="12345"
                      required
                    />
                  </div>

                  <TumbleTextarea
                    label="Delivery Instructions (Optional)"
                    value={addressForm.delivery_instructions}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, delivery_instructions: e.target.value }))}
                    placeholder="Leave at front door, ring doorbell, etc."
                    rows={3}
                  />

                  <div className="flex space-x-4">
                    <TumbleButton
                      type="submit"
                      disabled={loading}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
                    </TumbleButton>
                    <TumbleButton
                      type="button"
                      onClick={cancelAddressForm}
                      variant="secondary"
                    >
                      Cancel
                    </TumbleButton>
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

            <ChangePasswordModal>
              <TumbleButton variant="outline">
                <Shield className="w-4 h-4 mr-2" />
                Change Password
              </TumbleButton>
            </ChangePasswordModal>
          </div>
        </div>
    </>
  )
}