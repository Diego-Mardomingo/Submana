"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import {
  Calendar,
  Receipt,
  CreditCard,
  Wallet,
  Tags,
  FileUp,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useAccounts } from "@/hooks/useAccounts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getBankProvider } from "@/lib/bankProviders";
import type { UIKey } from "@/lib/i18n/ui";

const ACCOUNTS_WITH_IMPORT = ["trade_republic", "revolut", "bbva", "imagin"];

interface AccountWithProvider {
  id: string;
  name: string;
  bank_provider?: string | null;
}

type ShortcutId =
  | "subscription"
  | "transaction"
  | "account"
  | "budget"
  | "category"
  | "import"
  | "feedback";

interface ShortcutItem {
  id: ShortcutId;
  icon: LucideIcon;
  labelKey: UIKey;
}

/* Orden: import último para que ocupe 2 columnas en el grid */
const SHORTCUTS: ShortcutItem[] = [
  { id: "subscription", icon: Calendar, labelKey: "addShortcuts.newSubscription" },
  { id: "transaction", icon: Receipt, labelKey: "addShortcuts.newTransaction" },
  { id: "account", icon: CreditCard, labelKey: "addShortcuts.newAccount" },
  { id: "budget", icon: Wallet, labelKey: "addShortcuts.newBudget" },
  { id: "category", icon: Tags, labelKey: "addShortcuts.newCategory" },
  { id: "feedback", icon: MessageCircle, labelKey: "addShortcuts.feedback" },
  { id: "import", icon: FileUp, labelKey: "addShortcuts.import" },
];

interface AddShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function AddShortcutsOverlay({ open, onClose }: AddShortcutsOverlayProps) {
  const router = useRouter();
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: accounts = [] } = useAccounts();

  const [showImportModal, setShowImportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"error" | "suggestion">("suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const importableAccounts = accounts.filter((a: AccountWithProvider) => {
    if (!a.bank_provider || !ACCOUNTS_WITH_IMPORT.includes(a.bank_provider))
      return false;
    // Excluir Revolut remunerada: el extracto se sube a la principal de Revolut
    if (a.bank_provider === "revolut" && a.name?.toLowerCase().includes("remunerada"))
      return false;
    if (a.bank_provider === "revolut" && a.name?.toLowerCase().includes("savings"))
      return false;
    return true;
  }) as AccountWithProvider[];

  const handleShortcut = useCallback(
    (id: ShortcutId) => {
      switch (id) {
        case "subscription":
          onClose();
          router.push("/subscriptions/new");
          break;
        case "transaction":
          onClose();
          router.push("/transactions/new");
          break;
        case "account":
          onClose();
          router.push("/accounts?open=create");
          break;
        case "budget":
          onClose();
          router.push("/budgets?open=create");
          break;
        case "category":
          onClose();
          router.push("/categories?open=create");
          break;
        case "import":
          setShowImportModal(true);
          break;
        case "feedback":
          setShowFeedbackModal(true);
          break;
      }
    },
    [onClose, router]
  );

  useEffect(() => {
    if (open) {
      setShowImportModal(false);
      setShowFeedbackModal(false);
      setFeedbackMessage("");
    }
  }, [open]);

  const handleImportAccount = (accountId: string) => {
    onClose();
    setShowImportModal(false);
    router.push(`/account/${accountId}?import=1&autoupload=1`);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = feedbackMessage.trim();
    if (!msg) return;
    setFeedbackSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: feedbackType, message: msg }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to send");
      }
      setShowFeedbackModal(false);
      setFeedbackMessage("");
      onClose();
      toast.success(t("feedback.success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error sending feedback");
    } finally {
      setFeedbackSending(false);
    }
  };

  const handleRequestClose = useCallback(() => {
    if (showImportModal || showFeedbackModal) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 400);
  }, [showImportModal, showFeedbackModal, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleRequestClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !showImportModal && !showFeedbackModal) {
      handleRequestClose();
    }
  };

  if (!open && !isClosing) return null;

  const showBubbles = !showFeedbackModal && !showImportModal;

  const content = (
    <div
      className={`add-shortcuts-overlay ${isClosing ? "add-shortcuts-overlay--closing" : ""}`}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Quick add menu"
    >
      {showBubbles && (
        <div className={`add-shortcuts-bubbles ${isClosing ? "add-shortcuts-bubbles--closing" : ""}`}>
          {SHORTCUTS.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === SHORTCUTS.length - 1;
            return (
              <button
                key={item.id}
                type="button"
                className={`add-shortcuts-bubble ${isLast ? "add-shortcuts-bubble--span-2" : ""}`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => handleShortcut(item.id)}
              >
                <Icon className="add-shortcuts-bubble-icon" strokeWidth={2} />
                <span className="add-shortcuts-bubble-label">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}

      {showImportModal && (
        <Dialog open={showImportModal} onOpenChange={(o) => !o && setShowImportModal(false)}>
          <DialogContent className="add-shortcuts-import-dialog add-shortcuts-dialog-elevated">
            <DialogHeader>
              <DialogTitle>{t("addShortcuts.importTitle")}</DialogTitle>
            </DialogHeader>
            {importableAccounts.length === 0 ? (
              <p className="text-[var(--gris-claro)] text-sm py-4">
                {t("addShortcuts.noAccountsImport")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {importableAccounts.map((acc) => {
                  const provider = getBankProvider(acc.bank_provider);
                  return (
                    <Button
                      key={acc.id}
                      variant="outline"
                      className="justify-start gap-3 h-auto py-3"
                      onClick={() => handleImportAccount(acc.id)}
                    >
                      {provider?.icon && (
                        <img
                          src={provider.icon}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <span>{acc.name}</span>
                    </Button>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {showFeedbackModal && (
        <Dialog open={showFeedbackModal} onOpenChange={(o) => !o && setShowFeedbackModal(false)}>
          <DialogContent className="add-shortcuts-feedback-dialog add-shortcuts-dialog-elevated">
            <DialogHeader>
              <DialogTitle>{t("feedback.title")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("feedback.message")}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={feedbackType === "error" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFeedbackType("error")}
                  >
                    {t("feedback.typeError")}
                  </Button>
                  <Button
                    type="button"
                    variant={feedbackType === "suggestion" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFeedbackType("suggestion")}
                  >
                    {t("feedback.typeSuggestion")}
                  </Button>
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
                <Button type="button" variant="ghost" onClick={() => setShowFeedbackModal(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={feedbackSending || !feedbackMessage.trim()}>
                  {feedbackSending ? "…" : t("feedback.send")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}
