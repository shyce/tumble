'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Sparkles, Calendar, CheckCircle, ArrowLeft, Package, Settings, Clock, MapPin, Save } from 'lucide-react'
import { 
  SubscriptionPlan, 
  Subscription, 
  SubscriptionPreferences, 
  CreateSubscriptionPreferencesRequest,
  subscriptionApi,
  addressApi,
  serviceApi,
  Address,
  Service
} from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import { TumbleButton } from '@/components/ui/tumble-button'

export default function SubscriptionPage() {
  const { data: session, status } = useSession()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(false)
  const [plansLoading, setPlansLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  // Subscription preferences state
  const [preferences, setPreferences] = useState<SubscriptionPreferences | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [preferencesLoading, setPreferencesLoading] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)

  // Load subscription plans and current subscription
  useEffect(() => {
    if (status === 'loading') return
    
    const loadData = async () => {
      try {
        // Load plans first (this should always work - no auth required)
        const plansResponse = await fetch('/api/v1/subscriptions/plans')
        if (plansResponse.ok) {
          const fetchedPlans = await plansResponse.json()
          setPlans(fetchedPlans)
        } else {
          throw new Error('Failed to fetch subscription plans')
        }
        
        // Then try to load current subscription if user is logged in
        if (session?.user) {
          try {
            const subResponse = await fetch('/api/v1/subscriptions/current', {
              headers: {
                'Authorization': `Bearer ${(session as any)?.accessToken}`,
              },
            })
            
            if (subResponse.ok) {
              const currentSub = await subResponse.json()
              setCurrentSubscription(currentSub)
            } else if (subResponse.status === 404) {
              // No subscription found, which is fine
              setCurrentSubscription(null)
            } else {
              console.log('Error fetching current subscription:', subResponse.status)
            }
          } catch (subError) {
            // It's okay if there's no current subscription, just log it
            console.log('No current subscription found:', subError)
            setCurrentSubscription(null)
          }
        }
      } catch (err) {
        console.error('Error loading subscription plans:', err)
        setError(err instanceof Error ? err.message : 'Failed to load subscription plans')
      } finally {
        setPlansLoading(false)
      }
    }

    loadData()
  }, [session, status])

  // Load subscription preferences and related data
  const loadPreferencesData = async () => {
    if (!session?.user) return

    setPreferencesLoading(true)
    try {
      const [prefsData, addressesData, servicesData] = await Promise.all([
        subscriptionApi.getSubscriptionPreferences(session),
        addressApi.getAddresses(session),
        serviceApi.getServices()
      ])

      setPreferences(prefsData)
      setAddresses(addressesData)
      setServices(servicesData)
    } catch (err) {
      console.error('Error loading preferences data:', err)
      setError('Failed to load preferences data')
    } finally {
      setPreferencesLoading(false)
    }
  }

  const handleSubscribe = async (planId: number) => {
    if (!session?.user) {
      setError('You must be logged in to subscribe')
      return
    }
    
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      if (currentSubscription) {
        // Update existing subscription to new plan
        const response = await fetch(`/api/v1/subscriptions/${currentSubscription.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(session as any)?.accessToken}`,
          },
          body: JSON.stringify({ plan_id: planId }),
        })
        
        if (response.ok) {
          const updated = await response.json()
          setCurrentSubscription(updated)
          setSuccess('Plan changed successfully')
        } else {
          throw new Error('Failed to update subscription plan')
        }
      } else {
        // Create new subscription
        const response = await fetch('/api/v1/subscriptions/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(session as any)?.accessToken}`,
          },
          body: JSON.stringify({ plan_id: planId }),
        })
        
        if (response.ok) {
          router.push('/dashboard')
        } else {
          throw new Error('Failed to create subscription')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSubscription = async (status: string) => {
    if (!currentSubscription || !session?.user) return
    
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch(`/api/v1/subscriptions/${currentSubscription.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({ status }),
      })
      
      if (response.ok) {
        const updated = await response.json()
        setCurrentSubscription(updated)
        setSuccess(`Subscription ${status} successfully`)
      } else {
        throw new Error('Failed to update subscription status')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!currentSubscription || !session?.user) return
    
    if (!confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
      return
    }
    
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch(`/api/v1/subscriptions/${currentSubscription.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(session as any)?.accessToken}`,
        },
      })
      
      if (response.ok) {
        setCurrentSubscription(null)
        setSuccess('Subscription cancelled successfully')
      } else {
        throw new Error('Failed to cancel subscription')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePreferences = async (prefsData: CreateSubscriptionPreferencesRequest) => {
    if (!session?.user) return

    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      await subscriptionApi.createOrUpdateSubscriptionPreferences(session, prefsData)
      setSuccess('Preferences saved successfully')
      
      // Reload preferences to get updated data
      await loadPreferencesData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setLoading(false)
    }
  }

  // Helper function to determine if a plan is popular (Weekly Standard)
  const isPlanPopular = (plan: SubscriptionPlan) => {
    return plan.name === 'Weekly Standard'
  }

  // Helper function to get plan features based on plan details
  const getPlanFeatures = (plan: SubscriptionPlan) => {
    const baseFeatures = [
      `${plan.pickups_per_month} bags per month ($45 value each)`,
      'Pickup & delivery included',
      'Professional wash & fold',
      'Eco-friendly detergents',
    ]

    if (plan.name.includes('Weekly')) {
      baseFeatures.push('24-hour turnaround', 'Priority support')
      if (plan.name.includes('Standard')) {
        baseFeatures.splice(1, 0, 'Save $10/month vs pay-per-bag')
      }
    } else {
      baseFeatures.push('48-hour turnaround')
    }

    baseFeatures.push('Add sensitive skin detergent +$3', 'Add scent booster +$3')
    return baseFeatures
  }

  if (plansLoading) {
    return (
      <>
        <PageHeader title="Subscription Plans" subtitle="Loading your subscription options..." />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading subscription plans...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader 
        title={currentSubscription ? 'Manage Your Subscription' : 'Choose Your Subscription'}
        subtitle={currentSubscription 
          ? 'Update your plan status or explore other subscription options.'
          : 'Select the perfect plan for your laundry needs. All plans include pickup, delivery, and professional care.'
        }
      />

        {/* Current Subscription Management */}
        {currentSubscription && (
          <div className="bg-white rounded-2xl p-8 shadow-lg mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Current Subscription</h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">{currentSubscription.plan?.name}</h3>
                <p className="text-slate-600 mb-4">${currentSubscription.plan?.price_per_month}/month</p>
                <div className="flex items-center mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    currentSubscription.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                    currentSubscription.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {currentSubscription.status.charAt(0).toUpperCase() + currentSubscription.status.slice(1)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                {currentSubscription.status === 'active' && (
                  <TumbleButton
                    onClick={() => handleUpdateSubscription('paused')}
                    disabled={loading}
                    variant="outline"
                    className="w-full border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                  >
                    {loading ? 'Processing...' : 'Pause Subscription'}
                  </TumbleButton>
                )}
                
                {currentSubscription.status === 'paused' && (
                  <TumbleButton
                    onClick={() => handleUpdateSubscription('active')}
                    disabled={loading}
                    variant="default"
                    className="w-full"
                  >
                    {loading ? 'Processing...' : 'Resume Subscription'}
                  </TumbleButton>
                )}
                
                <TumbleButton
                  onClick={handleCancelSubscription}
                  disabled={loading}
                  variant="destructive"
                  className="w-full"
                >
                  {loading ? 'Processing...' : 'Cancel Subscription'}
                </TumbleButton>
              </div>
            </div>
            
            <div className="text-sm text-slate-600">
              <p><strong>Period:</strong> {new Date(currentSubscription.current_period_start).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} to {new Date(currentSubscription.current_period_end).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
              <p><strong>Usage:</strong> {currentSubscription.pickups_used_this_period} of {currentSubscription.plan?.pickups_per_month} pickups used this period</p>
            </div>
          </div>
        )}

        {/* Subscription Preferences Section */}
        {currentSubscription && (
          <div className="bg-white rounded-2xl shadow-lg mb-12">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Settings className="w-6 h-6 text-purple-600 mr-3" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Auto-Schedule Preferences</h3>
                    <p className="text-slate-600 text-sm">Set your default preferences for automatic order scheduling</p>
                  </div>
                </div>
                <TumbleButton
                  onClick={() => {
                    setShowPreferences(!showPreferences)
                    if (!showPreferences && !preferences) {
                      loadPreferencesData()
                    }
                  }}
                  variant="default"
                >
                  {showPreferences ? 'Hide Settings' : 'Configure Settings'}
                </TumbleButton>
              </div>
            </div>

            {showPreferences && (
              <div className="p-6">
                {preferencesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3"></div>
                    <span className="text-slate-600">Loading preferences...</span>
                  </div>
                ) : (
                  <SubscriptionPreferencesForm
                    preferences={preferences}
                    addresses={addresses}
                    services={services}
                    onSave={handleSavePreferences}
                    loading={loading}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-8">
            <p className="text-emerald-700 text-center">{success}</p>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-700 text-center">{error}</p>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {plans.filter(plan => plan.is_active).map((plan) => {
            const popular = isPlanPopular(plan)
            const features = getPlanFeatures(plan)
            const frequency = plan.name.includes('Weekly') ? 'weekly' : 'bi-weekly'

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 ${
                  popular ? 'border-teal-200' : 'border-slate-200'
                } relative`}
              >
                {popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="flex items-center mb-6">
                  <Calendar className={`w-6 h-6 ${popular ? 'text-emerald-500' : 'text-teal-500'} mr-3`} />
                  <h3 className="text-2xl font-bold text-slate-800">{plan.name}</h3>
                </div>

                <div className="text-4xl font-bold text-slate-900 mb-2">
                  ${plan.price_per_month}
                  <span className="text-lg text-slate-500 font-normal">/month</span>
                </div>

                <p className="text-slate-600 mb-6">
                  {plan.pickups_per_month} bags per month ({frequency} pickup)
                </p>

                <ul className="space-y-3 mb-8">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className={`w-5 h-5 ${popular ? 'text-emerald-500' : 'text-teal-500'} mr-3 flex-shrink-0 mt-0.5`} />
                      <span className="text-slate-600 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <TumbleButton
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading || (currentSubscription?.plan_id === plan.id)}
                  variant={currentSubscription?.plan_id === plan.id ? "secondary" : "default"}
                  className="w-full"
                >
                  {loading ? 'Processing...' : 
                   currentSubscription?.plan_id === plan.id ? 'Current Plan' :
                   currentSubscription ? 'Switch to Plan' : 'Select Plan'}
                </TumbleButton>
              </div>
            )
          })}
        </div>

        {/* Additional Options */}
        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <div className="flex items-center mb-4">
            <Package className="w-6 h-6 text-teal-500 mr-3" />
            <h3 className="text-xl font-bold text-slate-800">Additional Services & Pricing</h3>
          </div>
          
          <div className="grid gap-4 mb-6">
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <div>
                <h4 className="font-semibold text-slate-800">Additional Standard Bags</h4>
                <p className="text-sm text-slate-600">Add extra bags to any order</p>
              </div>
              <span className="font-bold text-slate-900">$40/bag</span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <div>
                <h4 className="font-semibold text-slate-800">Rush Service</h4>
                <p className="text-sm text-slate-600">24-hour turnaround for urgent needs</p>
              </div>
              <span className="font-bold text-slate-900">$55/bag</span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <div>
                <h4 className="font-semibold text-slate-800">Sensitive Skin Detergent</h4>
                <p className="text-sm text-slate-600">Hypoallergenic option for sensitive skin</p>
              </div>
              <span className="font-bold text-slate-900">+$3/order</span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <div>
                <h4 className="font-semibold text-slate-800">Scent Booster</h4>
                <p className="text-sm text-slate-600">Extra fresh scent for your laundry</p>
              </div>
              <span className="font-bold text-slate-900">+$3/order</span>
            </div>
            
            <div className="flex justify-between items-center py-3">
              <div>
                <h4 className="font-semibold text-slate-800">Comforter Cleaning</h4>
                <p className="text-sm text-slate-600">Professional cleaning for bedding</p>
              </div>
              <span className="font-bold text-slate-900">$25/item</span>
            </div>
          </div>
          
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <p className="text-sm text-teal-700">
              <strong>Pro tip:</strong> Subscription plans offer the best value! Weekly subscribers save $10/month compared to pay-per-bag pricing.
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Frequently Asked Questions</h2>
          <div className="grid gap-6 text-left">
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-slate-800 mb-2">What&apos;s included in a standard bag?</h3>
              <p className="text-slate-600 text-sm">
                A standard bag holds approximately 15-20 lbs of laundry, equivalent to about 
                2-3 loads in a home washing machine. Each bag is valued at $45 when purchased individually.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-slate-800 mb-2">Can I pause or cancel my subscription?</h3>
              <p className="text-slate-600 text-sm">
                Yes! You can pause or cancel your subscription anytime from your dashboard. 
                No long-term commitments required.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-slate-800 mb-2">When will my first pickup be scheduled?</h3>
              <p className="text-slate-600 text-sm">
                After subscribing, you can schedule your first pickup for any available slot 
                starting from the next business day.
              </p>
            </div>
          </div>
        </div>
    </>
  )
}

