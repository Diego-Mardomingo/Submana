"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hrefWithoutParams } from "@/lib/deepLinks";

/**
 * A URL param used as a deep link (`?sub=`, `?expense=`, `?tx=`, `?month=`): its parsed value (null when
 * absent or invalid) and a function that removes it with `router.replace`, like `useCreateDialog`.
 * It follows the URL, so it also works when the param changes while the page is already mounted
 * (a push notification or the inbox does `router.push` into an open page).
 */
export function useUrlParam<T>(name: string, parse: (raw: string | null) => T | null) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const value = parse(new URLSearchParams(search).get(name));
  const clear = useCallback(() => router.replace(hrefWithoutParams(pathname, search, name), { scroll: false }), [router, pathname, search, name]);
  return [value, clear] as const;
}
