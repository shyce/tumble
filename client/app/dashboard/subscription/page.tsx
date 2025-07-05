'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Sparkles, Calendar, CheckCircle, ArrowLeft, Package } from 'lucide-react'
import { SubscriptionPlan, Subscription } from '@/lib/api'
import Layout from '@/components/Layout'

export default function SubscriptionPage() {
  const { data: session, status } = useSession()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(false)
  const [plansLoading, setPlansLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

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
      <Layout requireAuth={true} title="Subscription Plans" subtitle="Loading your subscription options...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading subscription plans...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout 
      requireAuth={true} 
      title={currentSubscription ? 'Manage Your Subscription' : 'Choose Your Subscription'}
      subtitle={currentSubscription 
        ? 'Update your plan status or explore other subscription options.'
        : 'Select the perfect plan for your laundry needs. All plans include pickup, delivery, and professional care.'
      }
    >

        {/* Current Subscription Management */}
        {currentSubscription && (
          <div className="bg-white rounded-2xl p-8 shadow-lg max-w-3xl mx-auto mb-12">
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
                  <button
                    onClick={() => handleUpdateSubscription('paused')}
                    disabled={loading}
                    className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-yellow-600 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Pause Subscription'}
                  </button>
                )}
                
                {currentSubscription.status === 'paused' && (
                  <button
                    onClick={() => handleUpdateSubscription('active')}
                    disabled={loading}
                    className="w-full bg-emerald-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-emerald-600 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Resume Subscription'}
                  </button>
                )}
                
                <button
                  onClick={handleCancelSubscription}
                  disabled={loading}
                  className="w-full bg-red-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Cancel Subscription'}
                </button>
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

        {/* Success Message */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-8 max-w-3xl mx-auto">
            <p className="text-emerald-700 text-center">{success}</p>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 max-w-3xl mx-auto">
            <p className="text-red-700 text-center">{error}</p>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
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

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading || (currentSubscription?.plan_id === plan.id)}
                  className={`w-full py-4 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg ${
                    currentSubscription?.plan_id === plan.id
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : popular
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:from-teal-600 hover:to-emerald-600'
                      : 'bg-gradient-to-r from-slate-600 to-slate-700 text-white hover:from-slate-700 hover:to-slate-800'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? 'Processing...' : 
                   currentSubscription?.plan_id === plan.id ? 'Current Plan' :
                   currentSubscription ? 'Switch to Plan' : 'Select Plan'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Additional Options */}
        <div className="bg-white rounded-2xl p-8 shadow-lg max-w-3xl mx-auto">
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
          <div className="grid gap-6 max-w-3xl mx-auto text-left">
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
    </Layout>
  )
}