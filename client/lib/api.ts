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

export interface UpdateSubscriptionRequest {
  status?: string // active, paused, cancelled
  plan_id?: number
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

export interface Address {
  id: number
  user_id: number
  type: string
  street_address: string
  apt_suite?: string
  city: string
  state: string
  zip_code: string
  delivery_instructions?: string
  is_default: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateAddressRequest {
  type: string
  street_address: string
  city: string
  state: string
  zip_code: string
  delivery_instructions?: string
  is_default: boolean
}

export interface UpdateAddressRequest {
  type?: string
  street_address?: string
  city?: string
  state?: string
  zip_code?: string
  delivery_instructions?: string
  is_default?: boolean
}

export interface Service {
  id: number
  name: string
  description: string
  base_price: number
  price_per_pound?: number
  is_active: boolean
}

export interface OrderItem {
  service_id: number
  service_name?: string
  quantity: number
  price: number
  notes?: string
}

export interface CreateOrderRequest {
  pickup_address_id: number
  delivery_address_id: number
  pickup_date: string
  delivery_date: string
  pickup_time_slot: string
  delivery_time_slot: string
  special_instructions?: string
  items: OrderItem[]
}

export interface Order {
  id: number
  user_id: number
  subscription_id?: number
  pickup_address_id: number
  delivery_address_id: number
  status: string
  total_weight?: number
  subtotal?: number
  tax?: number
  total?: number
  special_instructions?: string
  pickup_date: string
  delivery_date: string
  pickup_time_slot: string
  delivery_time_slot: string
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

export interface SubscriptionUsage {
  subscription_id: number
  current_period_start: string
  current_period_end: string
  pickups_used: number
  pickups_allowed: number
  pickups_remaining: number
  bags_used: number
  bags_allowed: number
  bags_remaining: number
}

export interface CostCalculation {
  subtotal: number
  subscription_discount: number
  final_subtotal: number
  tax: number
  tip: number
  total: number
  covered_bags: number
  has_subscription_benefits: boolean
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
  },

  async updateSubscription(subscriptionId: number, request: UpdateSubscriptionRequest): Promise<Subscription> {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/${subscriptionId}`, {
      method: 'PUT',
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

  async cancelSubscription(subscriptionId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
  },

  async getSubscriptionUsage(): Promise<SubscriptionUsage | null> {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/usage`, {
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

export const orderApi = {
  async createOrder(request: CreateOrderRequest): Promise<Order> {
    const response = await fetch(`${API_BASE_URL}/api/orders/create`, {
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

  async getOrders(): Promise<Order[]> {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  }
}

export const addressApi = {
  async getAddresses(): Promise<Address[]> {
    const response = await fetch(`${API_BASE_URL}/api/addresses`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async createAddress(request: CreateAddressRequest): Promise<Address> {
    const response = await fetch(`${API_BASE_URL}/api/addresses/create`, {
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

  async updateAddress(addressId: number, request: UpdateAddressRequest): Promise<Address> {
    const response = await fetch(`${API_BASE_URL}/api/addresses/${addressId}`, {
      method: 'PUT',
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

  async deleteAddress(addressId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/addresses/${addressId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
  }
}

export const serviceApi = {
  async getServices(): Promise<Service[]> {
    const response = await fetch(`${API_BASE_URL}/api/services`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  }
}