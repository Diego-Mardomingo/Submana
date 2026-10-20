"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "@/lib/toast";
import { FieldGroup, Segmented, SheetButton } from "@/components/SheetFields";
import { Sheet, SheetBody, SheetFooter, SheetForm } from "@/components/ui/sheet";
import { useLang } from "@/hooks/useLang";
import { api } from "@/lib/api";
import { apiErrorText } from "@/lib/apiErrorText";
import { useTranslations } from "@/lib/i18n/utils";

/** Send a suggestion or report an error (saved in `feedback`). Opened from the + menu and from the profile. */
export function FeedbackSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const [type, setType] = useState<"error" | "suggestion">("suggestion");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      await api("/api/feedback", "POST", { type, message: text });
      onOpenChange(false);
      setMessage("");
      toast.success(t("feedback.success"));
    } catch (err) {
      toast.error(t("feedback.error"), { description: apiErrorText(t, err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("feedback.title")}>
      <SheetForm onSubmit={send}>
        <SheetBody>
          <Segmented
            label={t("feedback.message")}
            value={type}
            onChange={setType}
            options={[
              { value: "suggestion", label: t("feedback.typeSuggestion") },
              { value: "error", label: t("feedback.typeError") },
            ]}
          />
          <FieldGroup title={t("feedback.message")}>
            <textarea
              className="sf-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "error"
                  ? es
                    ? "¿Qué ha fallado y qué estabas haciendo?"
                    : "What went wrong and what were you doing?"
                  : es
                    ? "¿Qué te gustaría mejorar o añadir?"
                    : "What would you like to improve or add?"
              }
              rows={6}
              aria-label={t("feedback.message")}
            />
          </FieldGroup>
        </SheetBody>
        <SheetFooter>
          <SheetButton type="submit" pending={sending} disabled={!message.trim()}>
            <Send aria-hidden />
            {t("feedback.send")}
          </SheetButton>
        </SheetFooter>
      </SheetForm>
    </Sheet>
  );
}
