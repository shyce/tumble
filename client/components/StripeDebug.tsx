'use client'

import { useEffect, useState } from 'react'

export default function StripeDebug() {
  const [publishableKey, setPublishableKey] = useState<string | undefined>()

  useEffect(() => {
    setPublishableKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    console.log('Stripe publishable key:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'Found' : 'Missing')
  }, [])

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed top-4 right-4 bg-black text-white p-2 text-xs rounded z-50">
      Stripe Key: {publishableKey ? '✅' : '❌'}
    </div>
  )
}