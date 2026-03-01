"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

interface AddButtonProps {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  disabled?: boolean
}

export function AddButton({ children, onClick, href, disabled }: AddButtonProps) {
  const content = (
    <>
      <Plus className="h-5 w-5" strokeWidth={2.5} />
      <span>{children}</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="add-btn">
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className="add-btn" onClick={onClick} disabled={disabled}>
      {content}
    </button>
  )
}
