"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Open state of a page's "create" dialog, also opened by linking to `?open=create`. */
export function useCreateDialog() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const fromUrl = params.get("open") === "create";
  const setDialogOpen = (next: boolean) => {
    setOpen(next);
    if (!next && fromUrl) router.replace(pathname, { scroll: false });
  };
  return [open || fromUrl, setDialogOpen] as const;
}
