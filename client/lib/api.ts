import { authFetchWithSession } from './auth-fetch'
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  Truck, 
  AlertCircle,
  Package
} from 'lucide-react'

const API_BASE_URL = '' // Use relative paths since we're behind nginx

// Shared order status configuration
export interface OrderStatus {
  color: string
  icon: any
  label: string
}

export const statusConfig: Record<string, OrderStatus> = {
  pending: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Pending' },
  scheduled: { color: 'bg-blue-100 text-blue-800', icon: Calendar, label: 'Scheduled' },
  picked_up: { color: 'bg-orange-100 text-orange-800', icon: Truck, label: 'Picked Up' },
  in_process: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'In Process' },
  ready: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Ready' },
  out_for_delivery: { color: 'bg-indigo-100 text-indigo-800', icon: Truck, label: 'Out for Delivery' },
  delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Delivered' },
  failed: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Failed' },
  cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Cancelled' }
}

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

export interface SubscriptionChangePreview {
  current_plan: SubscriptionPlan
  new_plan: SubscriptionPlan
  immediate_charge: number
  immediate_credit: number
  proration_description: string
  new_billing_date: string
  requires_payment_method: boolean
}

export interface PreviewSubscriptionChangeRequest {
  new_plan_id: number
}

// Service request for subscription preferences
export interface ServiceRequest {
  service_id: number
  quantity: number
}

// Subscription preferences for auto-scheduling
export interface SubscriptionPreferences {
  id: number
  user_id: number
  default_pickup_address_id?: number
  default_delivery_address_id?: number
  preferred_pickup_time_slot: string
  preferred_delivery_time_slot: string
  preferred_pickup_day: string
  default_services: ServiceRequest[]
  auto_schedule_enabled: boolean
  lead_time_days: number
  special_instructions: string
  created_at: string
  updated_at: string
}

// Request body for creating/updating subscription preferences
export interface CreateSubscriptionPreferencesRequest {
  default_pickup_address_id?: number
  default_delivery_address_id?: number
  preferred_pickup_time_slot: string
  preferred_delivery_time_slot: string
  preferred_pickup_day: string
  default_services: ServiceRequest[]
  auto_schedule_enabled: boolean
  lead_time_days: number
  special_instructions: string
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

export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
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
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
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

  async changePassword(session: any, currentPassword: string, newPassword: string): Promise<void> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to change password')
    }
  },

  getGoogleAuthUrl(): string {
    return `${API_BASE_URL}/api/v1/auth/google`
  }
}

