"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, type Account } from "@/hooks/useAccounts";

const AccountOption = ({ account }: { account: Account }) => (
  <span className="flex items-center gap-2">
    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: account.color || "var(--accent)" }} />
    {account.name}
  </span>
);

/** Account dropdown with colour dots; `noneLabel` adds an empty choice (value ""). */
export function AccountSelect({ value, onChange, placeholder, noneLabel, popperTop }: {
  value: string;
  onChange: (accountId: string) => void;
  placeholder: string;
  noneLabel?: string;
  /** Opens upwards (forms near the bottom of the screen). */
  popperTop?: boolean;
}) {
  const { data: accounts = [] } = useAccounts();
  const selected = accounts.find((a) => a.id === value);
  return (
    <Select value={value || (noneLabel ? "none" : "")} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className="w-full !h-10">
        <SelectValue placeholder={placeholder}>{selected ? <AccountOption account={selected} /> : (noneLabel ?? placeholder)}</SelectValue>
      </SelectTrigger>
      <SelectContent {...(popperTop && { position: "popper", side: "top" })}>
        {noneLabel && <SelectItem value="none">{noneLabel}</SelectItem>}
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <AccountOption account={account} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
