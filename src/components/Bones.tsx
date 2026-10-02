"use client";

import { Skeleton } from "boneyard-js/react";
import "@/bones/registry";

/**
 * Loading placeholder captured from the real layout by `pnpm bones` (boneyard). While `loading`,
 * the bones registered under `name` are drawn; until they exist (or for an uncaptured name) the
 * hand-made `fallback` shows instead. `children` only render once loaded, so the build snapshots
 * the real content and the skeleton never measures a half-empty tree.
 */
export function Bones({
  name,
  loading,
  fallback,
  className,
  children,
}: {
  name: string;
  loading: boolean;
  fallback?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    // Bones are captured per viewport width; the nav makes containers narrower than the window.
    <Skeleton name={name} loading={loading} fallback={fallback} className={className} select="viewport">
      {loading ? null : children}
    </Skeleton>
  );
}
