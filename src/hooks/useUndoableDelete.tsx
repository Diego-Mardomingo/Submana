"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiErrorText } from "@/lib/apiErrorText";
import { currentT } from "@/lib/i18n/client";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";
import { toast, type ToastSubject } from "@/lib/toast";
import { startUndoableDelete, type UndoableDeleteOptions } from "@/lib/undoableDelete";
import { useLang } from "./useLang";

/**
 * Reversible delete without a confirmation: hides the item, shows an "Undo" toast and only sends
 * the DELETE when the toast closes (see `startUndoableDelete`). `subject` shows what was deleted.
 */
export function useUndoableDelete() {
  const queryClient = useQueryClient();
  const t = useTranslations(useLang());
  return useCallback(
    ({ title, subject, ...options }: Omit<UndoableDeleteOptions, "queryClient" | "onError"> & { title: UIKey; subject?: ToastSubject }) => {
      const { undo, commit } = startUndoableDelete({
        ...options,
        queryClient,
        onError: (error) => toast.error(apiErrorText(currentT(), error)),
      });
      toast(t(title), { icon: <Trash2 />, subject, action: { label: t("common.undo"), onClick: undo }, onClose: () => void commit() });
    },
    [queryClient, t]
  );
}
