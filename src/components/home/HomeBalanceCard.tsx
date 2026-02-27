"use client";

import { useAccounts } from "@/hooks/useAccounts";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Spinner } from "@/components/ui/spinner";
import styles from "./HomeBalanceCard.module.css";

export default function HomeBalanceCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: accounts = [], isLoading, isFetching } = useAccounts();

  const totalBalance = accounts.reduce(
    (sum: number, acc: { id: string; balance?: number; color?: string }) =>
      sum + Number(acc.balance ?? 0),
    0
  );

  const isInitialLoading = isLoading && accounts.length === 0;
  const isRefreshing = isFetching && !isInitialLoading;

  if (isInitialLoading) {
    return (
      <Card className="home-card">
        <CardContent className={styles.wrapper}>
          <div className={styles.top}>
            <p className={styles.label}>{t("home.totalBalance")}</p>
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="home-card">
      <CardContent className={styles.wrapper} style={{ opacity: isRefreshing ? 0.7 : 1, transition: "opacity 0.2s" }}>
        <div className={styles.top}>
          <p className={styles.label}>{t("home.totalBalance")}</p>
          <p className={styles.total}>{formatCurrency(totalBalance)}</p>
        </div>
        {accounts.length > 0 && (
          <>
            <hr className={styles.divider} />
            <div className={styles.accounts}>
              {accounts.map((acc: { id: string; name: string; balance?: number; color?: string }) => (
                <div key={acc.id} className={styles.account}>
                  <div className={styles.accountLabelRow}>
                    <span
                      className={styles.accountDot}
                      style={{
                        backgroundColor: acc.color ?? "var(--accent)",
                      }}
                      aria-hidden
                    />
                    <p className={styles.accountLabel}>
                      {acc.name.toUpperCase()}
                    </p>
                  </div>
                  <p className={styles.accountValue}>
                    {formatCurrency(Number(acc.balance ?? 0))}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
