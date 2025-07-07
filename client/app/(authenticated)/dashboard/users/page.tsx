'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Search, Filter, Edit, Trash2, Shield, UserPlus, ChevronDown, ChevronUp, X } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { adminApi } from '@/lib/api'
import { TumbleButton } from '@/components/ui/tumble-button'
import { TumbleIconButton } from '@/components/ui/tumble-icon-button'
import { TumbleInput } from '@/components/ui/tumble-input'
import { TumbleSelect } from '@/components/ui/tumble-select'
import {
  TumbleDialog,
  TumbleDialogContent,
  TumbleDialogDescription,
  TumbleDialogFooter,
  TumbleDialogHeader,
  TumbleDialogTitle,
  TumbleDialogBody,
} from '@/components/ui/tumble-dialog'
import { tumbleToast } from '@/components/ui/tumble-toast'

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
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'driver' | 'admin'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [highlightEmail, setHighlightEmail] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'customer' as User['role'],
    status: 'active' as User['status']
  })
  const [addForm, setAddForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'customer' as User['role'],
    status: 'active' as User['status']
  })

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

    // Handle URL parameters
    const filterParam = searchParams.get('filter')
    const highlightParam = searchParams.get('highlight')
    
    if (filterParam && ['customer', 'driver', 'admin'].includes(filterParam)) {
      setRoleFilter(filterParam as 'customer' | 'driver' | 'admin')
    }
    
    if (highlightParam) {
      setHighlightEmail(decodeURIComponent(highlightParam))
      setSearchTerm(decodeURIComponent(highlightParam))
    }

    loadUsers()
  }, [session, status, router, searchParams])

  const loadUsers = async () => {
    try {
      const data = await adminApi.getUsers(session)
      setUsers(data)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to load users'
      tumbleToast.error('Loading failed', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: number, newRole: User['role']) => {
    try {
      await adminApi.updateUserRole(session, userId, newRole)
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))
      tumbleToast.success('Role updated', `User role changed to ${newRole}`)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update user role'
      tumbleToast.error('Update failed', errorMessage)
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
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText)
      }
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ))
      tumbleToast.success('Status updated', `User status changed to ${newStatus}`)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update user status'
      tumbleToast.error('Update failed', errorMessage)
    }
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      status: user.status
    })
    setShowEditModal(true)
  }

  const openAddModal = () => {
    setAddForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: 'customer',
      status: 'active'
    })
    setShowAddModal(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setFormLoading(true)
    try {
      const updatedUser = await adminApi.updateUser(session, selectedUser.id, editForm)
      setUsers(users.map(user => user.id === selectedUser.id ? updatedUser : user))
      setShowEditModal(false)
      setSelectedUser(null)
      tumbleToast.success('User updated successfully', `${editForm.first_name} ${editForm.last_name} has been updated.`)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update user'
      tumbleToast.error('Update failed', errorMessage)
    } finally {
      setFormLoading(false)
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    
    try {
      const newUser = await adminApi.createUser(session, addForm)
      setUsers([...users, newUser])
      setShowAddModal(false)
      tumbleToast.success('User created successfully', `${addForm.first_name} ${addForm.last_name} has been added to the system.`)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to create user'
      tumbleToast.error('Create failed', errorMessage)
    } finally {
      setFormLoading(false)
    }
  }

  const deleteUser = async (userId: number) => {
    const user = users.find(u => u.id === userId)
    if (!user) return

    // Check if trying to delete current user
    const currentUser = session?.user as any
    if (currentUser?.id === userId) {
      tumbleToast.error('Cannot delete yourself', 'You cannot delete your own account while logged in.')
      return
    }

    if (!confirm(`Are you sure you want to delete ${user.first_name} ${user.last_name}? This action cannot be undone.`)) {
      return
    }

    try {
      await adminApi.deleteUser(session, userId)
      setUsers(users.filter(user => user.id !== userId))
      tumbleToast.success('User deleted successfully', `${user.first_name} ${user.last_name} has been removed from the system.`)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to delete user'
      tumbleToast.error('Delete failed', errorMessage)
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

  // Helper functions for filter summary
  const hasActiveFilters = searchTerm !== '' || roleFilter !== 'all' || statusFilter !== 'all'
  const getActiveFiltersCount = () => {
    let count = 0
    if (searchTerm !== '') count++
    if (roleFilter !== 'all') count++
    if (statusFilter !== 'all') count++
    return count
  }

  const getFilterSummary = () => {
    const parts = []
    if (searchTerm !== '') parts.push(`"${searchTerm}"`)
    if (roleFilter !== 'all') parts.push(`${roleFilter}s`)
    if (statusFilter !== 'all') parts.push(`${statusFilter}`)
    return parts.join(', ')
  }

  const clearAllFilters = () => {
    setSearchTerm('')
    setRoleFilter('all')
    setStatusFilter('all')
    setHighlightEmail('')
    
    // Clear URL parameters
    const url = new URL(window.location.href)
    url.search = ''
    router.replace(url.pathname)
  }

  if (loading || status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <PageHeader title="User Management" subtitle="Manage all system users, roles, and permissions" />
        {/* Collapsible Filters and Search */}
        <div className="bg-white rounded-2xl shadow-lg mb-6">
          {!isFiltersExpanded ? (
            /* Collapsed View */
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <TumbleButton
                  onClick={() => setIsFiltersExpanded(true)}
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span className="text-sm">Search & Filter</span>
                  <ChevronDown className="w-4 h-4" />
                </TumbleButton>

                {hasActiveFilters && (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-slate-600">
                      Filtered by: <span className="font-medium text-slate-900">{getFilterSummary()}</span>
                    </span>
                    <span className="text-xs bg-[#A7E7E1] text-slate-800 px-2 py-1 rounded-full">
                      {filteredUsers.length} of {users.length}
                    </span>
                    <TumbleIconButton
                      onClick={clearAllFilters}
                      variant="ghost"
                      size="sm"
                      tooltip="Clear all filters"
                    >
                      <X className="w-4 h-4" />
                    </TumbleIconButton>
                  </div>
                )}

                {!hasActiveFilters && (
                  <span className="text-sm text-slate-500">
                    Showing all {users.length} users
                  </span>
                )}
              </div>

              <TumbleButton 
                onClick={openAddModal}
                variant="default" 
                className="flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Add User</span>
              </TumbleButton>
            </div>
          ) : (
            /* Expanded View */
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Search & Filter Users
                </h3>
                <TumbleButton
                  onClick={() => setIsFiltersExpanded(false)}
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <span className="text-sm">Collapse</span>
                  <ChevronUp className="w-4 h-4" />
                </TumbleButton>
              </div>

              <div className="flex flex-col xl:flex-row gap-4">
                {/* Search */}
                <div className="flex flex-col min-w-0 flex-1">
                  <label className="text-sm font-medium text-slate-700 mb-2">Search</label>
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#A7E7E1] focus:border-[#A7E7E1] transition-colors"
                  />
                </div>

                {/* Filters Row */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                  {/* Role Filter */}
                  <div className="flex flex-col min-w-0">
                    <label className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                      <Filter className="w-4 h-4 mr-2 text-slate-400" />
                      Role
                    </label>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value as any)}
                      className="border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#A7E7E1] focus:border-[#A7E7E1] bg-white transition-colors min-w-[120px]"
                    >
                      <option value="all">All Roles</option>
                      <option value="customer">Customer</option>
                      <option value="driver">Driver</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex flex-col min-w-0">
                    <label className="text-sm font-medium text-slate-700 mb-2">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#A7E7E1] focus:border-[#A7E7E1] bg-white transition-colors min-w-[120px]"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>

                  {/* Add User Button */}
                  <div className="flex flex-col justify-end">
                    <TumbleButton 
                      onClick={openAddModal}
                      variant="default" 
                      className="flex items-center justify-center gap-2 h-12"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="hidden sm:inline">Add User</span>
                    </TumbleButton>
                  </div>
                </div>
              </div>

              {/* Results Summary and Actions */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-900">{filteredUsers.length}</span> of <span className="font-semibold text-slate-900">{users.length}</span> users
                  {highlightEmail && (
                    <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#A7E7E1] text-slate-800">
                      Highlighting: {highlightEmail}
                    </span>
                  )}
                </p>

                {hasActiveFilters && (
                  <TumbleButton
                    onClick={clearAllFilters}
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear All
                  </TumbleButton>
                )}
              </div>
            </div>
          )}
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
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden sm:table-cell">
                    Role
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden lg:table-cell">
                    Last Login
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden md:table-cell">
                    Orders
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredUsers.map((user) => {
                  const isHighlighted = highlightEmail && user.email === highlightEmail
                  return (
                  <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${isHighlighted ? 'bg-gradient-to-r from-[#A7E7E1]/20 to-[#8BE2B3]/20 ring-2 ring-[#A7E7E1]/50' : ''}`}>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          user.role === 'admin' ? 'bg-purple-100' :
                          user.role === 'driver' ? 'bg-blue-100' : 'bg-emerald-100'
                        }`}>
                          <span className={`font-semibold text-sm ${
                            user.role === 'admin' ? 'text-purple-600' :
                            user.role === 'driver' ? 'text-blue-600' : 'text-emerald-600'
                          }`}>
                            {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-slate-500 truncate">{user.email}</div>
                          <div className="flex flex-wrap gap-2 mt-1 sm:hidden">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                              {user.role}
                            </span>
                          </div>
                          {user.phone && (
                            <div className="text-xs text-slate-400 mt-1 sm:block hidden">{user.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value as User['role'])}
                        className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getRoleColor(user.role)}`}
                      >
                        <option value="customer">Customer</option>
                        <option value="driver">Driver</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.status}
                        onChange={(e) => updateUserStatus(user.id, e.target.value as User['status'])}
                        className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getStatusColor(user.status)}`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-900 hidden lg:table-cell">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 hidden md:table-cell">
                      {user.orders_count || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <TumbleButton
                          onClick={() => openEditModal(user)}
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </TumbleButton>
                        <TumbleButton
                          onClick={() => deleteUser(user.id)}
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-2 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Delete</span>
                        </TumbleButton>
                      </div>
                    </td>
                  </tr>
                  )
                })}
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

      {/* Add User Modal */}
      <TumbleDialog open={showAddModal} onOpenChange={setShowAddModal}>
        <TumbleDialogContent className="max-w-md">
          <TumbleDialogHeader>
            <TumbleDialogTitle>Add New User</TumbleDialogTitle>
            <TumbleDialogDescription>
              Create a new user account with the specified details.
            </TumbleDialogDescription>
          </TumbleDialogHeader>
          <TumbleDialogBody>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <TumbleInput
                  label="First Name"
                  value={addForm.first_name}
                  onChange={(e) => setAddForm(prev => ({ ...prev, first_name: e.target.value }))}
                  required
                />
                <TumbleInput
                  label="Last Name"
                  value={addForm.last_name}
                  onChange={(e) => setAddForm(prev => ({ ...prev, last_name: e.target.value }))}
                  required
                />
              </div>
              <TumbleInput
                type="email"
                label="Email"
                value={addForm.email}
                onChange={(e) => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                required
              />
              <TumbleInput
                type="tel"
                label="Phone (Optional)"
                value={addForm.phone}
                onChange={(e) => setAddForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1-555-0123"
              />
              <div className="grid grid-cols-2 gap-4">
                <TumbleSelect
                  label="Role"
                  value={addForm.role}
                  onChange={(e) => setAddForm(prev => ({ ...prev, role: e.target.value as User['role'] }))}
                  required
                >
                  <option value="customer">Customer</option>
                  <option value="driver">Driver</option>
                  <option value="admin">Admin</option>
                </TumbleSelect>
                <TumbleSelect
                  label="Status"
                  value={addForm.status}
                  onChange={(e) => setAddForm(prev => ({ ...prev, status: e.target.value as User['status'] }))}
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </TumbleSelect>
              </div>
            </form>
          </TumbleDialogBody>
          <TumbleDialogFooter className="flex gap-3">
            <TumbleButton
              type="button"
              variant="ghost"
              onClick={() => setShowAddModal(false)}
              disabled={formLoading}
            >
              Cancel
            </TumbleButton>
            <TumbleButton
              type="submit"
              onClick={handleAddSubmit}
              disabled={formLoading}
              className="flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {formLoading ? 'Creating...' : 'Create User'}
            </TumbleButton>
          </TumbleDialogFooter>
        </TumbleDialogContent>
      </TumbleDialog>

      {/* Edit User Modal */}
      <TumbleDialog open={showEditModal} onOpenChange={setShowEditModal}>
        <TumbleDialogContent className="max-w-md">
          <TumbleDialogHeader>
            <TumbleDialogTitle>Edit User</TumbleDialogTitle>
            <TumbleDialogDescription>
              Update user account details.
            </TumbleDialogDescription>
          </TumbleDialogHeader>
          <TumbleDialogBody>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <TumbleInput
                  label="First Name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                  required
                />
                <TumbleInput
                  label="Last Name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                  required
                />
              </div>
              <TumbleInput
                type="email"
                label="Email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                required
              />
              <TumbleInput
                type="tel"
                label="Phone (Optional)"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1-555-0123"
              />
              <div className="grid grid-cols-2 gap-4">
                <TumbleSelect
                  label="Role"
                  value={editForm.role}
                  onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value as User['role'] }))}
                  required
                >
                  <option value="customer">Customer</option>
                  <option value="driver">Driver</option>
                  <option value="admin">Admin</option>
                </TumbleSelect>
                <TumbleSelect
                  label="Status"
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as User['status'] }))}
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </TumbleSelect>
              </div>
            </form>
          </TumbleDialogBody>
          <TumbleDialogFooter className="flex gap-3">
            <TumbleButton
              type="button"
              variant="ghost"
              onClick={() => setShowEditModal(false)}
              disabled={formLoading}
            >
              Cancel
            </TumbleButton>
            <TumbleButton
              type="submit"
              onClick={handleEditSubmit}
              disabled={formLoading}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              {formLoading ? 'Updating...' : 'Update User'}
            </TumbleButton>
          </TumbleDialogFooter>
        </TumbleDialogContent>
      </TumbleDialog>
    </>
  )
}