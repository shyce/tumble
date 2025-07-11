'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import stripePromise from '@/lib/stripe'
import { TumbleButton } from '@/components/ui/tumble-button'
import { addressApi } from '@/lib/api'
import { Loader2 } from 'lucide-react'

interface SubscriptionPaymentModalProps {
  planId: number
  isOpen: boolean
  onSuccess: () => void
  onCancel: () => void
}

function PaymentForm({ planId, onSuccess, onCancel }: { planId: number, onSuccess: () => void, onCancel: () => void }) {
  const { data: session } = useSession()
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || !session) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message || 'An error occurred')
        setIsLoading(false)
        return
      }

      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/subscription?setup=success`,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment setup failed')
        setIsLoading(false)
        return
      }

      if (setupIntent && setupIntent.status === 'succeeded') {
        // Check if user has default address before creating subscription
        try {
          const addresses = await addressApi.getAddresses(session)
          const hasDefaultAddress = addresses.some((addr) => addr.is_default)
          
          if (!hasDefaultAddress) {
            setError('Please set a default address in your account before subscribing. Go to Settings → Addresses to add your address for tax calculation.')
            setIsLoading(false)
            return
          }
        } catch (addressError) {
          setError('Unable to verify address. Please try again.')
          setIsLoading(false)
          return
        }

        // Create subscription with payment method
        const response = await fetch('/api/v1/payments/subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(session as any)?.accessToken}`,
          },
          body: JSON.stringify({
            plan_id: planId,
            payment_method_id: setupIntent.payment_method,
          }),
        })

        if (response.ok) {
          const subscriptionData = await response.json()
          
          // If subscription requires payment confirmation, confirm it
          if (subscriptionData.requires_action && subscriptionData.client_secret) {
            const { error: confirmError } = await stripe.confirmPayment({
              clientSecret: subscriptionData.client_secret,
              confirmParams: {
                return_url: `${window.location.origin}/dashboard/subscription?payment=success`,
              },
              redirect: 'if_required',
            })
            
            if (confirmError) {
              setError(confirmError.message || 'Payment confirmation failed')
              setIsLoading(false)
              return
            }
          }
          
          onSuccess()
        } else {
          const errorText = await response.text()
          
          if (errorText.includes('default address')) {
            setError('Please set a default address in your account before subscribing. Go to Settings → Addresses to add your address for tax calculation.')
          } else {
            const errorData = JSON.parse(errorText || '{}')
            setError(errorData.message || 'Failed to create subscription')
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900 mb-2">Add Payment Method</h3>
        <p className="text-slate-600">
          Please add a payment method to complete your subscription setup.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-slate-200 rounded-lg p-4">
          <PaymentElement 
            options={{
              layout: 'tabs'
            }}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <TumbleButton
            type="button"
            onClick={onCancel}
            variant="outline"
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </TumbleButton>
          <TumbleButton
            type="submit"
            disabled={!stripe || !elements || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              'Complete Subscription'
            )}
          </TumbleButton>
        </div>
      </form>
    </div>
  )
}

export default function SubscriptionPaymentModal({ planId, isOpen, onSuccess, onCancel }: SubscriptionPaymentModalProps) {
  const { data: session } = useSession()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && !clientSecret && session) {
      const createSetupIntent = async () => {
        setIsLoading(true)
        setError(null)

        try {
          const response = await fetch('/api/v1/payments/setup-intent', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${(session as any)?.accessToken}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            setClientSecret(data.client_secret)
          } else {
            setError('Failed to create setup intent')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
          setIsLoading(false)
        }
      }

      createSetupIntent()
    }
  }, [isOpen, clientSecret, session])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="max-w-md w-full">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Setting up payment...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Error</h3>
              <p className="text-red-600">{error}</p>
            </div>
            <TumbleButton onClick={onCancel} className="w-full">
              Close
            </TumbleButton>
          </div>
        ) : clientSecret ? (
          <Elements 
            stripe={stripePromise} 
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
              },
            }}
          >
            <PaymentForm planId={planId} onSuccess={onSuccess} onCancel={onCancel} />
          </Elements>
        ) : null}
      </div>
    </div>
  )
}