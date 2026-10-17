"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Landmark, Link2, RefreshCw, Unplug } from "lucide-react";
import { AccountSelect } from "@/components/AccountSelect";
import { ActionRow, DeleteAction, FieldGroup, FieldRow, FieldStack, FormError, InfoRow, Segmented, SheetButton } from "@/components/SheetFields";
import { DatePicker } from "@/components/ui/date-picker";
import { Sheet, SheetBody, SheetFooter, useSheetPayload } from "@/components/ui/sheet";
import type { Account } from "@/hooks/useAccounts";
import {
  useAccountBankLink,
  useBankConnections,
  useConnectBank,
  useDisconnectBank,
  useSaveBankLinks,
  useSyncBank,
  type BankConnectionView,
  type BankLinkView,
  type SyncMode,
} from "@/hooks/useBanking";
import { useLang } from "@/hooks/useLang";
import { useTransactions } from "@/hooks/useTransactions";
import { suggestSyncFrom } from "@/lib/banking/dates";
import { BANK_ASPSPS, isConnectableProvider } from "@/lib/banking/types";
import { calendarDayInAppTimeZone, parseDateString, toDateString } from "@/lib/date";
import { localeOf } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";

const todayInApp = () => calendarDayInAppTimeZone(new Date().toISOString());

/** "Revolut · EUR · ···· 1234": how a bank account is told apart (the bank's own name may be the holder's). */
export const bankAccountLabel = (bankName: string, link: Pick<BankLinkView, "currency" | "iban_last4">) =>
  [bankName, link.currency, link.iban_last4 && `···· ${link.iban_last4}`].filter(Boolean).join(" · ");

const isExpired = (connection: Pick<BankConnectionView, "status" | "valid_until">) =>
  connection.status === "expired" || (!!connection.valid_until && Date.parse(connection.valid_until) <= Date.now());

/** Connections of the account's bank that still have bank accounts nobody linked. */
function useUnlinkedConnection(account: Account) {
  const { data } = useBankConnections();
  const bankName = isConnectableProvider(account.bank_provider) ? BANK_ASPSPS[account.bank_provider].name : null;
  return (data ?? []).find((c) => c.aspsp_name === bankName && !isExpired(c) && c.links.some((l) => !l.account_id)) ?? null;
}

/** Latest statement line (booked_at) per account, to suggest where the sync should start. */
function useLatestBookedByAccount() {
  const { data: transactions = [] } = useTransactions();
  return useMemo(() => {
    const latest = new Map<string, string>();
    for (const tx of transactions) {
      if (!tx.account_id || !tx.booked_at) continue;
      const current = latest.get(tx.account_id);
      if (!current || tx.booked_at > current) latest.set(tx.account_id, tx.booked_at);
    }
    return latest;
  }, [transactions]);
}

/**
 * Runs a sync with one toast going loading → result, plus a warning when movements need a review.
 * Errors name the cause; an expired permission offers to reconnect.
 */
export function useRunBankSync() {
  const t = useTranslations(useLang());
  const sync = useSyncBank();
  const connect = useConnectBank();
  return async (connectionId: string, opts: { accountId?: string; title?: string } = {}) => {
    const id = toast.loading(t("bank.sync.loading"));
    try {
      const result = await sync.mutateAsync(connectionId);
      const news = result.imported > 0 ? interpolate(t("bank.sync.success"), { count: result.imported }) : t("bank.sync.successNone");
      toast.success(opts.title ?? news, { id, description: opts.title ? news : undefined });
      if (result.review > 0) {
        toast.warning(interpolate(t(result.review === 1 ? "bank.sync.reviewOne" : "bank.sync.review"), { count: result.review }), { description: t("bank.sync.reviewDesc") });
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "bank_expired") {
        const accountId = opts.accountId;
        toast.error(t("bank.sync.expired"), {
          id,
          description: t("bank.sync.expiredDesc"),
          ...(accountId && { action: { label: t("bank.reconnect"), onClick: () => connect.mutate(accountId) } }),
        });
      } else {
        toast.error(t("bank.sync.error"), { id, description: t("bank.sync.errorDesc") });
      }
    }
  };
}

