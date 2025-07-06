import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const tumbleIconButtonVariants = cva(
  "relative inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7E7E1]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border-0 outline-0 select-none overflow-hidden",
  {
    variants: {
      variant: {
        default: 
          "bg-gradient-to-br from-[#B5EDE7] via-[#A7E7E1] to-[#8BE2B3] text-slate-800 shadow-[0_2px_8px_rgba(167,231,225,0.25)] hover:shadow-[0_4px_16px_rgba(167,231,225,0.35)] hover:from-[#A7E7E1] hover:via-[#95DDD5] hover:to-[#7DD9A3] active:scale-[0.95] transform hover:scale-[1.05] hover:-translate-y-0.5 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:via-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        destructive:
          "bg-gradient-to-br from-red-400 via-red-500 to-red-600 text-white shadow-[0_2px_8px_rgba(239,68,68,0.25)] hover:shadow-[0_4px_16px_rgba(239,68,68,0.35)] hover:from-red-500 hover:via-red-600 hover:to-red-700 active:scale-[0.95] transform hover:scale-[1.05] hover:-translate-y-0.5 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:via-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        outline:
          "bg-white/80 backdrop-blur-sm text-slate-700 shadow-[0_1px_4px_rgba(148,163,184,0.12)] hover:shadow-[0_2px_8px_rgba(167,231,225,0.15)] border border-[#A7E7E1]/30 hover:border-[#A7E7E1]/60 hover:bg-gradient-to-br hover:from-[#A7E7E1]/5 hover:to-[#8BE2B3]/5 active:scale-[0.95] transform hover:scale-[1.05] hover:-translate-y-0.5 before:absolute before:inset-0 before:bg-gradient-to-br before:from-[#A7E7E1]/8 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        secondary:
          "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-150 text-slate-700 shadow-[0_1px_4px_rgba(148,163,184,0.12)] hover:shadow-[0_2px_8px_rgba(148,163,184,0.15)] hover:from-slate-100 hover:via-slate-150 hover:to-slate-200 active:scale-[0.95] transform hover:scale-[1.05] hover:-translate-y-0.5 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/25 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        ghost: 
          "text-slate-600 hover:bg-gradient-to-br hover:from-[#A7E7E1]/8 hover:via-[#8BE2B3]/5 hover:to-[#A7E7E1]/8 hover:text-slate-800 hover:shadow-[0_1px_4px_rgba(167,231,225,0.08)] active:scale-[0.95] transform hover:scale-[1.05] before:absolute before:inset-0 before:bg-gradient-to-br before:from-[#A7E7E1]/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
      },
      size: {
        sm: "h-8 w-8 rounded-md [&_svg]:size-3",
        default: "h-10 w-10 rounded-lg [&_svg]:size-4",
        lg: "h-12 w-12 rounded-xl [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "default",
    },
  }
)

export interface TumbleIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tumbleIconButtonVariants> {
  asChild?: boolean
}

const TumbleIconButton = React.forwardRef<HTMLButtonElement, TumbleIconButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(tumbleIconButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
TumbleIconButton.displayName = "TumbleIconButton"

export { TumbleIconButton, tumbleIconButtonVariants }