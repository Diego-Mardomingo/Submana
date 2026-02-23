"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"
import { es, enUS } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useMediaQuery } from "@/hooks/useMediaQuery"

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  lang?: string
  disabled?: boolean
  className?: string
  /** Muestra botón X para limpiar el valor (útil para fecha de fin opcional) */
  clearable?: boolean
}

function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  lang = "es",
  disabled = false,
  className,
  clearable = false,
}: DatePickerProps) {
  const locale = lang === "es" ? es : enUS
  const [open, setOpen] = React.useState(false)
  const isMobile = useMediaQuery("(max-width: 767px)")

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onChange?.(undefined)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10 pr-8 relative",
            !value && "text-muted-foreground",
            clearable && value && "pr-10",
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className="flex-1 truncate">
            {value ? (
              format(value, "PPP", { locale })
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          {clearable && value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={lang === "es" ? "Limpiar fecha" : "Clear date"}
            >
              <X className="size-4" />
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        side={isMobile ? "top" : "bottom"}
        sideOffset={isMobile ? 8 : 4}
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date)
            setOpen(false)
          }}
          locale={locale}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