/** Row of the account page: connect the bank, or see how the connection is doing. */
export function BankConnectionRow({ account, onOpen }: { account: Account; onOpen: () => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { connection, link } = useAccountBankLink(account.id);
  const unlinked = useUnlinkedConnection(account);

  let title = t("bank.connect");
  let meta = t("bank.connectMeta");
  let warn = false;
  if (connection && link) {
    title = t("bank.connected");
    if (isExpired(connection)) {
      meta = t("bank.expiredMeta");
      warn = true;
    } else {
      const synced = link.last_synced_at ?? connection.last_synced_at;
      meta = [
        bankAccountLabel(connection.aspsp_name, link),
        synced ? interpolate(t("bank.syncedAt"), { date: formatWhen(synced, lang) }) : t("bank.notSynced"),
      ].join(" · ");
    }
  } else if (unlinked) {
    meta = t("bank.unlinkedMeta");
  }

  return (
    <button type="button" className="lp-row" onClick={onOpen}>
      <span className="lp-icon ad-action-icon">
        <Landmark className="size-[18px]" />
      </span>
      <span className="lp-main">
        <span className="lp-title">
          <span>{title}</span>
        </span>
        <span className="lp-meta" style={warn ? { color: "var(--warning)" } : undefined}>
          {meta}
        </span>
      </span>
      <ChevronRight className="lp-chevron size-4" />
    </button>
  );
}

const formatWhen = (iso: string, lang: "es" | "en") =>
  new Date(iso).toLocaleString(localeOf(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");

const formatDay = (iso: string, lang: "es" | "en") => new Date(iso).toLocaleDateString(localeOf(lang), { day: "numeric", month: "long", year: "numeric" });

/** Connect, or manage the connection that feeds this account (what to sync, from when, sync now, reconnect, disconnect). */
export function BankSheet({ open, onOpenChange, account, onLink }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
  /** Opens the sheet to link the bank accounts of a connection. */
  onLink: (connectionId: string) => void;
}) {
  const t = useTranslations(useLang());
  const { connection, link } = useAccountBankLink(account.id);
  const unlinked = useUnlinkedConnection(account);
  const bankName = isConnectableProvider(account.bank_provider) ? BANK_ASPSPS[account.bank_provider].name : "";
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("bank.sheetTitle")}>
      {connection && link ? (
        <ManageConnection key={link.id} account={account} connection={connection} link={link} onDone={() => onOpenChange(false)} />
      ) : (
        <ConnectIntro
          account={account}
          bankName={bankName}
          unlinked={unlinked}
          onLink={(id) => {
            onOpenChange(false);
            onLink(id);
          }}
        />
      )}
    </Sheet>
  );
}

function ConnectIntro({ account, bankName, unlinked, onLink }: { account: Account; bankName: string; unlinked: BankConnectionView | null; onLink: (connectionId: string) => void }) {
  const t = useTranslations(useLang());
  const connect = useConnectBank();
  const [error, setError] = useState("");
  return (
    <>
      <SheetBody>
        <p className="sf-hint" style={{ margin: 0 }}>
          {interpolate(t("bank.intro"), { bank: bankName })}
        </p>
        {unlinked && (
          <FieldGroup>
            <ActionRow tone="accent" icon={<Link2 aria-hidden />} onClick={() => onLink(unlinked.id)}>
              {t("bank.unlinkedMeta")}
            </ActionRow>
          </FieldGroup>
        )}
      </SheetBody>
      <SheetFooter>
        <FormError>{error}</FormError>
        <SheetButton
          type="button"
          pending={connect.isPending || connect.isSuccess}
          onClick={() => {
            setError("");
            connect.mutate(account.id, { onError: () => setError(`${t("bank.connect.error")}. ${t("bank.connect.errorDesc")}`) });
          }}
        >
          {interpolate(t("bank.connectWith"), { bank: bankName })}
        </SheetButton>
      </SheetFooter>
    </>
  );
}

