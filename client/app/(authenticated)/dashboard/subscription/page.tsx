'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Calendar, CheckCircle, Package, Settings, Clock, MapPin, Save } from 'lucide-react'
import { 
  SubscriptionPlan, 
  Subscription, 
  SubscriptionPreferences, 
  CreateSubscriptionPreferencesRequest,
  SubscriptionUsage,
  SubscriptionChangePreview,
  subscriptionApi,
  addressApi,
  serviceApi,
  Address,
  Service
} from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import { TumbleButton } from '@/components/ui/tumble-button'
import SubscriptionPaymentModal from '@/components/SubscriptionPaymentModal'

export default function SubscriptionPage() {
  const { data: session, status } = useSession()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null)
  const [subscriptionUsage, setSubscriptionUsage] = useState<SubscriptionUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [plansLoading, setPlansLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Subscription preferences state
  const [preferences, setPreferences] = useState<SubscriptionPreferences | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [preferencesLoading, setPreferencesLoading] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)

  // Payment flow state
  const [showPaymentSetup, setShowPaymentSetup] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [showPlanChangePreview, setShowPlanChangePreview] = useState(false)
  const [planChangePreview, setPlanChangePreview] = useState<SubscriptionChangePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load subscription plans and current subscription
  useEffect(() => {
    if (status === 'loading') return
    
    const loadData = async () => {
      try {
        // Load plans first (this should always work - no auth required)
        const fetchedPlans = await subscriptionApi.getPlans()
        setPlans(fetchedPlans)
        
        // Then try to load current subscription and usage if user is logged in
        if (session?.user) {
          try {
            const [currentSub, usageData] = await Promise.all([
              subscriptionApi.getCurrentSubscription(session),
              subscriptionApi.getSubscriptionUsage(session)
            ])
            
            setCurrentSubscription(currentSub)
            setSubscriptionUsage(usageData)
          } catch (subError) {
            // It's okay if there's no current subscription, just log it
            console.log('No current subscription found:', subError)
            setCurrentSubscription(null)
            setSubscriptionUsage(null)
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
    
    // Check if user has a default address before proceeding
    try {
      const addresses = await addressApi.getAddresses(session)
      const hasDefaultAddress = addresses.some((addr) => addr.is_default)
      
      if (!hasDefaultAddress) {
        setError('Please set a default address in your account before subscribing. This is required for tax calculation. Go to Settings → Addresses to add your address.')
        return
      }
    } catch (err) {
      console.warn('Could not check addresses, proceeding with subscription attempt')
    }
    
    if (currentSubscription) {
      // Show plan change preview for existing subscription
      await showPlanChangePreviewModal(planId)
    } else {
      // New subscription - requires payment setup
      setSelectedPlanId(planId)
      setShowPaymentSetup(true)
    }
  }

  const showPlanChangePreviewModal = async (newPlanId: number) => {
    setPreviewLoading(true)
    setError(null)
    
    try {
      const preview = await subscriptionApi.previewSubscriptionChange(session, { new_plan_id: newPlanId })
      setPlanChangePreview(preview)
      setSelectedPlanId(newPlanId)
      setShowPlanChangePreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview plan change')
    } finally {
      setPreviewLoading(false)
    }
  }

  const confirmPlanChange = async () => {
    if (!currentSubscription || !selectedPlanId) return
    
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      const updated = await subscriptionApi.updateSubscription(session, currentSubscription.id, { plan_id: selectedPlanId })
      setCurrentSubscription(updated)
      setSuccess('Plan changed successfully! You will see the prorated charge/credit on your next invoice.')
      setShowPlanChangePreview(false)
      setPlanChangePreview(null)
      setSelectedPlanId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    setShowPaymentSetup(false)
    setSelectedPlanId(null)
    setSuccess('Subscription created successfully!')
    // Reload page data
    window.location.reload()
  }

  const handlePaymentCancel = () => {
    setShowPaymentSetup(false)
    setSelectedPlanId(null)
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
        const cancelledSubscription = await response.json()
        setCurrentSubscription(cancelledSubscription)
        setSuccess('Subscription cancelled successfully. Benefits will continue until the end of your current billing period.')
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

  // Helper function to determine if a plan is popular (Family Fresh)
  const isPlanPopular = (plan: SubscriptionPlan) => {
    return plan.name === 'Family Fresh'
  }

  // Helper function to calculate savings vs pay-as-you-go
  const calculateSavings = (plan: SubscriptionPlan) => {
    const payAsYouGoPrice = plan.pickups_per_month * 30 // $30 per standard bag
    const monthlySubPrice = plan.price_per_month
    const monthlySavings = payAsYouGoPrice - monthlySubPrice
    const yearlySavings = monthlySavings * 12
    
    return {
      payAsYouGoPrice,
      monthlySavings,
      yearlySavings
    }
  }

  // Helper function to get plan features based on plan details
  const getPlanFeatures = (plan: SubscriptionPlan) => {
    const baseFeatures = [
      `${plan.pickups_per_month} Standard Bag pickup${plan.pickups_per_month > 1 ? 's' : ''} per month`,
      `Up to ${plan.pickups_per_month * 2} loads total`,
      'Free delivery & pickup',
      'Priority scheduling'
    ]

    if (plan.name === 'Fresh Start') {
      baseFeatures.push('Extra bags: $30 each')
      baseFeatures.push('Perfect for: Students, singles, light laundry users')
    } else if (plan.name === 'Family Fresh') {
      baseFeatures.push('Extra bags: $30 each')
      baseFeatures.push('Perfect for: Small to medium families')
    } else if (plan.name === 'House Fresh') {
      baseFeatures.push('Extra bags: $30 each')
      baseFeatures.push('Perfect for: Large families, busy households')
    }

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
        title={currentSubscription ? 'Manage Your Subscription' : 'Fresh Laundry Plans'}
        subtitle={currentSubscription 
          ? 'Update your plan status or explore other subscription options.'
          : 'Choose the perfect plan for your laundry needs. Fresh Laundry. Fresh Start. Fresh Service.'
        }
      />

        {/* Payment Setup Modal */}
        <SubscriptionPaymentModal
          planId={selectedPlanId || 0}
          isOpen={showPaymentSetup && selectedPlanId !== null}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />

        {/* Plan Change Preview Modal */}
        {showPlanChangePreview && planChangePreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Confirm Plan Change</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Current Plan:</span>
                  <span className="font-medium">{planChangePreview.current_plan?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">New Plan:</span>
                  <span className="font-medium text-teal-600">{planChangePreview.new_plan?.name}</span>
                </div>
                
                {planChangePreview.immediate_charge > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Added to Next Bill:</span>
                    <span className="font-medium text-red-600">+${planChangePreview.immediate_charge.toFixed(2)}</span>
                  </div>
                )}
                
                {planChangePreview.immediate_credit > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Next Bill Discount:</span>
                    <span className="font-medium text-green-600">-${planChangePreview.immediate_credit.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Next Billing:</span>
                  <span className="font-medium">${planChangePreview.new_plan?.price_per_month}/month</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Renewal Date:</span>
                  <span className="font-medium">{new Date(planChangePreview.new_billing_date).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-700">{planChangePreview.proration_description}</p>
              </div>
              
              {planChangePreview.requires_payment_method && planChangePreview.proration_description.includes('⚠️') && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-orange-700">
                    Please add a payment method before upgrading to a higher plan.
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3">
                <TumbleButton
                  onClick={() => {
                    setShowPlanChangePreview(false)
                    setPlanChangePreview(null)
                    setSelectedPlanId(null)
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </TumbleButton>
                <TumbleButton
                  onClick={confirmPlanChange}
                  disabled={loading || (planChangePreview.requires_payment_method && planChangePreview.proration_description.includes('⚠️'))}
                  className="flex-1"
                >
                  {loading ? 'Processing...' : 'Confirm Change'}
                </TumbleButton>
              </div>
            </div>
          </div>
        )}

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
                    currentSubscription.status === 'cancelled' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {currentSubscription.status.charAt(0).toUpperCase() + currentSubscription.status.slice(1)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                {currentSubscription.status === 'active' && (
                  <TumbleButton
                    onClick={handleCancelSubscription}
                    disabled={loading}
                    variant="destructive"
                    className="w-full"
                  >
                    {loading ? 'Processing...' : 'Cancel Subscription'}
                  </TumbleButton>
                )}
                
                {currentSubscription.status === 'cancelled' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-orange-800 text-sm font-medium">
                      Subscription Cancelled
                    </p>
                    <p className="text-orange-700 text-sm mt-1">
                      Your benefits will continue until {new Date(currentSubscription.current_period_end).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                )}
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
              {subscriptionUsage ? (
                <div className="flex space-x-6 mt-2">
                  <p><strong>Pickups:</strong> {subscriptionUsage.pickups_used} of {subscriptionUsage.pickups_allowed} used this period</p>
                  <p><strong>Bags:</strong> {subscriptionUsage.bags_used} of {subscriptionUsage.bags_allowed} used this period</p>
                </div>
              ) : (
                <p><strong>Usage:</strong> {currentSubscription.pickups_used_this_period} of {currentSubscription.plan?.pickups_per_month} pickups used this period</p>
              )}
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

        {/* Plans Grid - Hide for cancelled subscriptions */}
        {(!currentSubscription || currentSubscription.status !== 'cancelled') && (
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {plans.filter(plan => plan.is_active).map((plan) => {
            const popular = isPlanPopular(plan)
            const features = getPlanFeatures(plan)
            const savings = calculateSavings(plan)
            const isCurrentPlan = currentSubscription?.plan_id === plan.id

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border-2 ${
                  isCurrentPlan ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200' :
                  popular ? 'border-teal-400 bg-gradient-to-br from-teal-50 to-emerald-50 ring-2 ring-teal-200' : 
                  'border-slate-200'
                } relative`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-emerald-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Current Plan
                    </span>
                  </div>
                )}
                
                {popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-teal-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <div className="flex items-center justify-center mb-3">
                    {plan.name === 'Fresh Start' && <span className="text-2xl mr-2">🌱</span>}
                    {plan.name === 'Family Fresh' && <span className="text-2xl mr-2">🏡</span>}
                    {plan.name === 'House Fresh' && <span className="text-2xl mr-2">🏠</span>}
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                  </div>
                  
                  {plan.name === 'Fresh Start' && (
                    <p className="text-slate-600 text-sm mb-4">Perfect for singles and students</p>
                  )}
                  {plan.name === 'Family Fresh' && (
                    <p className="text-slate-600 text-sm mb-4">Great for small families - Most Popular</p>
                  )}
                  {plan.name === 'House Fresh' && (
                    <p className="text-slate-600 text-sm mb-4">Ideal for large families and busy households</p>
                  )}

                  <div className="text-3xl font-bold text-teal-600 mb-4">
                    ${plan.price_per_month}
                    <span className="text-lg text-slate-500 font-normal">/month</span>
                  </div>

                  {/* Savings vs Pay-as-you-go */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3 mb-6">
                    <div className="text-center">
                      <div className="text-sm text-slate-600 mb-1">Pay-as-you-go would cost:</div>
                      <div className="text-lg font-semibold text-slate-800 line-through">${savings.payAsYouGoPrice}/month</div>
                      <div className="text-sm font-bold text-emerald-600">
                        💰 Save ${savings.monthlySavings}/month (${savings.yearlySavings}/year)
                      </div>
                    </div>
                  </div>

                  <ul className="text-left space-y-2 mb-6">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle className={`w-4 h-4 ${popular ? 'text-emerald-500' : 'text-teal-500'} mr-2 flex-shrink-0 mt-0.5`} />
                        <span className="text-slate-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <TumbleButton
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loading || isCurrentPlan || previewLoading}
                    variant={isCurrentPlan ? "outline" : "default"}
                    className={`w-full ${isCurrentPlan ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : ''}`}
                  >
                    {(loading || previewLoading) ? 'Processing...' : 
                     isCurrentPlan ? '✓ Active Plan' :
                     currentSubscription ? 'Switch to This Plan' : 'Choose This Plan'}
                  </TumbleButton>
                </div>
              </div>
            )
          })}
          </div>
        )}

        {/* Cancelled Subscription Notice */}
        {currentSubscription && currentSubscription.status === 'cancelled' && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 mb-12">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800">Subscription Cancelled</h3>
                <div className="mt-2 text-sm text-orange-700">
                  <p>Your subscription has been cancelled and will end on {new Date(currentSubscription.current_period_end).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}.</p>
                  <p className="mt-1">You cannot change plans while your subscription is cancelled. To select a different plan, you'll need to wait until your current subscription ends and then subscribe again.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pay-as-You-Go vs Subscription Comparison */}
        <div className="bg-white rounded-2xl p-8 shadow-lg mb-8">
          <div className="flex items-center mb-6">
            <Package className="w-6 h-6 text-teal-500 mr-3" />
            <h3 className="text-xl font-bold text-slate-800">Pay-as-You-Go Pricing</h3>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-slate-900 mb-4">Standard Service (No Subscription)</h4>
            <div className="grid gap-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Standard Bag (22"×33", ~2 loads)</span>
                <span className="font-bold text-slate-900">$30 each</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Rush Service (+faster turnaround)</span>
                <span className="font-bold text-slate-900">+$10 each</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Additional bags</span>
                <span className="font-bold text-slate-900">$30 each</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Sensitive Skin Detergent</span>
                <span className="font-bold text-slate-900">+$3/order</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Scent Booster</span>
                <span className="font-bold text-slate-900">+$3/order</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Bedding</span>
                <span className="font-bold text-slate-900">$25/item</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-red-700 mb-1">2 Bags/Month</div>
              <div className="text-2xl font-bold text-red-800">$90</div>
              <div className="text-sm text-red-600">vs Fresh Start: $48</div>
              <div className="text-xs font-semibold text-red-700 mt-1">You'd pay $42 more!</div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-red-700 mb-1">6 Bags/Month</div>
              <div className="text-2xl font-bold text-red-800">$270</div>
              <div className="text-sm text-red-600">vs Family Fresh: $130</div>
              <div className="text-xs font-semibold text-red-700 mt-1">You'd pay $140 more!</div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-red-700 mb-1">12 Bags/Month</div>
              <div className="text-2xl font-bold text-red-800">$540</div>
              <div className="text-sm text-red-600">vs House Fresh: $240</div>
              <div className="text-xs font-semibold text-red-700 mt-1">You'd pay $300 more!</div>
            </div>
          </div>
          
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm text-emerald-700 text-center">
              <strong>💡 Smart choice:</strong> Subscription plans include free pickup & delivery, priority scheduling, and massive savings compared to pay-as-you-go!
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Frequently Asked Questions</h2>
          <div className="grid gap-6 text-left">
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-slate-800 mb-2">What&apos;s included in a Standard Bag?</h3>
              <p className="text-slate-600 text-sm">
                A Standard Bag (22"×33") holds approximately 15-20 lbs of laundry, equivalent to about 
                2 loads in a home washing machine. Each bag costs $45 when purchased pay-as-you-go (includes pickup & delivery).
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-slate-800 mb-2">How much do I save with a subscription?</h3>
              <p className="text-slate-600 text-sm">
                Subscriptions offer significant savings! Fresh Start saves you $42/month ($504/year), 
                Family Fresh saves $140/month ($1,680/year), and House Fresh saves $300/month ($3,600/year) 
                compared to pay-as-you-go pricing of $45 per Standard Bag.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-slate-800 mb-2">What if I need extra bags beyond my subscription?</h3>
              <p className="text-slate-600 text-sm">
                No problem! Extra bags are available for $40 each, discounted from the $45 pay-as-you-go price. 
                Your subscription covers your monthly allowance, and you only pay for additional bags when needed.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-slate-800 mb-2">Can I cancel my subscription?</h3>
              <p className="text-slate-600 text-sm">
                Yes! You can cancel your subscription anytime from your dashboard. 
                Your benefits will continue until the end of your current billing period. 
                No long-term commitments required.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-slate-800 mb-2">Do subscription plans include pickup and delivery?</h3>
              <p className="text-slate-600 text-sm">
                Yes! All subscription plans include free pickup and delivery, plus priority scheduling. 
                Pay-as-you-go customers pay standard rates for both service and delivery.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-slate-800 mb-2">What happens to unused pickups at the end of the month?</h3>
              <p className="text-slate-600 text-sm">
                Unused pickups don't roll over to the next month - they expire at month-end. 
                We recommend using all your monthly allowance to get the most value from your subscription.
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