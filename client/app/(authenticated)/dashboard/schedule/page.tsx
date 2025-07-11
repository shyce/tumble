'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, Package, Plus, Minus, Crown, Loader2 } from 'lucide-react'
import { addressApi, serviceApi, orderApi, subscriptionApi, Address, Service, OrderItem, SubscriptionUsage, CostCalculation } from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import { TumbleButton } from '@/components/ui/tumble-button'


export default function SchedulePage() {
  const { data: session, status } = useSession()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subscriptionUsage, setSubscriptionUsage] = useState<SubscriptionUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()
  const hasLoadedData = useRef(false)

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
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])

  const timeSlots = [
    '8:00 AM - 12:00 PM',
    '12:00 PM - 4:00 PM', 
    '4:00 PM - 8:00 PM'
  ]

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    // Only load data once when we have a valid session
    if (!hasLoadedData.current && session) {
      hasLoadedData.current = true
      
      const loadData = async () => {
        try {
          // Load addresses, services, and subscription usage
          const [addressData, servicesData, usageData] = await Promise.all([
            addressApi.getAddresses(session),
            serviceApi.getServices(),
            subscriptionApi.getSubscriptionUsage(session)
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

          // Set default order item to standard bag service
          const standardBagService = servicesData.find(s => s.name === 'standard_bag')
          if (standardBagService) {
            // Standard totes are $45 for pay-as-you-go customers
            setOrderItems([{ service_id: standardBagService.id, quantity: 1, price: 45 }])
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
    }
  }, [status, router, session])

  const updateOrderItem = (index: number, updates: Partial<OrderItem>) => {
    setOrderItems(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ))
  }

  const addOrderItem = () => {
    const standardBagService = services.find(s => s.name === 'standard_bag')
    if (standardBagService) {
      // Standard totes are $45 for pay-as-you-go customers
      setOrderItems(prev => [...prev, { service_id: standardBagService.id, quantity: 1, price: 45 }])
    }
  }

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(prev => prev.filter((_, i) => i !== index))
    }
  }

  const calculateCost = (): CostCalculation => {
    // Calculate pickup service cost (free with subscription, $10 without)
    const pickupServiceCost = 10.0
    const pickupCovered = !!(subscriptionUsage && subscriptionUsage.pickups_remaining > 0)
    
    // Calculate bag costs - Standard Totes are $45 pay-as-you-go
    const bagSubtotal = orderItems.reduce((total, item) => {
      const service = services.find(s => s.id === item.service_id)
      // Standard totes are $45 for pay-as-you-go customers
      const price = service?.name === 'standard_bag' ? 45 : (service?.base_price || 0)
      return total + (price * item.quantity)
    }, 0)
    
    // Calculate subscription benefits for bags
    let bagSubscriptionDiscount = 0
    let coveredBags = 0
    let hasSubscriptionBenefits = pickupCovered
    
    if (subscriptionUsage && subscriptionUsage.bags_remaining > 0) {
      // Find standard bags in the order
      const standardBagService = services.find(s => s.name === 'standard_bag')
      if (standardBagService) {
        const standardBagItems = orderItems.filter(item => 
          services.find(s => s.id === item.service_id)?.name === 'standard_bag'
        )
        
        const totalBagsInOrder = standardBagItems.reduce((total, item) => total + item.quantity, 0)
        // Limit covered bags to what's actually remaining in subscription
        coveredBags = Math.min(totalBagsInOrder, subscriptionUsage.bags_remaining)
        
        if (coveredBags > 0) {
          // Subscribers get standard totes covered by their plan
          bagSubscriptionDiscount = 45 * coveredBags
          hasSubscriptionBenefits = true
        }
      }
    }
    
    const totalSubscriptionDiscount = (pickupCovered ? pickupServiceCost : 0) + bagSubscriptionDiscount
    const subtotalBeforeDiscount = pickupServiceCost + bagSubtotal
    const finalSubtotal = Math.max(0, subtotalBeforeDiscount - totalSubscriptionDiscount)
    const tax = finalSubtotal * 0.06 // 6% tax
    const total = finalSubtotal + tax + tip
    
    return {
      subtotal: subtotalBeforeDiscount,
      subscription_discount: totalSubscriptionDiscount,
      final_subtotal: finalSubtotal,
      tax,
      tip,
      total,
      covered_bags: coveredBags,
      has_subscription_benefits: !!hasSubscriptionBenefits
    }
  }
  
  const costCalculation = calculateCost()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    try {
      await orderApi.createOrder(session, {
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

  if (loading || status === 'loading') {
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
    <>
      <PageHeader title="Schedule Pickup" subtitle="Fresh laundry service with pickup and delivery at your convenience" />
        {/* Subscription Benefits Banner */}
        {subscriptionUsage && (
          <div className={`mb-8 border rounded-lg p-4 ${
            subscriptionUsage.pickups_remaining > 0 || subscriptionUsage.bags_remaining > 0
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Crown className={`w-5 h-5 mr-3 ${
                  subscriptionUsage.pickups_remaining > 0 || subscriptionUsage.bags_remaining > 0
                    ? 'text-emerald-600'
                    : 'text-orange-600'
                }`} />
                <div>
                  <p className={`font-semibold ${
                    subscriptionUsage.pickups_remaining > 0 || subscriptionUsage.bags_remaining > 0
                      ? 'text-emerald-800'
                      : 'text-orange-800'
                  }`}>
                    Subscription Active
                  </p>
                  <p className={`text-xs ${
                    subscriptionUsage.pickups_remaining > 0 || subscriptionUsage.bags_remaining > 0
                      ? 'text-emerald-600'
                      : 'text-orange-600'
                  }`}>
                    {subscriptionUsage.pickups_remaining > 0 || subscriptionUsage.bags_remaining > 0
                      ? 'Benefits available for this period'
                      : 'No benefits remaining this period'
                    }
                  </p>
                </div>
              </div>
              <div className="flex space-x-6 text-center">
                <div>
                  <div className={`text-lg font-bold ${
                    subscriptionUsage.pickups_remaining > 0 ? 'text-emerald-600' : 'text-slate-500'
                  }`}>
                    {subscriptionUsage.pickups_remaining}
                  </div>
                  <div className="text-xs text-slate-600">Pickups Left</div>
                </div>
                <div>
                  <div className={`text-lg font-bold ${
                    subscriptionUsage.bags_remaining > 0 ? 'text-teal-600' : 'text-slate-500'
                  }`}>
                    {subscriptionUsage.bags_remaining}
                  </div>
                  <div className="text-xs text-slate-600">Bags Covered</div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                      // Standard totes are $45 for pay-as-you-go customers
                      const price = service?.name === 'standard_bag' ? 45 : (service?.base_price || 0)
                      updateOrderItem(index, { 
                        service_id: serviceId, 
                        price: price 
                      })
                    }}
                    className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 bg-white"
                  >
                    {services.filter(service => service.name !== 'pickup_service').map(service => {
                      // Standard totes are $45 for pay-as-you-go customers
                      const displayPrice = service.name === 'standard_bag' ? 45 : service.base_price
                      return (
                        <option key={service.id} value={service.id}>
                          {service.description} - ${displayPrice}
                        </option>
                      )
                    })}
                  </select>

                  <div className="flex items-center space-x-2">
                    <TumbleButton
                      type="button"
                      onClick={() => updateOrderItem(index, { quantity: Math.max(1, item.quantity - 1) })}
                      variant="ghost"
                      size="icon"
                    >
                      <Minus className="w-4 h-4" />
                    </TumbleButton>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <TumbleButton
                      type="button"
                      onClick={() => updateOrderItem(index, { quantity: item.quantity + 1 })}
                      variant="ghost"
                      size="icon"
                    >
                      <Plus className="w-4 h-4" />
                    </TumbleButton>
                  </div>

                  <span className="font-semibold text-slate-900 w-20 text-right">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>

                  {orderItems.length > 1 && (
                    <TumbleButton
                      type="button"
                      onClick={() => removeOrderItem(index)}
                      variant="destructive"
                      size="icon"
                    >
                      ✕
                    </TumbleButton>
                  )}
                </div>
              ))}

              <TumbleButton
                type="button"
                onClick={addOrderItem}
                variant="outline"
                className="w-full p-3 border-2 border-dashed"
              >
                + Add Another Service
              </TumbleButton>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="space-y-2">
                  {/* Show pickup service cost */}
                  <div className="flex justify-between text-slate-700">
                    <span>Pickup Service:</span>
                    <span>
                      {subscriptionUsage && subscriptionUsage.pickups_remaining > 0 ? (
                        <span className="text-emerald-600">Covered</span>
                      ) : (
                        <span>$10.00</span>
                      )}
                    </span>
                  </div>
                  
                  {/* Show bag services */}
                  <div className="flex justify-between text-slate-700">
                    <span>Bag Services:</span>
                    <span>${(costCalculation.subtotal - 10).toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-slate-700 border-t border-slate-300 pt-2">
                    <span>Subtotal:</span>
                    <span>${costCalculation.subtotal.toFixed(2)}</span>
                  </div>
                  
                  {costCalculation.has_subscription_benefits && (
                    <>
                      <div className="flex justify-between text-emerald-600">
                        <span>
                          Subscription Benefits 
                          {costCalculation.covered_bags > 0 && ` (${costCalculation.covered_bags} bags covered)`}:
                        </span>
                        <span>-${costCalculation.subscription_discount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>After Discount:</span>
                        <span>${costCalculation.final_subtotal.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between text-slate-700">
                    <span>Tax (6%):</span>
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
                    <div className="text-xs text-slate-500 mt-3 text-center">
                      <p>📅 Billing period: {new Date(subscriptionUsage.current_period_start).toLocaleDateString()} - {new Date(subscriptionUsage.current_period_end).toLocaleDateString()}</p>
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
                        <TumbleButton
                          key={percentage}
                          type="button"
                          onClick={() => {
                            setTip(tipAmount)
                            setCustomTip('')
                          }}
                          variant={Math.abs(tip - tipAmount) < 0.01 ? "default" : "outline"}
                          className="p-3 font-medium flex flex-col"
                        >
                          <div className="text-sm">{percentage}%</div>
                          <div className="text-xs opacity-75">${tipAmount.toFixed(2)}</div>
                        </TumbleButton>
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
                    <TumbleButton
                      type="button"
                      onClick={() => {
                        setTip(0)
                        setCustomTip('')
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      No Tip
                    </TumbleButton>
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
                    <TumbleButton
                      type="button"
                      onClick={() => {
                        setTip(0)
                        setCustomTip('')
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      No Tip
                    </TumbleButton>
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
            <TumbleButton
              type="submit"
              disabled={submitting || addresses.length === 0}
              variant="default"
              size="lg"
              className="px-8 py-4 text-lg"
            >
              <div className="flex items-center justify-center">
                {submitting && (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                )}
                {submitting ? 'Scheduling...' : 'Schedule Pickup'}
              </div>
            </TumbleButton>
          </div>
        </form>
    </>
  )
}