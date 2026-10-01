"use client"

import { Plus, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/** Form submit button: spinner while pending, save icon when editing, plus icon when creating. */
export function SubmitButton({ children, pending, isEdit, className }: { children: React.ReactNode; pending?: boolean; isEdit?: boolean; className?: string }) {
  return (
    <Button type="submit" className={className ?? "w-full h-12 rounded-xl gap-2"} disabled={pending}>
      {pending ? <Spinner className="size-5" /> : isEdit ? <Save className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      {children}
    </Button>
  )
}
