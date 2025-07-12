import { useState } from 'react'

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    title: string
    description: string
    confirmText: string
    cancelText: string
    variant: "default" | "destructive"
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    onConfirm: () => {}
  })

  const showConfirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'default',
        onConfirm: () => {
          setDialogState(prev => ({ ...prev, isOpen: false }))
          resolve(true)
        }
      })
    })
  }

  const hideConfirm = () => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
  }

  return {
    confirmDialog: dialogState,
    showConfirm,
    hideConfirm
  }
}