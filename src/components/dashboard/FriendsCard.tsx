"use client";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useSharedBalances } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useProfile } from "@/hooks/useProfile";
import { useTranslations } from "@/lib/i18n/utils";
import { fromCents } from "@/lib/shared/splits";
import { CardHead, money, SeeAll, Stat } from "./shared";

/** "Friends owe you / You owe" from shared expenses; hidden until there is something to settle. */
export default function FriendsCard() {
  const t = useTranslations(useLang());
  const { data: profile } = useProfile();
  const { data } = useSharedBalances(!!profile);
  if (!data || (data.owed_to_me_cents === 0 && data.i_owe_cents === 0)) return null;

  return (
    <section className="dash-section" aria-label={t("groups.balances")}>
      <div className="lp-card dash-card">
        <CardHead title={t("groups.balances")}>
          <SeeAll href="/subcount" label={t("groups.title")} />
        </CardHead>
        <div className="lp-stats dash-summary-stats">
          <Stat label={t("groups.friendsOweYou")} value={money(fromCents(data.owed_to_me_cents))} className={data.owed_to_me_cents > 0 ? "is-income" : "is-muted"} />
          <Stat label={t("groups.youOweTotal")} value={money(fromCents(data.i_owe_cents))} className={data.i_owe_cents > 0 ? undefined : "is-muted"} />
        </div>
        <div className="group-avatars dash-friends-avatars" aria-hidden>
          {data.friends.slice(0, 5).map((f) => (
            <ProfileAvatar key={f.profile.user_id} name={f.profile.display_name} url={f.profile.avatar_url} size={26} />
          ))}
        </div>
      </div>
    </section>
  );
}
