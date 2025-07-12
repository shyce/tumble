"use client"

import { AlertCircle, XCircle } from "lucide-react"
import {
  TumbleDialog,
  TumbleDialogContent,
  TumbleDialogDescription,
  TumbleDialogFooter,
  TumbleDialogHeader,
  TumbleDialogTitle,
} from "./tumble-dialog"
import { TumbleButton } from "./tumble-button"

interface TumbleErrorDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  variant?: "error" | "warning"
}

export function TumbleErrorDialog({
  isOpen,
  onClose,
  title,
  message,
  variant = "error",
}: TumbleErrorDialogProps) {
  return (
    <TumbleDialog open={isOpen} onOpenChange={onClose}>
      <TumbleDialogContent className="sm:max-w-md">
        <TumbleDialogHeader>
          <div className="flex items-center gap-3">
            {variant === "error" ? (
              <div className="flex-shrink-0 w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
            ) : (
              <div className="flex-shrink-0 w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
            )}
            <TumbleDialogTitle className="text-left">{title}</TumbleDialogTitle>
          </div>
        </TumbleDialogHeader>
        
        <div className="py-4">
          <TumbleDialogDescription className="text-base leading-relaxed whitespace-pre-wrap">
            {message}
          </TumbleDialogDescription>
        </div>

        <TumbleDialogFooter>
          <TumbleButton onClick={onClose} variant="default" className="w-full">
            OK
          </TumbleButton>
        </TumbleDialogFooter>
      </TumbleDialogContent>
    </TumbleDialog>
  )
}