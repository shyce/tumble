'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { TumbleButton } from '@/components/ui/tumble-button'
import { Loader2 } from 'lucide-react'

interface PaymentMethodSetupProps {
  planId: number
  clientSecret: string
  onSuccess: () => void
  onCancel: () => void
}

export default function PaymentMethodSetup({ planId, clientSecret, onSuccess, onCancel }: PaymentMethodSetupProps) {
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
      // Confirm the SetupIntent using the details collected by the Payment Element
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
          onSuccess()
        } else {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.message || 'Failed to create subscription')
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