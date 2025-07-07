'use client'

import * as React from "react"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  TumbleDialog,
  TumbleDialogContent,
  TumbleDialogDescription,
  TumbleDialogHeader,
  TumbleDialogTitle,
  TumbleDialogTrigger,
  TumbleDialogBody,
  TumbleDialogFooter,
} from "@/components/ui/tumble-dialog"
import { TumbleInput } from "@/components/ui/tumble-input"
import { TumbleButton } from "@/components/ui/tumble-button"
import { TumbleIconButton } from "@/components/ui/tumble-icon-button"
import { authApi } from "@/lib/api"
import { Lock, Eye, EyeOff } from "lucide-react"

interface ChangePasswordModalProps {
  children: React.ReactNode
}

export function ChangePasswordModal({ children }: ChangePasswordModalProps) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validatePasswords = () => {
    const newErrors: Record<string, string> = {}

    if (!passwords.currentPassword) {
      newErrors.currentPassword = 'Current password is required'
    }

    if (!passwords.newPassword) {
      newErrors.newPassword = 'New password is required'
    } else if (passwords.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters'
    }

    if (!passwords.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password'
    } else if (passwords.newPassword !== passwords.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (passwords.currentPassword === passwords.newPassword) {
      newErrors.newPassword = 'New password must be different from current password'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validatePasswords()) return

    setLoading(true)
    
    try {
      await authApi.changePassword(session, passwords.currentPassword, passwords.newPassword)

      toast.success('Password changed successfully!', {
        description: 'Your password has been updated.'
      })
      
      // Reset form and close modal
      setPasswords({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setErrors({})
      setOpen(false)
    } catch (error) {
      console.error('Password change error:', error)
      toast.error('Failed to change password', {
        description: error instanceof Error ? error.message : 'Please try again.'
      })
    } finally {
      setLoading(false)
    }
  }

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  return (
    <TumbleDialog open={open} onOpenChange={setOpen}>
      <TumbleDialogTrigger asChild>
        {children}
      </TumbleDialogTrigger>
      <TumbleDialogContent className="sm:max-w-md">
        <TumbleDialogHeader>
          <TumbleDialogTitle className="flex items-center">
            <Lock className="w-5 h-5 mr-2 text-[#A7E7E1]" />
            Change Password
          </TumbleDialogTitle>
          <TumbleDialogDescription>
            Update your account password. Make sure to use a strong, unique password.
          </TumbleDialogDescription>
        </TumbleDialogHeader>
        <TumbleDialogBody>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <TumbleInput
              type={showPasswords.current ? "text" : "password"}
              label="Current Password"
              placeholder="Enter your current password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords(prev => ({ ...prev, currentPassword: e.target.value }))}
              error={errors.currentPassword}
              required
            />
            <TumbleIconButton
              type="button"
              onClick={() => togglePasswordVisibility('current')}
              variant="ghost"
              size="sm"
              className="absolute right-2 top-8"
            >
              {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </TumbleIconButton>
          </div>

          <div className="relative">
            <TumbleInput
              type={showPasswords.new ? "text" : "password"}
              label="New Password"
              placeholder="Enter your new password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords(prev => ({ ...prev, newPassword: e.target.value }))}
              error={errors.newPassword}
              required
            />
            <TumbleIconButton
              type="button"
              onClick={() => togglePasswordVisibility('new')}
              variant="ghost"
              size="sm"
              className="absolute right-2 top-8"
            >
              {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </TumbleIconButton>
          </div>

          <div className="relative">
            <TumbleInput
              type={showPasswords.confirm ? "text" : "password"}
              label="Confirm New Password"
              placeholder="Confirm your new password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords(prev => ({ ...prev, confirmPassword: e.target.value }))}
              error={errors.confirmPassword}
              required
            />
            <TumbleIconButton
              type="button"
              onClick={() => togglePasswordVisibility('confirm')}
              variant="ghost"
              size="sm"
              className="absolute right-2 top-8"
            >
              {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </TumbleIconButton>
          </div>

        </form>
        </TumbleDialogBody>
        <TumbleDialogFooter>
          <TumbleButton
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </TumbleButton>
          <TumbleButton
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </TumbleButton>
        </TumbleDialogFooter>
      </TumbleDialogContent>
    </TumbleDialog>
  )
}