function ManageConnection({ account, connection, link, onDone }: { account: Account; connection: BankConnectionView; link: BankLinkView; onDone: () => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const saveLinks = useSaveBankLinks();
  const disconnect = useDisconnectBank();
  const connect = useConnectBank();
  const runSync = useRunBankSync();
  const latestBooked = useLatestBookedByAccount();
  const [mode, setMode] = useState<SyncMode>(link.sync_mode);
  // Balance-only links may have no start day yet: switching to movements proposes one.
  const [syncFrom, setSyncFrom] = useState<string>(() => link.sync_from ?? suggestSyncFrom(latestBooked.get(account.id), todayInApp()));
  const [error, setError] = useState("");
  const expired = isExpired(connection);
  const dirty = mode !== link.sync_mode || (mode === "full" && syncFrom !== link.sync_from);

  const save = async () => {
    setError("");
    try {
      await saveLinks.mutateAsync([{ id: link.id, account_id: account.id, sync_mode: mode, sync_from: mode === "full" ? syncFrom : link.sync_from }]);
      toast.success(t("bank.saved"));
    } catch {
      setError(t("bank.sync.errorDesc"));
    }
  };

  return (
    <>
      <SheetBody>
        <FieldGroup>
          <InfoRow label={t("bank.account")}>{bankAccountLabel(connection.aspsp_name, link)}</InfoRow>
          <InfoRow label={t("bank.lastSync")}>{link.last_synced_at ? formatWhen(link.last_synced_at, lang) : t("bank.never")}</InfoRow>
          {connection.valid_until && (
            <InfoRow label={t("bank.validUntil")}>
              <span style={expired ? { color: "var(--warning)" } : undefined}>{formatDay(connection.valid_until, lang)}</span>
            </InfoRow>
          )}
        </FieldGroup>

        <FieldGroup title={t("bank.mode")} hint={mode === "balance" ? t("bank.mode.balanceHint") : t("bank.syncFromHint")}>
          <FieldStack>
            <Segmented
              label={t("bank.mode")}
              value={mode}
              onChange={setMode}
              options={[
                { value: "full", label: t("bank.mode.full") },
                { value: "balance", label: t("bank.mode.balance") },
              ]}
            />
          </FieldStack>
          {mode === "full" && (
            <FieldRow label={t("bank.syncFrom")}>
              <DatePicker value={parseDateString(syncFrom)} onChange={(d) => d && setSyncFrom(toDateString(d))} placeholder={t("bank.syncFrom")} lang={lang} className="sf-picker" />
            </FieldRow>
          )}
        </FieldGroup>

        <FieldGroup>
          {!expired && (
            <ActionRow
              icon={<RefreshCw aria-hidden />}
              disabled={dirty}
              onClick={() => {
                onDone();
                void runSync(connection.id, { accountId: account.id });
              }}
            >
              {t("bank.syncNow")}
            </ActionRow>
          )}
          <ActionRow tone={expired ? "accent" : undefined} icon={<Link2 aria-hidden />} disabled={connect.isPending || connect.isSuccess} onClick={() => connect.mutate(account.id)}>
            {t("bank.reconnect")}
          </ActionRow>
          <DeleteAction
            label={t("bank.disconnect")}
            icon={<Unplug aria-hidden />}
            confirmTitle={interpolate(t("bank.disconnectTitle"), { bank: connection.aspsp_name })}
            confirmText={t("bank.disconnectText")}
            pending={disconnect.isPending}
            onConfirm={async () => {
              try {
                await disconnect.mutateAsync(connection.id);
                toast(t("bank.disconnected"), { icon: <Unplug className="size-4" /> });
                onDone();
              } catch {
                setError(t("bank.sync.errorDesc"));
              }
            }}
          />
        </FieldGroup>
      </SheetBody>
      {dirty && (
        <SheetFooter>
          <FormError>{error}</FormError>
          <SheetButton type="button" pending={saveLinks.isPending} onClick={save}>
            {t("bank.save")}
          </SheetButton>
        </SheetFooter>
      )}
      {!dirty && error && (
        <SheetFooter>
          <FormError>{error}</FormError>
        </SheetFooter>
      )}
    </>
  );
}

type Draft = { account_id: string | null; sync_mode: SyncMode; sync_from: string | null; fromEdited: boolean };

/** After the bank: pick the Submana account each authorised bank account feeds, then sync. */
export function BankLinkSheet({ open, onOpenChange, connectionId, originAccountId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string | null;
  originAccountId: string;
}) {
  const t = useTranslations(useLang());
  const shownId = useSheetPayload(open, connectionId);
  const { data: connections, isLoading } = useBankConnections();
  const connection = connections?.find((c) => c.id === shownId) ?? null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("bank.link.title")}>
      {connection ? (
        <LinkAccountsForm key={connection.id} connection={connection} originAccountId={originAccountId} onDone={() => onOpenChange(false)} />
      ) : (
        <SheetBody>
          <p className="sf-hint">{isLoading ? t("bank.sync.loading") : t("bank.link.empty")}</p>
        </SheetBody>
      )}
    </Sheet>
  );
}

