"use client";

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAccounts } from "@/hooks/useAccounts";
import { useCalendarAccountFilter } from "@/contexts/CalendarFilterContext";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
  color?: string;
}

export default function CalendarAccountFilter() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: accounts = [] } = useAccounts();
  const { hiddenAccountIds, hiddenCount, toggleAccount, showAll } =
    useCalendarAccountFilter();

  if (accounts.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="calendar-filter-btn relative shrink-0"
          aria-label={t("calendar.filter_accounts")}
        >
          <Filter className="size-4" strokeWidth={2.5} />
          {hiddenCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-primary">
              {hiddenCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">{t("calendar.filter_accounts")}</p>
          <p className="text-xs text-muted-foreground">
            {hiddenCount === 0
              ? t("calendar.all_accounts_visible")
              : t("calendar.hidden_accounts").replace(
                  "{count}",
                  String(hiddenCount)
                )}
          </p>
        </div>
        <div className="max-h-[200px] overflow-y-auto py-1">
          {(accounts as Account[]).map((account) => {
            const isHidden = hiddenAccountIds.has(account.id);
            return (
              <label
                key={account.id}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  isHidden && "opacity-50"
                )}
              >
                <Checkbox
                  checked={!isHidden}
                  onCheckedChange={() => toggleAccount(account.id)}
                />
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: account.color || "#888" }}
                />
                <span className="truncate">{account.name}</span>
              </label>
            );
          })}
        </div>
        {hiddenCount > 0 && (
          <div className="border-t px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={showAll}
              className="h-7 w-full text-xs"
            >
              {t("calendar.show_all")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
