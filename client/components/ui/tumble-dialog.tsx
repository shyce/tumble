"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

function TumbleDialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="tumble-dialog" {...props} />
}

function TumbleDialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="tumble-dialog-trigger" {...props} />
}

function TumbleDialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="tumble-dialog-portal" {...props} />
}

function TumbleDialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="tumble-dialog-close" {...props} />
}

function TumbleDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="tumble-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-gradient-to-br from-slate-900/80 via-[#2D8A82]/50 to-slate-900/80 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

function TumbleDialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <TumbleDialogPortal data-slot="tumble-dialog-portal">
      <TumbleDialogOverlay />
      <DialogPrimitive.Content
        data-slot="tumble-dialog-content"
        className={cn(
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-2xl duration-300 sm:max-w-2xl",
          // Background and border
          "bg-white border border-[#A7E7E1]/30 shadow-[0_20px_50px_rgba(45,138,130,0.15),0_0_100px_rgba(167,231,225,0.1)]",
          className
        )}
        {...props}
      >
        {/* Scrollable content wrapper with fixed header/footer support */}
        <div className="relative flex flex-col max-h-[calc(100vh-8rem)] p-6">
          {/* Decorative gradient accent at top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#A7E7E1] to-transparent opacity-60 rounded-t-2xl" />
          
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="tumble-dialog-close"
              className="absolute -top-3 -right-3 z-50 rounded-full bg-white shadow-lg border border-slate-200 hover:bg-gradient-to-br hover:from-[#A7E7E1]/10 hover:to-[#8BE2B3]/10 hover:border-[#A7E7E1]/40 transition-all duration-200 focus:ring-2 focus:ring-[#A7E7E1]/50 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none p-2 group cursor-pointer"
            >
              <X className="h-4 w-4 text-slate-600 group-hover:text-[#2D8A82] transition-colors" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
          
          {children}
        </div>
      </DialogPrimitive.Content>
    </TumbleDialogPortal>
  )
}

function TumbleDialogHeader({ 
  className, 
  ...props 
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tumble-dialog-header"
      className={cn(
        "flex flex-col gap-2 text-center sm:text-left flex-shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TumbleDialogFooter({ 
  className, 
  ...props 
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tumble-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end flex-shrink-0 pt-4 border-t border-slate-100",
        className
      )}
      {...props}
    />
  )
}

function TumbleDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="tumble-dialog-title"
      className={cn(
        "text-xl font-bold bg-gradient-to-br from-slate-800 via-[#2D8A82] to-slate-700 bg-clip-text text-transparent leading-tight",
        className
      )}
      {...props}
    />
  )
}

function TumbleDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="tumble-dialog-description"
      className={cn("text-sm text-slate-600", className)}
      {...props}
    />
  )
}

// Scrollable body component for content that might overflow
function TumbleDialogBody({ 
  className, 
  ...props 
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tumble-dialog-body"
      className={cn(
        "flex-1 overflow-y-auto px-1 -mx-1", // Negative margin to allow scrollbar at edge
        className
      )}
      {...props}
    />
  )
}

export {
  TumbleDialog,
  TumbleDialogClose,
  TumbleDialogContent,
  TumbleDialogDescription,
  TumbleDialogFooter,
  TumbleDialogHeader,
  TumbleDialogOverlay,
  TumbleDialogPortal,
  TumbleDialogTitle,
  TumbleDialogTrigger,
  TumbleDialogBody,
}