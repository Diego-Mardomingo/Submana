"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, CreditCard, FileUp, MessageCircle, Receipt, Send, Split, Tags, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ActionRow, FieldGroup, Segmented, SheetButton } from "@/components/SheetFields";
import { SharedExpenseSheet } from "@/components/SharedExpenseSheet";
import { Sheet, SheetBody, SheetFooter, SheetForm } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useAccounts } from "@/hooks/useAccounts";
import { useGroup, useGroups } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useProfile } from "@/hooks/useProfile";
import { api } from "@/lib/api";
import { getBankProvider } from "@/lib/bankProviders";
import type { UIKey } from "@/lib/i18n/ui";
import { apiErrorText } from "@/lib/apiErrorText";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";

type Modal = "import" | "feedback" | "subcount" | "subcountExpense";
/** `shortKey`: label under the arc bubble, where the + already says "new" and room is tight. */
type Shortcut = { icon: LucideIcon; labelKey: UIKey; shortKey?: UIKey; href?: string; modal?: Modal };

const TRANSACTION: Shortcut = { icon: Receipt, labelKey: "addShortcuts.newTransaction", shortKey: "addShortcuts.transaction", href: "/transactions?open=create" };
const IMPORT: Shortcut = { icon: FileUp, labelKey: "addShortcuts.import", shortKey: "addShortcuts.importShort", modal: "import" };
const SUBCOUNT: Shortcut = { icon: Split, labelKey: "addShortcuts.subcountExpense", shortKey: "addShortcuts.subcountShort", modal: "subcount" };
const SUBSCRIPTION: Shortcut = { icon: Calendar, labelKey: "addShortcuts.newSubscription", shortKey: "addShortcuts.subscription", href: "/subscriptions?open=create" };
const FEEDBACK: Shortcut = { icon: MessageCircle, labelKey: "addShortcuts.feedback", shortKey: "addShortcuts.feedbackShort", modal: "feedback" };

/** Desktop list: the most used actions (transaction, import, shared expense) first, feedback last. */
const FLYOUT: Shortcut[][] = [
  [TRANSACTION, IMPORT, SUBCOUNT],
  [
    SUBSCRIPTION,
    { icon: CreditCard, labelKey: "addShortcuts.newAccount", href: "/accounts?open=create" },
    { icon: Wallet, labelKey: "addShortcuts.newBudget", href: "/budgets?open=create" },
    { icon: Tags, labelKey: "addShortcuts.newCategory", href: "/categories?open=create" },
  ],
  [FEEDBACK],
];

/**
 * Phones: five bubbles fan out above the + (left to right). The two most used (import, transaction)
 * sit in the middle in the accent colour; the rest of the create actions live on their pages.
 */
const ARC_ITEMS = [SUBSCRIPTION, IMPORT, TRANSACTION, SUBCOUNT, FEEDBACK];
const ARC_PRIMARY = [IMPORT, TRANSACTION];

/** Point on the arc (degrees, left to right); the radii live in CSS so they can follow the viewport. */
const ARC = { from: 170, to: 10 };
const arcPoint = (index: number) => {
  const angle = ((ARC.from - ((ARC.from - ARC.to) * index) / (ARC_ITEMS.length - 1)) * Math.PI) / 180;
  return { cos: Math.cos(angle).toFixed(3), sin: Math.sin(angle).toFixed(3) };
};

const CLOSE_MS = 300;
const IMPORTABLE_PROVIDERS = ["trade_republic", "revolut", "bbva", "imagin"];

/**
 * Quick-add menu, with the import and feedback sheets. Phones: the actions fan out in an arc from
 * the + of the bottom bar (which stays on top, turned into a ×). Desktop: a flyout beside the
 * sidebar's add button (`anchor`). Plays its closing animation once `open` turns false.
 */
