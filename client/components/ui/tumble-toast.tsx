"use client"

import { toast, ToasterProps } from "sonner"
import { Toaster as Sonner } from "sonner"
import { CheckCircle, AlertCircle, XCircle, Info, X } from "lucide-react"

// Tumble-branded toaster
const TumbleToaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-right"
      expand={true}
      richColors={false}
      closeButton={false}
      toastOptions={{
        className: "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:border",
        descriptionClassName: "group-[.toast]:text-slate-600",
      }}
      {...props}
    />
  )
}

// Custom toast functions with Tumble branding
const tumbleToast = {
  success: (message: string, description?: string) => {
    return toast.custom((t) => (
      <div className="bg-white border border-emerald-200 rounded-xl shadow-lg p-4 max-w-md w-full">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {message}
            </div>
            {description && (
              <div className="text-sm text-slate-600 mt-1">
                {description}
              </div>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    ))
  },

  error: (message: string, description?: string) => {
    return toast.custom((t) => (
      <div className="bg-white border border-red-200 rounded-xl shadow-lg p-4 max-w-md w-full">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {message}
            </div>
            {description && (
              <div className="text-sm text-slate-600 mt-1">
                {description}
              </div>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    ))
  },

  warning: (message: string, description?: string) => {
    return toast.custom((t) => (
      <div className="bg-white border border-amber-200 rounded-xl shadow-lg p-4 max-w-md w-full">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {message}
            </div>
            {description && (
              <div className="text-sm text-slate-600 mt-1">
                {description}
              </div>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    ))
  },

  info: (message: string, description?: string) => {
    return toast.custom((t) => (
      <div className="bg-white border border-blue-200 rounded-xl shadow-lg p-4 max-w-md w-full">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {message}
            </div>
            {description && (
              <div className="text-sm text-slate-600 mt-1">
                {description}
              </div>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    ))
  },

  promise: <T,>(
    promise: Promise<T>,
    msgs: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) => {
    return toast.promise(promise, {
      loading: msgs.loading,
      success: msgs.success,
      error: msgs.error,
    })
  }
}

export { TumbleToaster, tumbleToast }