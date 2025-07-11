'use client'

import { Elements } from '@stripe/react-stripe-js'
import stripePromise from '@/lib/stripe'

interface StripeProviderProps {
  children: React.ReactNode
  clientSecret?: string
}

export default function StripeProvider({ children, clientSecret }: StripeProviderProps) {
  const options = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  } : undefined

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  )
}