export const subscriptionApi = {
  async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/subscriptions/plans`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async createSubscription(session: any, request: CreateSubscriptionRequest): Promise<Subscription> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/subscriptions/create`, {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getCurrentSubscription(session: any): Promise<Subscription | null> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/subscriptions/current`)

    if (!response.ok) {
      if (response.status === 404) {
        return null // No subscription found
      }
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async updateSubscription(session: any, subscriptionId: number, request: UpdateSubscriptionRequest): Promise<Subscription> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/subscriptions/${subscriptionId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async cancelSubscription(session: any, subscriptionId: number): Promise<void> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
  },

  async getSubscriptionUsage(session: any): Promise<SubscriptionUsage | null> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/subscriptions/usage`)

    if (!response.ok) {
      if (response.status === 404) {
        return null // No subscription found
      }
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getSubscriptionPreferences(session: any): Promise<SubscriptionPreferences | null> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/subscriptions/preferences`)

    if (!response.ok) {
      if (response.status === 404) {
        return null // No preferences found, will return defaults
      }
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async createOrUpdateSubscriptionPreferences(session: any, request: CreateSubscriptionPreferencesRequest): Promise<{ message: string }> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/subscriptions/preferences`, {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },
  async previewSubscriptionChange(session: any, request: PreviewSubscriptionChangeRequest): Promise<SubscriptionChangePreview> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/subscriptions/preview-change`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    return response.json()
  }
}

export const orderApi = {
  async createOrder(session: any, request: CreateOrderRequest): Promise<Order> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/orders/create`, {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getOrders(session: any): Promise<Order[]> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/orders`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  }
}

export const addressApi = {
  async getAddresses(session: any): Promise<Address[]> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/addresses`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async createAddress(session: any, request: CreateAddressRequest): Promise<Address> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/addresses/create`, {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async updateAddress(session: any, addressId: number, request: UpdateAddressRequest): Promise<Address> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/addresses/${addressId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async deleteAddress(session: any, addressId: number): Promise<void> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/addresses/${addressId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
  }
}

export const serviceApi = {
  async getServices(): Promise<Service[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/services`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  }
}

export interface RouteOrderStatusRequest {
  status: 'pending' | 'completed' | 'failed'
}

export interface EarningsData {
  today: number
  thisWeek: number
  thisMonth: number
  total: number
  completedOrders: number
  averagePerOrder: number
  hoursWorked: number
  hourlyRate: number
}

export interface EarningsHistory {
  date: string
  orders: number
  earnings: number
  hours: number
}

export const driverApi = {
  async getRoutes(session: any): Promise<any[]> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/driver/routes`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async updateRouteOrderStatus(session: any, routeOrderId: number, request: RouteOrderStatusRequest): Promise<{ message: string }> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/driver/route-orders/status?id=${routeOrderId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getCompletedDeliveries(session: any, params?: { period?: string }): Promise<any[]> {
    const searchParams = new URLSearchParams()
    if (params?.period) searchParams.append('period', params.period)

    const url = `${API_BASE_URL}/api/v1/driver/routes${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    const response = await authFetchWithSession(session, url)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const routes = await response.json()
    
    // Filter to only completed route orders and flatten the data
    const completedDeliveries: any[] = []
    routes.forEach((route: any) => {
      route.orders?.forEach((order: any) => {
        if (order.status === 'completed') {
          completedDeliveries.push({
            ...order,
            route_id: route.id,
            route_type: route.route_type,
            route_date: route.route_date,
            route_status: route.status
          })
        }
      })
    })

    return completedDeliveries
  },

  async getEarnings(session: any): Promise<EarningsData> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/driver/earnings`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getEarningsHistory(session: any, params?: { period?: string }): Promise<EarningsHistory[]> {
    const searchParams = new URLSearchParams()
    if (params?.period) searchParams.append('period', params.period)

    const url = `${API_BASE_URL}/api/v1/driver/earnings/history${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    const response = await authFetchWithSession(session, url)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  }
}

export interface AdminOrder extends Order {
  user_email: string
  user_name: string
  route_id?: number
  route_type?: string
  driver_name?: string
  driver_id?: number
  is_assigned: boolean
}

export interface RouteAssignmentRequest {
  driver_id: number
  order_ids: number[]
  route_date: string
  route_type: 'pickup' | 'delivery'
}

export interface BulkStatusUpdateRequest {
  order_ids: number[]
  status: string
  notes?: string
}

export interface BulkStatusUpdateResponse {
  message: string
  updated_count: number
  total_orders: number
}

export interface OptimizationSuggestionsRequest {
  order_ids: number[]
}

export interface OrderLocation {
  id: number
  pickup_date: string
  pickup_time_slot: string
  delivery_date: string
  delivery_time_slot: string
  pickup_address: string
  pickup_city: string
  pickup_zip: string
  delivery_address: string
  delivery_city: string
  delivery_zip: string
  customer_name: string
}

export interface OptimizationSuggestion {
  type: string
  message: string
  groups: { [key: string]: number[] }
}

export interface OptimizationSuggestionsResponse {
  orders: OrderLocation[]
  suggestions: OptimizationSuggestion[]
  total_orders: number
}

export interface OrderResolution {
  id: number
  order_id: number
  resolved_by: number
  resolution_type: 'reschedule' | 'partial_refund' | 'full_refund' | 'credit' | 'waive_fee'
  reschedule_date?: string
  refund_amount?: number
  credit_amount?: number
  notes: string
  created_at: string
}

export interface CreateOrderResolutionRequest {
  order_id: number
  resolution_type: 'reschedule' | 'partial_refund' | 'full_refund' | 'credit' | 'waive_fee'
  reschedule_date?: string
  refund_amount?: number
  credit_amount?: number
  notes: string
}

export interface DriverStats {
  driver_id: number
  driver_name: string
  total_deliveries: number
  today_deliveries: number
  avg_delivery_time_minutes: number
  rating: number
}

export interface RevenueAnalytics {
  date: string
  revenue: number
  order_count: number
  average_order_value: number
}

export const adminApi = {
  async getOrdersSummary(session: any): Promise<any> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/orders/summary`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getAllOrders(session: any, params?: { status?: string, date?: string, user_id?: string, limit?: number, offset?: number }): Promise<AdminOrder[]> {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.append('status', params.status)
    if (params?.date) searchParams.append('date', params.date)
    if (params?.user_id) searchParams.append('user_id', params.user_id)
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.offset) searchParams.append('offset', params.offset.toString())

    const url = `${API_BASE_URL}/api/v1/admin/orders${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    const response = await authFetchWithSession(session, url)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getUsers(session: any, params?: { role?: string, search?: string, limit?: number, offset?: number }): Promise<User[]> {
    const searchParams = new URLSearchParams()
    if (params?.role) searchParams.append('role', params.role)
    if (params?.search) searchParams.append('search', params.search)
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.offset) searchParams.append('offset', params.offset.toString())

    const url = `${API_BASE_URL}/api/v1/admin/users${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    const response = await authFetchWithSession(session, url)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getDriverStats(session: any): Promise<DriverStats[]> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/drivers/stats`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async assignDriverToRoute(session: any, request: RouteAssignmentRequest): Promise<{ message: string, route_id: number }> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/routes/assign`, {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async updateUserRole(session: any, userId: number, role: string): Promise<{ message: string }> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async createUser(session: any, userData: { first_name: string, last_name: string, email: string, phone?: string, role: string, status: string }): Promise<User> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/users`, {
      method: 'POST',
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async updateUser(session: any, userId: number, userData: { first_name: string, last_name: string, email: string, phone?: string, role: string, status: string }): Promise<User> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async deleteUser(session: any, userId: number): Promise<{ message: string }> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getRevenueAnalytics(session: any, period?: 'day' | 'week' | 'month'): Promise<RevenueAnalytics[]> {
    const searchParams = new URLSearchParams()
    if (period) searchParams.append('period', period)

    const url = `${API_BASE_URL}/api/v1/admin/analytics/revenue${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    const response = await authFetchWithSession(session, url)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async bulkUpdateOrderStatus(session: any, request: BulkStatusUpdateRequest): Promise<BulkStatusUpdateResponse> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/orders/bulk-status`, {
      method: 'PUT',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getOptimizationSuggestions(session: any, request: OptimizationSuggestionsRequest): Promise<OptimizationSuggestionsResponse> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/routes/optimization-suggestions`, {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async createOrderResolution(session: any, request: CreateOrderResolutionRequest): Promise<OrderResolution> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/orders/resolution`, {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  },

  async getOrderResolutions(session: any, orderId: number): Promise<OrderResolution[]> {
    const response = await authFetchWithSession(session, `${API_BASE_URL}/api/v1/admin/orders/${orderId}/resolutions`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response.json()
  }
}