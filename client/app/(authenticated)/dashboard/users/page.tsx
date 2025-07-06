'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Search, Filter, Edit, Trash2, Shield, UserPlus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: 'customer' | 'driver' | 'admin'
  phone?: string
  created_at: string
  last_login?: string
  status: 'active' | 'inactive' | 'suspended'
  orders_count?: number
  subscription_status?: 'active' | 'inactive' | 'cancelled'
}

export default function UsersManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'driver' | 'admin'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    const user = session.user as any
    if (user.role !== 'admin') {
      router.push('/dashboard')
      return
    }

    loadUsers()
  }, [session, status, router])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/v1/admin/users', {
        headers: {
          'Authorization': `Bearer ${(session as any)?.accessToken}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error loading users:', error)
      // Mock data for demonstration
      setUsers([
        {
          id: 1,
          email: 'john.doe@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role: 'customer',
          phone: '+1-555-0123',
          created_at: '2023-12-15T10:30:00Z',
          last_login: '2024-01-15T08:45:00Z',
          status: 'active',
          orders_count: 23,
          subscription_status: 'active'
        },
        {
          id: 2,
          email: 'sarah.driver@example.com',
          first_name: 'Sarah',
          last_name: 'Johnson',
          role: 'driver',
          phone: '+1-555-0456',
          created_at: '2023-11-20T14:15:00Z',
          last_login: '2024-01-15T07:30:00Z',
          status: 'active'
        },
        {
          id: 3,
          email: 'admin@tumble.com',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin',
          phone: '+1-555-0789',
          created_at: '2023-10-01T09:00:00Z',
          last_login: '2024-01-15T09:15:00Z',
          status: 'active'
        },
        {
          id: 4,
          email: 'mike.chen@example.com',
          first_name: 'Mike',
          last_name: 'Chen',
          role: 'customer',
          phone: '+1-555-0321',
          created_at: '2024-01-10T16:20:00Z',
          last_login: '2024-01-14T19:00:00Z',
          status: 'active',
          orders_count: 5,
          subscription_status: 'active'
        },
        {
          id: 5,
          email: 'inactive.user@example.com',
          first_name: 'Inactive',
          last_name: 'User',
          role: 'customer',
          created_at: '2023-09-15T11:00:00Z',
          status: 'inactive',
          orders_count: 0,
          subscription_status: 'cancelled'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: number, newRole: User['role']) => {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({ role: newRole }),
      })
      
      if (response.ok) {
        setUsers(users.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ))
      }
    } catch (error) {
      console.error('Error updating user role:', error)
      // Update locally for demo
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))
    }
  }

  const updateUserStatus = async (userId: number, newStatus: User['status']) => {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })
      
      if (response.ok) {
        setUsers(users.map(user => 
          user.id === userId ? { ...user, status: newStatus } : user
        ))
      }
    } catch (error) {
      console.error('Error updating user status:', error)
      // Update locally for demo
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ))
    }
  }

  const deleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(session as any)?.accessToken}`,
        },
      })
      
      if (response.ok) {
        setUsers(users.filter(user => user.id !== userId))
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      // Remove locally for demo
      setUsers(users.filter(user => user.id !== userId))
    }
  }

  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800'
      case 'driver': return 'bg-blue-100 text-blue-800'
      case 'customer': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'suspended': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    
    return matchesSearch && matchesRole && matchesStatus
  })

  if (loading || status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <PageHeader title="User Management" subtitle="Manage all system users, roles, and permissions" />
      {/* Add User Button */}
      <div className="mb-6 flex justify-end">
        <button className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Add User</span>
        </button>
      </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="text-slate-400 w-5 h-5" />
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Role:</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Roles</option>
                  <option value="customer">Customer</option>
                  <option value="driver">Driver</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-slate-900">{users.length}</p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Customers</p>
                <p className="text-2xl font-bold text-slate-900">
                  {users.filter(u => u.role === 'customer').length}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Drivers</p>
                <p className="text-2xl font-bold text-slate-900">
                  {users.filter(u => u.role === 'driver').length}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Active Users</p>
                <p className="text-2xl font-bold text-slate-900">
                  {users.filter(u => u.status === 'active').length}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                          <span className="text-purple-600 font-medium">
                            {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                          {user.phone && (
                            <div className="text-xs text-slate-400">{user.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value as User['role'])}
                        className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${getRoleColor(user.role)}`}
                      >
                        <option value="customer">Customer</option>
                        <option value="driver">Driver</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.status}
                        onChange={(e) => updateUserStatus(user.id, e.target.value as User['status'])}
                        className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${getStatusColor(user.status)}`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {user.orders_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user)
                            setShowEditModal(true)
                          }}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      {filteredUsers.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'No users match the selected filters.'}
          </p>
        </div>
      )}
    </>
  )
}