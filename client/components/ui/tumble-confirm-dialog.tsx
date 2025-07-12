"use client"

import { AlertTriangle, Trash2 } from "lucide-react"
import {
  TumbleDialog,
  TumbleDialogContent,
  TumbleDialogDescription,
  TumbleDialogFooter,
  TumbleDialogHeader,
  TumbleDialogTitle,
} from "./tumble-dialog"
import { TumbleButton } from "./tumble-button"

interface TumbleConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  loading?: boolean
}

export function TumbleConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  loading = false,
}: TumbleConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    if (!loading) {
      onClose()
    }
  }

  return (
    <TumbleDialog open={isOpen} onOpenChange={onClose}>
      <TumbleDialogContent className="sm:max-w-md">
        <TumbleDialogHeader>
          <div className="flex items-center gap-3">
            {variant === "destructive" ? (
              <div className="flex-shrink-0 w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
            ) : (
              <div className="flex-shrink-0 w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
            )}
            <TumbleDialogTitle className="text-left">{title}</TumbleDialogTitle>
          </div>
        </TumbleDialogHeader>
        
        <div className="py-4">
          <TumbleDialogDescription className="text-base leading-relaxed">
            {description}
          </TumbleDialogDescription>
        </div>

        <TumbleDialogFooter>
          <TumbleButton
            onClick={onClose}
            variant="secondary"
            disabled={loading}
          >
            {cancelText}
          </TumbleButton>
          <TumbleButton
            onClick={handleConfirm}
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={loading}
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            )}
            {confirmText}
          </TumbleButton>
        </TumbleDialogFooter>
      </TumbleDialogContent>
    </TumbleDialog>
  )
}