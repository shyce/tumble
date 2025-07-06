import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "./input"
import { Label } from "./label"

export interface TumbleInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const TumbleInput = React.forwardRef<HTMLInputElement, TumbleInputProps>(
  ({ className, type, label, error, id, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || `input-${generatedId}`
    
    return (
      <div className="space-y-2">
        {label && (
          <Label 
            htmlFor={inputId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
          </Label>
        )}
        <Input
          type={type}
          id={inputId}
          className={cn(
            // Override default shadcn styles with Tumble brand
            "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500",
            "focus:border-[#A7E7E1] focus:ring-2 focus:ring-[#A7E7E1]/20",
            "hover:border-slate-400 transition-colors",
            "disabled:bg-slate-50 disabled:text-slate-500",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)
TumbleInput.displayName = "TumbleInput"

export { TumbleInput }