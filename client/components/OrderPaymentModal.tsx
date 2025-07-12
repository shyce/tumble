'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import stripePromise from '@/lib/stripe'
import { TumbleButton } from '@/components/ui/tumble-button'
import { Loader2 } from 'lucide-react'

interface OrderPaymentModalProps {
  paymentIntentId: string
  orderTotal: number
  isOpen: boolean
  onSuccess: () => void
  onCancel: () => void
}

function PaymentForm({ paymentIntentId, orderTotal, onSuccess, onCancel }: { 
  paymentIntentId: string, 
  orderTotal: number, 
  onSuccess: () => void, 
  onCancel: () => void 
}) {
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

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/orders?payment=success`,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
        setIsLoading(false)
        return
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess()
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
        <h3 className="text-xl font-bold text-slate-900 mb-2">Complete Payment</h3>
        <p className="text-slate-600">
          Complete your payment of <span className="font-semibold">${orderTotal.toFixed(2)}</span> to schedule your pickup.
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
                Processing...
              </>
            ) : (
              `Pay $${orderTotal.toFixed(2)}`
            )}
          </TumbleButton>
        </div>
      </form>
    </div>
  )
}

export default function OrderPaymentModal({ paymentIntentId, orderTotal, isOpen, onSuccess, onCancel }: OrderPaymentModalProps) {
  const { data: session } = useSession()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && paymentIntentId && !clientSecret && session) {
      const getPaymentIntent = async () => {
        setIsLoading(true)
        setError(null)

        try {
          const response = await fetch(`/api/v1/payments/payment-intent/${paymentIntentId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${(session as any)?.accessToken}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            setClientSecret(data.client_secret)
          } else {
            setError('Failed to load payment details')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
          setIsLoading(false)
        }
      }

      getPaymentIntent()
    }
  }, [isOpen, paymentIntentId, clientSecret, session])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="max-w-md w-full">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading payment details...</p>
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
            <PaymentForm 
              paymentIntentId={paymentIntentId} 
              orderTotal={orderTotal} 
              onSuccess={onSuccess} 
              onCancel={onCancel} 
            />
          </Elements>
        ) : null}
      </div>
    </div>
  )
}