// Subscription Preferences Form Component
interface SubscriptionPreferencesFormProps {
  preferences: SubscriptionPreferences | null
  addresses: Address[]
  services: Service[]
  onSave: (data: CreateSubscriptionPreferencesRequest) => void
  loading: boolean
}

function SubscriptionPreferencesForm({ preferences, addresses, services, onSave, loading }: SubscriptionPreferencesFormProps) {
  const [formData, setFormData] = useState<CreateSubscriptionPreferencesRequest>({
    default_pickup_address_id: preferences?.default_pickup_address_id,
    default_delivery_address_id: preferences?.default_delivery_address_id,
    preferred_pickup_time_slot: preferences?.preferred_pickup_time_slot || '8:00 AM - 12:00 PM',
    preferred_delivery_time_slot: preferences?.preferred_delivery_time_slot || '8:00 AM - 12:00 PM',
    preferred_pickup_day: preferences?.preferred_pickup_day || 'monday',
    default_services: preferences?.default_services || [{ service_id: 1, quantity: 1 }],
    auto_schedule_enabled: preferences?.auto_schedule_enabled ?? true,
    lead_time_days: preferences?.lead_time_days || 1,
    special_instructions: preferences?.special_instructions || ''
  })

  const timeSlots = [
    '8:00 AM - 12:00 PM',
    '12:00 PM - 4:00 PM',
    '4:00 PM - 8:00 PM'
  ]

  const weekdays = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' }
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const updateDefaultService = (index: number, field: 'service_id' | 'quantity', value: number) => {
    const newServices = [...formData.default_services]
    newServices[index] = { ...newServices[index], [field]: value }
    setFormData({ ...formData, default_services: newServices })
  }

  const addDefaultService = () => {
    setFormData({
      ...formData,
      default_services: [...formData.default_services, { service_id: 1, quantity: 1 }]
    })
  }

  const removeDefaultService = (index: number) => {
    if (formData.default_services.length > 1) {
      const newServices = formData.default_services.filter((_, i) => i !== index)
      setFormData({ ...formData, default_services: newServices })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Auto-Schedule Toggle */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-purple-600 mr-2" />
            <div>
              <h4 className="font-semibold text-slate-900">Auto-Schedule Weekly Pickups</h4>
              <p className="text-sm text-slate-600">
                Automatically schedule your monthly pickups using your preferences below
              </p>
              <p className="text-xs text-purple-600 mt-1">
                💡 When enabled, we'll create orders for you so you never have to remember to schedule pickups
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.auto_schedule_enabled}
              onChange={(e) => setFormData({ ...formData, auto_schedule_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Default Addresses */}
        <div className="space-y-4">
          <h4 className="font-semibold text-slate-900 flex items-center">
            <MapPin className="w-4 h-4 mr-2" />
            Default Addresses
          </h4>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pickup Address</label>
            <select
              value={formData.default_pickup_address_id || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                default_pickup_address_id: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select pickup address...</option>
              {addresses.map(addr => (
                <option key={addr.id} value={addr.id}>
                  {addr.street_address}, {addr.city}, {addr.state} {addr.zip_code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Address</label>
            <select
              value={formData.default_delivery_address_id || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                default_delivery_address_id: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select delivery address...</option>
              {addresses.map(addr => (
                <option key={addr.id} value={addr.id}>
                  {addr.street_address}, {addr.city}, {addr.state} {addr.zip_code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Your Auto-Schedule Settings */}
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-slate-900 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Your Weekly Pickup Schedule
            </h4>
            <p className="text-sm text-slate-600 mt-1">
              Choose when you want your regular pickups to happen each week
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Which day of the week?
              <span className="text-xs text-slate-500 font-normal ml-1">(We'll pickup on this day every week)</span>
            </label>
            <select
              value={formData.preferred_pickup_day}
              onChange={(e) => setFormData({ ...formData, preferred_pickup_day: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {weekdays.map(day => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pickup time window
              <span className="text-xs text-slate-500 font-normal ml-1">(When our driver will arrive)</span>
            </label>
            <select
              value={formData.preferred_pickup_time_slot}
              onChange={(e) => setFormData({ ...formData, preferred_pickup_time_slot: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {timeSlots.map(slot => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Delivery time window
              <span className="text-xs text-slate-500 font-normal ml-1">(Usually 1-2 days after pickup)</span>
            </label>
            <select
              value={formData.preferred_delivery_time_slot}
              onChange={(e) => setFormData({ ...formData, preferred_delivery_time_slot: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {timeSlots.map(slot => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              How far ahead to create orders?
              <span className="text-xs text-slate-500 font-normal ml-1">(So you can see what's coming up)</span>
            </label>
            <select
              value={formData.lead_time_days}
              onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value={1}>1 day ahead (Create tomorrow's order today)</option>
              <option value={2}>2 days ahead (Create orders 2 days early)</option>
              <option value={3}>3 days ahead (Create orders 3 days early)</option>
              <option value={7}>1 week ahead (Create orders a week early)</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              📅 Example: If you choose "1 day ahead" and prefer Monday pickups, we'll create your Monday pickup order on Sunday.
            </p>
          </div>
        </div>
      </div>

      {/* What to pickup each time */}
      <div>
        <div className="mb-4">
          <h4 className="font-semibold text-slate-900 flex items-center">
            <Package className="w-4 h-4 mr-2" />
            What should we pick up each time?
          </h4>
          <p className="text-sm text-slate-600 mt-1">
            These services will be included in every auto-scheduled pickup (covered by your subscription)
          </p>
        </div>
        <div className="space-y-3">
          {formData.default_services.map((service, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg">
              <select
                value={service.service_id}
                onChange={(e) => updateDefaultService(index, 'service_id', parseInt(e.target.value))}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {services.filter(service => service.name !== 'pickup_service').map(s => (
                  <option key={s.id} value={s.id}>{s.name.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="10"
                value={service.quantity}
                onChange={(e) => updateDefaultService(index, 'quantity', parseInt(e.target.value))}
                className="w-20 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {formData.default_services.length > 1 && (
                <TumbleButton
                  type="button"
                  onClick={() => removeDefaultService(index)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </TumbleButton>
              )}
            </div>
          ))}
          <TumbleButton
            type="button"
            onClick={addDefaultService}
            variant="ghost"
            size="sm"
            className="text-purple-600 hover:text-purple-700"
          >
            + Add Service
          </TumbleButton>
        </div>
      </div>

      {/* Special Instructions */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Special Instructions</label>
        <textarea
          value={formData.special_instructions}
          onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
          placeholder="Any special handling instructions for your recurring orders..."
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <TumbleButton
          type="submit"
          disabled={loading}
          variant="default"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Preferences'}
        </TumbleButton>
      </div>
    </form>
  )
}