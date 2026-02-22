"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

function Label({
  className,
  required,
  optional,
  optionalText = "Opcional",
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
  required?: boolean
  optional?: boolean
  optionalText?: string
}) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        required && 'after:ml-0.5 after:text-destructive after:content-["*"]',
        className
      )}
      {...props}
    >
      {children}
      {optional && (
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] font-normal text-muted-foreground border-muted-foreground/30">
          {optionalText}
        </Badge>
      )}
    </LabelPrimitive.Root>
  )
}

export { Label }
