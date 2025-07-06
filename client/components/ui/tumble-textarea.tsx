import * as React from "react"
import { cn } from "@/lib/utils"
import { Textarea } from "./textarea"
import { Label } from "./label"

export interface TumbleTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const TumbleTextarea = React.forwardRef<HTMLTextAreaElement, TumbleTextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = React.useId()
    const textareaId = id || `textarea-${generatedId}`
    
    return (
      <div className="space-y-2">
        {label && (
          <Label 
            htmlFor={textareaId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
          </Label>
        )}
        <Textarea
          id={textareaId}
          className={cn(
            // Override default shadcn styles with Tumble brand
            "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500",
            "focus:border-[#A7E7E1] focus:ring-2 focus:ring-[#A7E7E1]/20",
            "hover:border-slate-400 transition-colors",
            "disabled:bg-slate-50 disabled:text-slate-500",
            "resize-y min-h-[80px]",
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
TumbleTextarea.displayName = "TumbleTextarea"

export { TumbleTextarea }