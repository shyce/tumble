'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface RouteOrder {
  id: number;
  order_id: number;
  sequence_number: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  customer_name: string;
  customer_phone: string;
  address: string;
  special_instructions?: string;
  pickup_time_slot?: string;
  delivery_time_slot?: string;
}

interface DriverRoute {
  id: number;
  driver_id: number;
  route_date: string;
  route_type: 'pickup' | 'delivery';
  status: string;
  orders: RouteOrder[];
  created_at: string;
  updated_at: string;
}

export default function DriverDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    fetchRoutes();
  }, [session, status, selectedDate]);

  const fetchRoutes = async () => {
    try {
      const response = await fetch(`/api/v1/driver/routes?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${(session as any)?.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRoutes(data);
      }
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const startRoute = async (routeId: number) => {
    setUpdating(routeId);
    try {
      const response = await fetch(`/api/v1/driver/routes/start?id=${routeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${(session as any)?.accessToken}`
        }
      });

      if (response.ok) {
        fetchRoutes();
      }
    } catch (error) {
      console.error('Failed to start route:', error);
    } finally {
      setUpdating(null);
    }
  };

  const updateOrderStatus = async (routeOrderId: number, status: string) => {
    setUpdating(routeOrderId);
    try {
      const response = await fetch(`/api/v1/driver/route-orders/status?id=${routeOrderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any)?.accessToken}`
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        fetchRoutes();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRouteTypeIcon = (type: string) => {
    return type === 'pickup' ? '📦' : '🚚';
  };

  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Driver Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage your routes and deliveries</p>
        </div>

        {/* Date Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Routes */}
        {routes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">No routes assigned for {selectedDate}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {routes.map((route) => (
              <div key={route.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl">{getRouteTypeIcon(route.route_type)}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {route.route_type === 'pickup' ? 'Pickup' : 'Delivery'} Route
                      </h3>
                      <p className="text-sm text-gray-500">
                        {route.orders.length} stops • {new Date(route.route_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(route.status)}`}>
                      {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                    </span>
                    {route.status === 'planned' && (
                      <button
                        onClick={() => startRoute(route.id)}
                        disabled={updating === route.id}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {updating === route.id ? 'Starting...' : 'Start Route'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Route Orders */}
                <div className="space-y-4">
                  {route.orders.map((order, index) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                              {order.sequence_number}
                            </span>
                            <div>
                              <h4 className="font-medium text-gray-900">{order.customer_name}</h4>
                              <p className="text-sm text-gray-500">{order.customer_phone}</p>
                            </div>
                          </div>
                          
                          <div className="ml-11">
                            <p className="text-sm text-gray-700 mb-2">{order.address}</p>
                            
                            {order.special_instructions && (
                              <p className="text-sm text-gray-600 italic mb-2">
                                Note: {order.special_instructions}
                              </p>
                            )}
                            
                            {(order.pickup_time_slot || order.delivery_time_slot) && (
                              <p className="text-sm text-gray-600">
                                Time: {order.pickup_time_slot || order.delivery_time_slot}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end space-y-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                            {order.status.replace('_', ' ').charAt(0).toUpperCase() + order.status.replace('_', ' ').slice(1)}
                          </span>
                          
                          {order.status === 'pending' && route.status === 'started' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'in_progress')}
                              disabled={updating === order.id}
                              className="text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 disabled:opacity-50"
                            >
                              {updating === order.id ? 'Updating...' : 'Start'}
                            </button>
                          )}
                          
                          {order.status === 'in_progress' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => updateOrderStatus(order.id, 'completed')}
                                disabled={updating === order.id}
                                className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {updating === order.id ? 'Updating...' : 'Complete'}
                              </button>
                              <button
                                onClick={() => updateOrderStatus(order.id, 'failed')}
                                disabled={updating === order.id}
                                className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Failed
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}