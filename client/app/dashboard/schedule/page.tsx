'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, Package, ArrowLeft, Sparkles, Plus, Minus } from 'lucide-react'
import { addressApi, serviceApi, orderApi, subscriptionApi, Address, Service, OrderItem, SubscriptionUsage, CostCalculation } from '@/lib/api'


export default function SchedulePage() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subscriptionUsage, setSubscriptionUsage] = useState<SubscriptionUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  // Form state
  const [pickupAddressId, setPickupAddressId] = useState<number | null>(null)
  const [deliveryAddressId, setDeliveryAddressId] = useState<number | null>(null)
  const [pickupDate, setPickupDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [pickupTimeSlot, setPickupTimeSlot] = useState('')
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [tip, setTip] = useState(0)
  const [customTip, setCustomTip] = useState('')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { service_id: 1, quantity: 1, price: 45.00 } // Default to 1 standard bag
  ])

  const timeSlots = [
    '8:00 AM - 12:00 PM',
    '12:00 PM - 4:00 PM', 
    '4:00 PM - 8:00 PM'
  ]

  useEffect(() => {
    const loadData = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/auth/signin')
        return
      }

      try {
        // Load addresses, services, and subscription usage
        const [addressData, servicesData, usageData] = await Promise.all([
          addressApi.getAddresses(),
          serviceApi.getServices(),
          subscriptionApi.getSubscriptionUsage()
        ])
          
        setAddresses(addressData)
        setServices(servicesData)
        setSubscriptionUsage(usageData)
        
        // Set default addresses if available
        const defaultAddress = addressData.find((addr: Address) => addr.is_default)
        if (defaultAddress) {
          setPickupAddressId(defaultAddress.id)
          setDeliveryAddressId(defaultAddress.id)
        }

        // Set default dates (tomorrow for pickup, day after for delivery)
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dayAfter = new Date()
        dayAfter.setDate(dayAfter.getDate() + 2)
        
        setPickupDate(tomorrow.toISOString().split('T')[0])
        setDeliveryDate(dayAfter.toISOString().split('T')[0])

      } catch {
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const updateOrderItem = (index: number, updates: Partial<OrderItem>) => {
    setOrderItems(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ))
  }

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, { service_id: 1, quantity: 1, price: 45.00 }])
  }

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(prev => prev.filter((_, i) => i !== index))
    }
  }

  const calculateCost = (): CostCalculation => {
    const subtotal = orderItems.reduce((total, item) => total + (item.price * item.quantity), 0)
    
    // Calculate subscription benefits
    let subscriptionDiscount = 0
    let coveredBags = 0
    let hasSubscriptionBenefits = false
    
    if (subscriptionUsage && subscriptionUsage.pickups_remaining > 0) {
      // Find standard bags in the order
      const standardBagService = services.find(s => s.name === 'standard_bag')
      if (standardBagService) {
        const standardBagItems = orderItems.filter(item => 
          services.find(s => s.id === item.service_id)?.name === 'standard_bag'
        )
        
        coveredBags = standardBagItems.reduce((total, item) => total + item.quantity, 0)
        if (coveredBags > 0) {
          subscriptionDiscount = standardBagService.base_price * coveredBags
          hasSubscriptionBenefits = true
        }
      }
    }
    
    const finalSubtotal = Math.max(0, subtotal - subscriptionDiscount)
    const tax = finalSubtotal * 0.08 // 8% tax
    const total = finalSubtotal + tax + tip
    
    return {
      subtotal,
      subscription_discount: subscriptionDiscount,
      final_subtotal: finalSubtotal,
      tax,
      tip,
      total,
      covered_bags: coveredBags,
      has_subscription_benefits: hasSubscriptionBenefits
    }
  }
  
  const costCalculation = calculateCost()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/auth/signin')
      return
    }

    try {
      await orderApi.createOrder({
        pickup_address_id: pickupAddressId!,
        delivery_address_id: deliveryAddressId!,
        pickup_date: pickupDate,
        delivery_date: deliveryDate,
        pickup_time_slot: pickupTimeSlot,
        delivery_time_slot: deliveryTimeSlot,
        special_instructions: specialInstructions || undefined,
        items: orderItems
      })

      setSuccess('Pickup scheduled successfully!')
      setTimeout(() => {
        router.push('/dashboard/orders')
      }, 2000)
    } catch {
      setError('Failed to schedule pickup')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading schedule form...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center space-x-3">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg">
                    <Sparkles className="text-white w-5 h-5" />
                  </div>
                  <span className="text-slate-800 font-bold text-xl tracking-tight">Tumble</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Schedule Pickup</h1>
          <p className="text-lg text-slate-600">
            Choose your pickup and delivery details for your laundry service
          </p>
          
          {/* Subscription Benefits Banner */}
          {subscriptionUsage && subscriptionUsage.pickups_remaining > 0 && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 max-w-2xl mx-auto">
              <div className="flex items-center justify-center text-emerald-700">
                <span className="text-2xl mr-2">🎉</span>
                <div className="text-left">
                  <p className="font-semibold">Great! You have {subscriptionUsage.pickups_remaining} pickup{subscriptionUsage.pickups_remaining !== 1 ? 's' : ''} remaining</p>
                  <p className="text-sm">Standard bags will be covered by your subscription</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
            <p className="text-emerald-700 text-center">{success}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Addresses Section */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center mb-6">
              <MapPin className="w-6 h-6 text-teal-600 mr-3" />
              <h2 className="text-2xl font-bold text-slate-900">Pickup & Delivery Addresses</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Pickup Address
                </label>
                <select
                  value={pickupAddressId || ''}
                  onChange={(e) => setPickupAddressId(Number(e.target.value))}
                  required
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                >
                  <option value="">Select pickup address</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.street_address}, {addr.city}, {addr.state} {addr.zip_code}
                      {addr.is_default ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Delivery Address
                </label>
                <select
                  value={deliveryAddressId || ''}
                  onChange={(e) => setDeliveryAddressId(Number(e.target.value))}
                  required
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                >
                  <option value="">Select delivery address</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.street_address}, {addr.city}, {addr.state} {addr.zip_code}
                      {addr.is_default ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {addresses.length === 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-700 text-sm">
                  You need to add an address before scheduling a pickup.{' '}
                  <Link href="/dashboard/settings" className="text-teal-600 hover:text-teal-700 underline">
                    Add an address in settings
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Schedule Section */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center mb-6">
              <Calendar className="w-6 h-6 text-teal-600 mr-3" />
              <h2 className="text-2xl font-bold text-slate-900">Pickup & Delivery Schedule</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Pickup Date
                </label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Pickup Time
                </label>
                <select
                  value={pickupTimeSlot}
                  onChange={(e) => setPickupTimeSlot(e.target.value)}
                  required
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                >
                  <option value="">Select time slot</option>
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={pickupDate || new Date().toISOString().split('T')[0]}
                  required
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Delivery Time
                </label>
                <select
                  value={deliveryTimeSlot}
                  onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                  required
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                >
                  <option value="">Select time slot</option>
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Services Section */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center mb-6">
              <Package className="w-6 h-6 text-teal-600 mr-3" />
              <h2 className="text-2xl font-bold text-slate-900">Services</h2>
            </div>

            <div className="space-y-4">
              {orderItems.map((item, index) => (
                <div key={index} className="flex items-center space-x-4 p-4 border border-slate-200 rounded-lg">
                  <select
                    value={item.service_id}
                    onChange={(e) => {
                      const serviceId = Number(e.target.value)
                      const service = services.find(s => s.id === serviceId)
                      updateOrderItem(index, { 
                        service_id: serviceId, 
                        price: service?.base_price || 0 
                      })
                    }}
                    className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                  >
                    {services.map(service => (
                      <option key={service.id} value={service.id}>
                        {service.description} - ${service.base_price}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => updateOrderItem(index, { quantity: Math.max(1, item.quantity - 1) })}
                      className="p-1 text-slate-500 hover:text-slate-700"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateOrderItem(index, { quantity: item.quantity + 1 })}
                      className="p-1 text-slate-500 hover:text-slate-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <span className="font-semibold text-slate-900 w-20 text-right">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>

                  {orderItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOrderItem(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addOrderItem}
                className="w-full p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-teal-500 hover:text-teal-600 transition-colors"
              >
                + Add Another Service
              </button>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal:</span>
                    <span>${costCalculation.subtotal.toFixed(2)}</span>
                  </div>
                  
                  {costCalculation.has_subscription_benefits && (
                    <>
                      <div className="flex justify-between text-emerald-600">
                        <span>Subscription Discount ({costCalculation.covered_bags} bags covered):</span>
                        <span>-${costCalculation.subscription_discount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>After Discount:</span>
                        <span>${costCalculation.final_subtotal.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between text-slate-700">
                    <span>Tax (8%):</span>
                    <span>${costCalculation.tax.toFixed(2)}</span>
                  </div>
                  
                  {tip > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Tip:</span>
                      <span>${tip.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="border-t border-slate-300 pt-2">
                    <div className="flex justify-between text-xl font-bold text-slate-900">
                      <span>Total:</span>
                      <span>${costCalculation.total.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {subscriptionUsage && (
                    <div className="text-sm text-slate-600 mt-3">
                      <p>📦 Pickups remaining this period: {subscriptionUsage.pickups_remaining} of {subscriptionUsage.pickups_allowed}</p>
                      <p>📅 Period: {new Date(subscriptionUsage.current_period_start).toLocaleDateString()} - {new Date(subscriptionUsage.current_period_end).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tip Section */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Add Tip (Optional)</h2>
            <p className="text-slate-600 mb-4">Show your appreciation for our drivers and staff</p>
            
            <div className="space-y-4">
              {/* Show percentage buttons only if there's a charge after subscription discount */}
              {costCalculation.final_subtotal > 0 ? (
                <>
                  {/* Preset Tip Buttons */}
                  <div className="grid grid-cols-4 gap-3">
                    {[15, 18, 20, 25].map((percentage) => {
                      const tipAmount = (costCalculation.final_subtotal * percentage) / 100
                      return (
                        <button
                          key={percentage}
                          type="button"
                          onClick={() => {
                            setTip(tipAmount)
                            setCustomTip('')
                          }}
                          className={`p-3 rounded-lg border-2 font-medium transition-all ${
                            Math.abs(tip - tipAmount) < 0.01
                              ? 'border-teal-500 bg-teal-50 text-teal-700'
                              : 'border-slate-200 hover:border-teal-300 text-slate-700'
                          }`}
                        >
                          <div className="text-sm">{percentage}%</div>
                          <div className="text-xs text-slate-500">${tipAmount.toFixed(2)}</div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom Tip Input */}
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-semibold text-slate-800">Custom Amount:</label>
                    <div className="flex items-center">
                      <span className="text-slate-700 mr-1">$</span>
                      <input
                        type="number"
                        value={customTip}
                        onChange={(e) => {
                          setCustomTip(e.target.value)
                          setTip(parseFloat(e.target.value) || 0)
                        }}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-24 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTip(0)
                        setCustomTip('')
                      }}
                      className="px-3 py-1 text-sm text-slate-500 hover:text-slate-700"
                    >
                      No Tip
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Custom Tip Only for Covered Services */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                    <p className="text-emerald-700 text-sm">
                      🎉 Your service is fully covered by your subscription! You can still add a tip to show appreciation for our team.
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-semibold text-slate-800">Tip Amount:</label>
                    <div className="flex items-center">
                      <span className="text-slate-700 mr-1">$</span>
                      <input
                        type="number"
                        value={customTip}
                        onChange={(e) => {
                          setCustomTip(e.target.value)
                          setTip(parseFloat(e.target.value) || 0)
                        }}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTip(0)
                        setCustomTip('')
                      }}
                      className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
                    >
                      No Tip
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Special Instructions */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Special Instructions</h2>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any special instructions for pickup or delivery..."
              rows={4}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white placeholder-slate-500"
            />
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              type="submit"
              disabled={submitting || addresses.length === 0}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-teal-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Scheduling...' : 'Schedule Pickup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}