"use client"

import { Plus, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

interface SubmitButtonProps {
  children: React.ReactNode
  pending?: boolean
  isEdit?: boolean
  disabled?: boolean
  className?: string
}

export function SubmitButton({ 
  children, 
  pending, 
  isEdit,
  disabled,
  className 
}: SubmitButtonProps) {
  return (
    <Button 
      type="submit" 
      className={className ?? "w-full h-12 rounded-xl gap-2"} 
      disabled={pending || disabled}
    >
      {pending ? (
        <Spinner className="size-5" />
      ) : isEdit ? (
        <Save className="h-5 w-5" />
      ) : (
        <Plus className="h-5 w-5" />
      )}
      {children}
    </Button>
  )
}
