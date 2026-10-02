"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, CreditCard, FileUp, MessageCircle, Receipt, Send, Tags, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ActionRow, FieldGroup, Segmented, SheetButton } from "@/components/SheetFields";
import { Sheet, SheetBody, SheetFooter, SheetForm } from "@/components/ui/sheet";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { api } from "@/lib/api";
import { getBankProvider } from "@/lib/bankProviders";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";

type Modal = "import" | "feedback";

/** Import goes last so it spans two grid columns. */
const SHORTCUTS: { icon: LucideIcon; labelKey: UIKey; href?: string; modal?: Modal }[] = [
  { icon: Calendar, labelKey: "addShortcuts.newSubscription", href: "/subscriptions?open=create" },
  { icon: Receipt, labelKey: "addShortcuts.newTransaction", href: "/transactions?open=create" },
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
  const es = lang === "es";
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
      // Escape inside a sheet only closes the sheet (React events bubble out of portals).
      onKeyDown={(e) => e.key === "Escape" && !(e.target as Element).closest(".sheet") && requestClose()}
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

      <Sheet
        open={modal === "import"}
        onOpenChange={closeModal}
        title={t("addShortcuts.importTitle")}
        description={es ? "Elige la cuenta del extracto" : "Pick the statement's account"}
      >
        <SheetBody>
          {importable.length === 0 ? (
            <p className="sf-hint">{t("addShortcuts.noAccountsImport")}</p>
          ) : (
            <FieldGroup>
              {importable.map((acc) => {
                const bank = getBankProvider(acc.bank_provider);
                return (
                  <ActionRow
                    key={acc.id}
                    className="sf-action--account"
                    // eslint-disable-next-line @next/next/no-img-element -- remote brand logo
                    icon={<img src={bank?.icon} alt="" />}
                    onClick={() => go(`/account/${acc.id}?import=1&autoupload=1`)}
                  >
                    <span className="sf-action-text">
                      {acc.name}
                      <small>
                        {bank?.name} · {bank?.formatLabel}
                      </small>
                    </span>
                    <ChevronRight className="sf-action-chevron" aria-hidden />
                  </ActionRow>
                );
              })}
            </FieldGroup>
          )}
        </SheetBody>
      </Sheet>

      <Sheet open={modal === "feedback"} onOpenChange={closeModal} title={t("feedback.title")}>
        <SheetForm onSubmit={sendFeedback}>
          <SheetBody>
            <Segmented
              label={t("feedback.message")}
              value={feedbackType}
              onChange={setFeedbackType}
              options={[
                { value: "suggestion", label: t("feedback.typeSuggestion") },
                { value: "error", label: t("feedback.typeError") },
              ]}
            />
            <FieldGroup title={t("feedback.message")}>
              <textarea
                className="sf-textarea"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder={
                  feedbackType === "error"
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
            <SheetButton type="submit" pending={sending} disabled={!feedbackMessage.trim()}>
              <Send aria-hidden />
              {t("feedback.send")}
            </SheetButton>
          </SheetFooter>
        </SheetForm>
      </Sheet>
    </div>,
    document.body
  );
}
