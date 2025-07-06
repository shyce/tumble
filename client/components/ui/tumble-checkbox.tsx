import * as React from "react"
import { cn } from "@/lib/utils"

export interface TumbleCheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  description?: string
  error?: string
}

const TumbleCheckbox = React.forwardRef<HTMLInputElement, TumbleCheckboxProps>(
  ({ className, label, description, error, ...props }, ref) => {
    const checkboxId = React.useId()
    
    return (
      <div className="space-y-2">
        {/* Ghost label to align with other Tumble inputs */}
        <div className="text-sm font-medium text-transparent select-none pointer-events-none" aria-hidden="true">
          &nbsp;
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative group flex items-center">
            <input
              id={checkboxId}
              type="checkbox"
              ref={ref}
              className={cn(
                "peer appearance-none h-5 w-5 shrink-0 rounded-lg border-2 border-slate-300 bg-white transition-all duration-300 ease-out cursor-pointer",
                "shadow-[0_1px_3px_rgba(148,163,184,0.1)] hover:shadow-[0_2px_6px_rgba(167,231,225,0.15)]",
                "focus:ring-2 focus:ring-[#A7E7E1]/50 focus:ring-offset-2 focus:ring-offset-white",
                "checked:bg-gradient-to-br checked:from-[#A7E7E1] checked:to-[#8BE2B3] checked:border-[#A7E7E1]",
                "checked:shadow-[0_2px_8px_rgba(167,231,225,0.3)] checked:hover:shadow-[0_3px_12px_rgba(167,231,225,0.4)]",
                "hover:border-[#A7E7E1] hover:scale-[1.05] active:scale-95",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 disabled:hover:scale-100",
                error && "border-red-500 focus:ring-red-500/20 checked:from-red-400 checked:to-red-500 checked:border-red-500",
                className
              )}
              {...props}
            />
            {/* Custom checkmark - positioned absolutely and only shows when checked */}
            <svg
              className="absolute inset-0 w-5 h-5 text-slate-800 opacity-0 peer-checked:opacity-100 transition-all duration-300 pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M5 13l4 4L19 7"
              />
            </svg>
            
            {/* Ripple effect overlay */}
            <div className="absolute inset-0 rounded-lg opacity-0 peer-active:opacity-100 peer-active:animate-ping bg-[#A7E7E1]/20 pointer-events-none" />
          </div>
          
          {label && (
            <label
              htmlFor={checkboxId}
              className={cn(
                "text-sm font-medium text-slate-700 cursor-pointer select-none leading-relaxed",
                "hover:text-slate-800 transition-colors duration-200",
                "group-hover:text-slate-800",
                error && "text-red-700"
              )}
            >
              {label}
            </label>
          )}
        </div>
        
        {description && (
          <p className="text-xs text-slate-500 ml-8 leading-relaxed">{description}</p>
        )}
        
        {error && (
          <p className="text-sm text-red-600 font-medium ml-8">{error}</p>
        )}
      </div>
    )
  }
)

TumbleCheckbox.displayName = "TumbleCheckbox"

export { TumbleCheckbox }