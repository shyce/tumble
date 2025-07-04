const API_BASE_URL = '' // Use relative paths since we're behind nginx

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  role: string
  avatar_url?: string
  email_verified_at?: string
  created_at: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
}

export interface SubscriptionPlan {
  id: number
  name: string
  description: string
  price_per_month: number
  pounds_included: number
  price_per_extra_pound: number
  pickups_per_month: number
  is_active: boolean
}

export interface CreateSubscriptionRequest {
  plan_id: number
}

export interface Subscription {
  id: number
  user_id: number
  plan_id: number
  plan?: SubscriptionPlan
  status: string
  current_period_start: string
  current_period_end: string
  pounds_used_this_period: number
  pickups_used_this_period: number
  created_at: string
  updated_at: string
}

// Helper function to get auth token from localStorage
function getAuthToken(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token') || ''
  }
  return ''
}

export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      throw new Error('Invalid credentials')
    }

    return response.json()
  },

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Registration failed')
    }

    return response.json()
  },

  getGoogleAuthUrl(): string {
    return `${API_BASE_URL}/api/auth/google`
  }
}

export const subscriptionApi = {
  async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/plans`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getCurrentSubscription(): Promise<Subscription | null> {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/current`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null // No subscription found
      }
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  }
}