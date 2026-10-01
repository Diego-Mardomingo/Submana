"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Calendar, CreditCard, FileUp, MessageCircle, Receipt, Tags, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { api } from "@/lib/api";
import { getBankProvider } from "@/lib/bankProviders";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";

type Modal = "import" | "feedback";

/** Import goes last so it spans two grid columns. */
const SHORTCUTS: { icon: LucideIcon; labelKey: UIKey; href?: string; modal?: Modal }[] = [
  { icon: Calendar, labelKey: "addShortcuts.newSubscription", href: "/subscriptions/new" },
  { icon: Receipt, labelKey: "addShortcuts.newTransaction", href: "/transactions/new" },
  { icon: CreditCard, labelKey: "addShortcuts.newAccount", href: "/accounts?open=create" },
  { icon: Wallet, labelKey: "addShortcuts.newBudget", href: "/budgets?open=create" },
  { icon: Tags, labelKey: "addShortcuts.newCategory", href: "/categories?open=create" },
  { icon: MessageCircle, labelKey: "addShortcuts.feedback", modal: "feedback" },
  { icon: FileUp, labelKey: "addShortcuts.import", modal: "import" },
];

const IMPORTABLE_PROVIDERS = ["trade_republic", "revolut", "bbva", "imagin"];

/** Quick-add bubbles (mounted only while open), with the import and feedback dialogs. */
export default function AddShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: accounts = [] } = useAccounts();
  const [modal, setModal] = useState<Modal | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"error" | "suggestion">("suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Revolut savings accounts are filled from the main Revolut statement.
  const importable = accounts.filter(
    (a) => a.bank_provider && IMPORTABLE_PROVIDERS.includes(a.bank_provider) && !(a.bank_provider === "revolut" && /remunerada|savings/i.test(a.name))
  );

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const requestClose = () => {
    if (modal) return;
    setIsClosing(true);
    setTimeout(onClose, 400);
  };

  const sendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = feedbackMessage.trim();
    if (!message) return;
    setSending(true);
    try {
      await api("/api/feedback", "POST", { type: feedbackType, message });
      onClose();
      toast.success(t("feedback.success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error sending feedback");
    } finally {
      setSending(false);
    }
  };

  const closeModal = (open: boolean) => !open && setModal(null);

  return createPortal(
    <div
      className={`add-shortcuts-overlay ${isClosing ? "add-shortcuts-overlay--closing" : ""}`}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
      onKeyDown={(e) => e.key === "Escape" && requestClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Quick add menu"
    >
      {!modal && (
        <div className={`add-shortcuts-bubbles ${isClosing ? "add-shortcuts-bubbles--closing" : ""}`}>
          {SHORTCUTS.map(({ icon: Icon, labelKey, href, modal: target }, index) => (
            <button
              key={labelKey}
              type="button"
              className={`add-shortcuts-bubble ${index === SHORTCUTS.length - 1 ? "add-shortcuts-bubble--span-2" : ""}`}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => (href ? go(href) : setModal(target!))}
            >
              <Icon className="add-shortcuts-bubble-icon" strokeWidth={2} />
              <span className="add-shortcuts-bubble-label">{t(labelKey)}</span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={modal === "import"} onOpenChange={closeModal}>
        <DialogContent className="add-shortcuts-import-dialog add-shortcuts-dialog-elevated">
          <DialogHeader>
            <DialogTitle>{t("addShortcuts.importTitle")}</DialogTitle>
          </DialogHeader>
          {importable.length === 0 ? (
            <p className="text-[var(--gris-claro)] text-sm py-4">{t("addShortcuts.noAccountsImport")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {importable.map((acc) => (
                <Button key={acc.id} variant="outline" className="justify-start gap-3 h-auto py-3" onClick={() => go(`/account/${acc.id}?import=1&autoupload=1`)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote brand logo */}
                  <img src={getBankProvider(acc.bank_provider)?.icon} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <span>{acc.name}</span>
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "feedback"} onOpenChange={closeModal}>
        <DialogContent className="add-shortcuts-feedback-dialog add-shortcuts-dialog-elevated">
          <DialogHeader>
            <DialogTitle>{t("feedback.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={sendFeedback} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("feedback.message")}</Label>
              <div className="flex gap-2">
                {(["error", "suggestion"] as const).map((type) => (
                  <Button key={type} type="button" variant={feedbackType === type ? "default" : "outline"} size="sm" onClick={() => setFeedbackType(type)}>
                    {t(type === "error" ? "feedback.typeError" : "feedback.typeSuggestion")}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder={lang === "es" ? "Describe el error o tu sugerencia..." : "Describe the error or your suggestion..."}
              rows={4}
              className="resize-none !field-sizing-fixed w-full max-w-full"
              required
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={sending || !feedbackMessage.trim()}>
                {sending ? "…" : t("feedback.send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>,
    document.body
  );
}
