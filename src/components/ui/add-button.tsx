"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

/** Page header "add" action: a link with `href`, otherwise a button. */
export function AddButton({ children, onClick, href }: { children: React.ReactNode; onClick?: () => void; href?: string }) {
  const content = (
    <>
      <Plus className="h-5 w-5" strokeWidth={2.5} />
      <span>{children}</span>
    </>
  )
  return href ? (
    <Link href={href} className="add-btn">
      {content}
    </Link>
  ) : (
    <button type="button" className="add-btn" onClick={onClick}>
      {content}
    </button>
  )
}