function LinkAccountsForm({ connection, originAccountId, onDone }: { connection: BankConnectionView; originAccountId: string; onDone: () => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: connections = [] } = useBankConnections();
  const latestBooked = useLatestBookedByAccount();
  const saveLinks = useSaveBankLinks();
  const runSync = useRunBankSync();
  const [error, setError] = useState("");
  const today = todayInApp();

  // Accounts already fed by another connection can't take a second bank account.
  const takenElsewhere = useMemo(
    () => new Set(connections.filter((c) => c.id !== connection.id).flatMap((c) => c.links.map((l) => l.account_id).filter(Boolean))),
    [connections, connection.id]
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const single = connection.links.length === 1 && !connection.links[0].account_id && !takenElsewhere.has(originAccountId);
    return Object.fromEntries(
      connection.links.map((link) => {
        const accountId = link.account_id ?? (single ? originAccountId : null);
        return [link.id, { account_id: accountId, sync_mode: link.sync_mode, sync_from: link.sync_from ?? (accountId ? suggestSyncFrom(latestBooked.get(accountId), today) : null), fromEdited: !!link.sync_from }];
      })
    );
  });

  const update = (linkId: string, patch: Partial<Draft>) =>
    setDrafts((current) => {
      const next = { ...current[linkId], ...patch };
      // A new account gets its own suggested start, unless the user already picked a day.
      if ("account_id" in patch && !next.fromEdited) next.sync_from = next.account_id ? suggestSyncFrom(latestBooked.get(next.account_id), today) : null;
      return { ...current, [linkId]: next };
    });

  const chosen = Object.values(drafts).map((d) => d.account_id).filter(Boolean);
  const duplicated = chosen.length !== new Set(chosen).size || chosen.some((id) => takenElsewhere.has(id));

  const save = async () => {
    setError("");
    if (duplicated) return setError(t("bank.link.taken"));
    try {
      await saveLinks.mutateAsync(connection.links.map((link) => ({ id: link.id, account_id: drafts[link.id].account_id, sync_mode: drafts[link.id].sync_mode, sync_from: drafts[link.id].sync_from })));
    } catch (err) {
      return setError(err instanceof Error && err.message === "account_taken" ? t("bank.link.taken") : t("bank.sync.errorDesc"));
    }
    onDone();
    if (chosen.length > 0) void runSync(connection.id, { accountId: originAccountId, title: t("bank.connected") });
  };

  return (
    <>
      <SheetBody>
        <p className="sf-hint" style={{ margin: 0 }}>
          {t("bank.link.intro")}
        </p>
        {connection.links.length === 0 && <p className="sf-hint">{t("bank.link.empty")}</p>}
        {connection.links.map((link) => {
          const draft = drafts[link.id];
          return (
            <FieldGroup key={link.id} title={bankAccountLabel(connection.aspsp_name, link)} hint={draft.account_id ? (draft.sync_mode === "balance" ? t("bank.mode.balanceHint") : t("bank.syncFromHint")) : undefined}>
              <FieldStack>
                <AccountSelect value={draft.account_id ?? ""} onChange={(id) => update(link.id, { account_id: id || null })} placeholder={t("bank.link.none")} noneLabel={t("bank.link.none")} />
              </FieldStack>
              {draft.account_id && (
                <>
                  <FieldStack label={t("bank.mode")}>
                    <Segmented
                      label={t("bank.mode")}
                      value={draft.sync_mode}
                      onChange={(sync_mode) => update(link.id, { sync_mode })}
                      options={[
                        { value: "full", label: t("bank.mode.full") },
                        { value: "balance", label: t("bank.mode.balance") },
                      ]}
                    />
                  </FieldStack>
                  {draft.sync_mode === "full" && (
                    <FieldRow label={t("bank.syncFrom")}>
                      <DatePicker
                        value={draft.sync_from ? parseDateString(draft.sync_from) : undefined}
                        onChange={(d) => d && update(link.id, { sync_from: toDateString(d), fromEdited: true })}
                        placeholder={t("bank.syncFrom")}
                        lang={lang}
                        className="sf-picker"
                      />
                    </FieldRow>
                  )}
                </>
              )}
            </FieldGroup>
          );
        })}
      </SheetBody>
      <SheetFooter>
        <FormError>{error}</FormError>
        <SheetButton type="button" pending={saveLinks.isPending} disabled={connection.links.length === 0} onClick={save}>
          {t("bank.link.save")}
        </SheetButton>
      </SheetFooter>
    </>
  );
}

/**
 * Back from the bank (`?bank=…` on the account page): toasts the outcome, opens the link sheet when
 * accounts must be chosen, syncs a reconnection right away, and cleans the URL. `?bank=settings` (a
 * notification's link) opens the connection settings.
 */
export function useBankReturn(accountId: string, openLinkSheet: (connectionId: string) => void, openSettings: () => void) {
  const t = useTranslations(useLang());
  const router = useRouter();
  const searchParams = useSearchParams();
  const runSync = useRunBankSync();
  const handled = useRef<string | null>(null);
  const outcome = searchParams.get("bank");
  const connectionId = searchParams.get("connection");

  useEffect(() => {
    if (!outcome || handled.current === `${outcome}:${connectionId}`) return;
    handled.current = `${outcome}:${connectionId}`;
    if (outcome === "settings") openSettings();
    else if (outcome === "link" && connectionId) openLinkSheet(connectionId);
    else if (outcome === "connected" && connectionId) void runSync(connectionId, { accountId, title: t("bank.connected") });
    else if (outcome === "cancelled") toast.info(t("bank.connect.cancelled"));
    else if (outcome === "error") toast.error(t("bank.connect.error"), { description: t("bank.connect.errorDesc") });
    router.replace(`/account/${accountId}`, { scroll: false });
  }, [outcome, connectionId, accountId, openLinkSheet, openSettings, runSync, router, t]);
}
