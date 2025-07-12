import { useState } from 'react'

interface ErrorOptions {
  title: string
  message: string
  variant?: "error" | "warning"
}

export function useErrorDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: "error" | "warning"
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'error'
  })

  const showError = (options: ErrorOptions) => {
    setDialogState({
      isOpen: true,
      title: options.title,
      message: options.message,
      variant: options.variant || 'error'
    })
  }

  const hideError = () => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
  }

  return {
    errorDialog: dialogState,
    showError,
    hideError
  }
}