export default function AddShortcutsOverlay({ open, anchor, onClose }: { open: boolean; anchor: DOMRect | null; onClose: () => void }) {
  const router = useRouter();
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const { data: accounts = [] } = useAccounts();
  const [rendered, setRendered] = useState(open);
  const [modal, setModal] = useState<Modal | null>(null);
  const [feedbackType, setFeedbackType] = useState<"error" | "suggestion">("suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [groupId, setGroupId] = useState<string>();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: groups = [], isLoading: groupsLoading } = useGroups(!!profile && open);
  // keepPreviousData can still hold the previously picked group while the new one loads.
  const { data: groupData } = useGroup(groupId);
  const group = groupData?.group.id === groupId ? groupData : undefined;

  if (open && !rendered) setRendered(true);
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => {
      setRendered(false);
      setModal(null);
    }, CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Escape inside a sheet is handled by the sheet itself.
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape" && !modal) onClose();
  });
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open]);

  if (!rendered) return null;

  // Revolut savings accounts are filled from the main Revolut statement.
  const activeGroups = groups.filter((g) => !g.archived_at);
  const importable = accounts.filter(
    (a) => a.bank_provider && IMPORTABLE_PROVIDERS.includes(a.bank_provider) && !(a.bank_provider === "revolut" && /remunerada|savings/i.test(a.name))
  );

  const close = () => {
    setModal(null);
    onClose();
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const pick = ({ href, modal: target }: Shortcut) => (target ? setModal(target) : go(href!));
  // Closing a sheet closes the whole menu.
  const closeModal = (isOpen: boolean) => !isOpen && close();

  const sendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = feedbackMessage.trim();
    if (!message) return;
    setSending(true);
    try {
      await api("/api/feedback", "POST", { type: feedbackType, message });
      close();
      setFeedbackMessage("");
      toast.success(t("feedback.success"));
    } catch (err) {
      toast.error(t("feedback.error"), { description: apiErrorText(t, err) });
    } finally {
      setSending(false);
    }
  };

  const closeOnBackdrop = (e: React.MouseEvent) => e.target === e.currentTarget && onClose();

  return createPortal(
    <div
      className="add-fan"
      data-state={!open ? "closing" : modal ? "covered" : "open"}
      data-variant={anchor ? "flyout" : "arc"}
      onClick={closeOnBackdrop}
    >
      {anchor ? (
        <div className="add-flyout" role="menu" aria-label={t("nav.add")} style={{ top: anchor.top, left: anchor.right + 12 }}>
          {FLYOUT.map((group, g) => (
            <div key={g} className="add-flyout-group">
              {group.map((item, i) => (
                <button
                  key={item.labelKey}
                  type="button"
                  role="menuitem"
                  className="add-flyout-item"
                  style={{ "--i": FLYOUT.slice(0, g).flat().length + i } as React.CSSProperties}
                  autoFocus={g === 0 && i === 0}
                  onClick={() => pick(item)}
                >
                  <span className="add-flyout-icon">
                    <item.icon aria-hidden />
                  </span>
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="add-arc" role="menu" aria-label={t("nav.add")} onClick={closeOnBackdrop}>
          {ARC_ITEMS.map((item, i) => {
            const { cos, sin } = arcPoint(i);
            return (
              <button
                key={item.labelKey}
                type="button"
                role="menuitem"
                aria-label={t(item.labelKey)}
                className={cn("add-arc-item", ARC_PRIMARY.includes(item) && "add-arc-item--primary")}
                // Stagger from the middle out.
                style={{ "--cos": cos, "--sin": sin, "--i": ARC_PRIMARY.includes(item) ? 0 : 1 } as React.CSSProperties}
                onClick={() => pick(item)}
              >
                <span className="add-arc-bubble">
                  <item.icon aria-hidden />
                </span>
                <span className="add-arc-label">{t(item.shortKey ?? item.labelKey)}</span>
              </button>
            );
          })}
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

      <Sheet
        // Stays up until the picked group's members arrive, so the expense sheet replaces it directly.
        open={modal === "subcount" || (modal === "subcountExpense" && !group)}
        onOpenChange={closeModal}
        title={t("addShortcuts.subcountTitle")}
        description={es ? "Elige el grupo del gasto" : "Pick the expense's group"}
      >
        <SheetBody>
          {profileLoading || groupsLoading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : activeGroups.length === 0 ? (
            <FieldGroup hint={t(profile ? "groups.empty" : "addShortcuts.subcountNoProfile")}>
              <ActionRow tone="accent" onClick={() => go("/subcount")}>
                {t("groups.title")}
              </ActionRow>
            </FieldGroup>
          ) : (
            <FieldGroup>
              {activeGroups.map((g) => (
                <ActionRow
                  key={g.id}
                  className="sf-action--group"
                  icon={
                    <span className="group-avatars" aria-hidden>
                      {g.members.slice(0, 3).map((m) => (
                        <ProfileAvatar key={m.user_id} name={m.display_name} url={m.avatar_url} size={28} />
                      ))}
                    </span>
                  }
                  onClick={() => {
                    setGroupId(g.id);
                    setModal("subcountExpense");
                  }}
                >
                  <span className="sf-action-text">
                    {g.name}
                    <small>{`${g.members.length} ${t("groups.membersCount")}`}</small>
                  </span>
                  <ChevronRight className="sf-action-chevron" aria-hidden />
                </ActionRow>
              ))}
            </FieldGroup>
          )}
        </SheetBody>
      </Sheet>

      {group && profile && (
        <SharedExpenseSheet
          key={group.group.id}
          open={modal === "subcountExpense"}
          onOpenChange={closeModal}
          groupId={group.group.id}
          members={group.members}
          meId={profile.user_id}
        />
      )}

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
