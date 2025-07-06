import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "./label"

export interface TumbleSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

const TumbleSelect = React.forwardRef<HTMLSelectElement, TumbleSelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const generatedId = React.useId()
    const selectId = id || `select-${generatedId}`
    
    return (
      <div className="space-y-2">
        {label && (
          <Label 
            htmlFor={selectId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
          </Label>
        )}
        <select
          id={selectId}
          className={cn(
            // Override default styles with Tumble brand
            "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500",
            "focus:border-[#A7E7E1] focus:ring-2 focus:ring-[#A7E7E1]/20 focus:outline-none",
            "hover:border-slate-400 transition-colors",
            "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)
TumbleSelect.displayName = "TumbleSelect"

export { TumbleSelect }