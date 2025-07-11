'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export function useSetupIntent() {
  const { data: session } = useSession()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSetupIntent = async () => {
    if (!session) return

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

  return {
    clientSecret,
    isLoading,
    error,
    createSetupIntent,
  }
}