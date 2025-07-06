import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const tumbleButtonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7E7E1]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border-0 outline-0 select-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 overflow-hidden",
  {
    variants: {
      variant: {
        default: 
          "bg-gradient-to-br from-[#B5EDE7] via-[#A7E7E1] to-[#8BE2B3] text-slate-800 shadow-[0_4px_12px_rgba(167,231,225,0.3),0_2px_4px_rgba(167,231,225,0.2)] hover:shadow-[0_8px_25px_rgba(167,231,225,0.4),0_4px_12px_rgba(139,226,179,0.3)] hover:from-[#A7E7E1] hover:via-[#95DDD5] hover:to-[#7DD9A3] active:scale-[0.98] transform hover:scale-[1.02] hover:-translate-y-0.5 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:via-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        destructive:
          "bg-gradient-to-br from-red-400 via-red-500 to-red-600 text-white shadow-[0_4px_12px_rgba(239,68,68,0.3),0_2px_4px_rgba(239,68,68,0.2)] hover:shadow-[0_8px_25px_rgba(239,68,68,0.4),0_4px_12px_rgba(220,38,38,0.3)] hover:from-red-500 hover:via-red-600 hover:to-red-700 active:scale-[0.98] transform hover:scale-[1.02] hover:-translate-y-0.5 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:via-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        outline:
          "relative bg-white/80 backdrop-blur-sm text-slate-700 shadow-[0_2px_8px_rgba(148,163,184,0.15)] hover:shadow-[0_4px_16px_rgba(167,231,225,0.2)] border border-[#A7E7E1]/30 hover:border-[#A7E7E1]/60 hover:bg-gradient-to-br hover:from-[#A7E7E1]/5 hover:to-[#8BE2B3]/5 active:scale-[0.98] transform hover:scale-[1.02] hover:-translate-y-0.5 before:absolute before:inset-0 before:bg-gradient-to-br before:from-[#A7E7E1]/10 before:via-[#8BE2B3]/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        secondary:
          "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-150 text-slate-700 shadow-[0_2px_8px_rgba(148,163,184,0.15)] hover:shadow-[0_4px_16px_rgba(148,163,184,0.2)] hover:from-slate-100 hover:via-slate-150 hover:to-slate-200 active:scale-[0.98] transform hover:scale-[1.02] hover:-translate-y-0.5 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/30 before:via-white/15 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        ghost: 
          "text-slate-600 hover:bg-gradient-to-br hover:from-[#A7E7E1]/8 hover:via-[#8BE2B3]/5 hover:to-[#A7E7E1]/8 hover:text-slate-800 hover:shadow-[0_2px_8px_rgba(167,231,225,0.1)] active:scale-[0.98] transform hover:scale-[1.01] before:absolute before:inset-0 before:bg-gradient-to-br before:from-[#A7E7E1]/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        link: 
          "text-[#2D8A82] font-medium underline-offset-4 hover:underline hover:text-[#1F6B63] active:scale-[0.98] hover:shadow-[0_2px_4px_rgba(45,138,130,0.1)] transition-all duration-200",
      },
      size: {
        default: "h-12 px-7 py-3",
        sm: "h-9 rounded-lg px-5 text-xs",
        lg: "h-14 rounded-2xl px-10 text-base",
        icon: "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface TumbleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tumbleButtonVariants> {
  asChild?: boolean
}

const TumbleButton = React.forwardRef<HTMLButtonElement, TumbleButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(tumbleButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
TumbleButton.displayName = "TumbleButton"

export { TumbleButton, tumbleButtonVariants }