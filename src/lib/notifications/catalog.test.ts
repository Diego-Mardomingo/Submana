import { describe, expect, it } from "vitest";
import { ui } from "@/lib/i18n/ui";
import type { Lang, UIKey } from "@/lib/i18n/ui";
import { getTranslations } from "@/lib/i18n/utils";
import {
  isToggleEnabled,
  mergeAggregate,
  NOTIFICATION_TOGGLES,
  NOTIFICATION_TYPES,
  NOTIFICATIONS,
  notificationUrl,
  renderNotification,
  setToggleEnabled,
  type JointTransactionParams,
  type NotificationParams,
  type NotificationType,
} from "./catalog";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const shared = { groupId: ID, groupName: "Piso", expenseId: ID2, title: "Cena", actorName: "Luis", total: 40, share: 12.5 };

/** One representative payload per type. */
const SAMPLES: { [T in NotificationType]: NotificationParams[T] } = {
  "subscription.renewal": { subscriptionId: ID, name: "Netflix", amount: 12.99, date: "2026-10-12", daysBefore: 3 },
  "subscription.ending": { subscriptionId: ID, name: "Gym", date: "2026-10-30", lastCharge: true },
  "budget.threshold": { budgetId: ID, name: "Comida", threshold: 80, month: "2026-10", spent: 240, limit: 300 },
  "summary.monthly": { month: "2026-09", spent: 1234.5, income: 2000, savings: 765.5, overBudgets: 2, topCategory: "Comida" },
  "import.reminder": { month: "2026-09" },
  "shared.expense_added": shared,
  "shared.expense_updated": shared,
  "shared.expense_deleted": shared,
  "shared.settlement": { groupId: ID, groupName: "Piso", actorName: "Luis", amount: 20, payer: "actor" },
  "shared.member_added": { groupId: ID, groupName: "Piso", actorName: "Luis" },
  "shared.member_removed": { groupName: "Piso", actorName: "Luis" },
  "shared.group_deleted": { groupName: "Piso", actorName: "Luis" },
  "friend.request_received": { actorName: "Luis", handle: "luis" },
  "friend.request_accepted": { actorName: "Luis", handle: "luis" },
  "joint.invite_received": { accountId: ID, accountName: "Cuenta común", actorName: "Luis" },
  "joint.invite_answered": { accountId: ID, accountName: "Cuenta común", actorName: "Luis", accepted: true },
  "joint.member_left": { accountId: ID, accountName: "Cuenta común", actorName: "Luis", removed: false },
  "joint.transaction": { accountId: ID, accountName: "Cuenta común", actorName: "Luis", count: 1, kind: "added", items: ["Super"], txId: ID2, amount: 23.4 },
  "joint.import": { accountId: ID, accountName: "Cuenta común", actorName: "Ana", count: 34 },
  "joint.account_deleted": { accountName: "Cuenta común", actorName: "Luis" },
  "system.push_test": {},
};

const LANGS: Lang[] = ["en", "es"];

describe("catalog", () => {
  it("lists every type from the plan and none for debt reminders", () => {
    expect(NOTIFICATION_TYPES).toHaveLength(21);
    expect(NOTIFICATION_TYPES.some((type) => type.includes("debt"))).toBe(false);
    expect(Object.keys(SAMPLES).sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  it.each(NOTIFICATION_TYPES)("%s has title and body texts in both languages and a valid link", (type) => {
    for (const lang of LANGS) {
      for (const suffix of ["title", "body"]) {
        const key = `notif.${type}.${suffix}`;
        expect(Object.hasOwn(ui[lang], key), `${lang} ${key}`).toBe(true);
      }
    }
    const url = notificationUrl(type, SAMPLES[type] as never);
    expect(url.startsWith("/")).toBe(true);
    expect(url).not.toContain("undefined");
  });

  it("builds the deep links of the plan", () => {
    expect(notificationUrl("subscription.renewal", SAMPLES["subscription.renewal"])).toBe(`/subscriptions?sub=${ID}`);
    expect(notificationUrl("shared.expense_added", shared)).toBe(`/subcount/${ID}?expense=${ID2}`);
    expect(notificationUrl("shared.expense_deleted", shared)).toBe(`/subcount/${ID}`);
    expect(notificationUrl("joint.transaction", SAMPLES["joint.transaction"])).toBe(`/account/${ID}?tx=${ID2}`);
    expect(notificationUrl("joint.transaction", { ...SAMPLES["joint.transaction"], count: 4, txId: undefined })).toBe(`/account/${ID}`);
    expect(notificationUrl("budget.threshold", SAMPLES["budget.threshold"])).toBe("/budgets?month=2026-10");
    expect(notificationUrl("summary.monthly", SAMPLES["summary.monthly"])).toBe("/dashboard?month=2026-09");
    expect(notificationUrl("friend.request_received", SAMPLES["friend.request_received"])).toBe("/friends");
    expect(notificationUrl("shared.member_removed", SAMPLES["shared.member_removed"])).toBe("/subcount");
    expect(notificationUrl("joint.account_deleted", SAMPLES["joint.account_deleted"])).toBe("/accounts");
  });

  it("only joint transactions aggregate, with a 5 minute window keyed by actor and account", () => {
    const aggregating = NOTIFICATION_TYPES.filter((type) => NOTIFICATIONS[type].aggregate);
    expect(aggregating).toEqual(["joint.transaction"]);
    const { aggregate } = NOTIFICATIONS["joint.transaction"];
    expect(aggregate?.windowMs).toBe(5 * 60 * 1000);
    expect(aggregate?.key({ actorId: "a", params: SAMPLES["joint.transaction"] })).toBe(`a:${ID}`);
  });

  it("only the budget threshold and the test notification skip the push or the inbox", () => {
    expect(NOTIFICATION_TYPES.filter((type) => !NOTIFICATIONS[type].push)).toEqual(["budget.threshold"]);
    expect(NOTIFICATION_TYPES.filter((type) => !NOTIFICATIONS[type].inbox)).toEqual(["system.push_test"]);
  });

  it("covers every user-facing type with exactly one toggle, with texts", () => {
    const covered = NOTIFICATION_TOGGLES.flatMap((toggle) => toggle.types);
    const expected = NOTIFICATION_TYPES.filter((type) => NOTIFICATIONS[type].family !== "system");
    expect([...covered].sort()).toEqual([...expected].sort());
    for (const toggle of NOTIFICATION_TOGGLES) {
      for (const lang of LANGS) {
        expect(Object.hasOwn(ui[lang], toggle.labelKey), `${lang} ${toggle.labelKey}`).toBe(true);
        expect(Object.hasOwn(ui[lang], toggle.descKey), `${lang} ${toggle.descKey}`).toBe(true);
      }
      expect(toggle.types.every((type) => NOTIFICATIONS[type].family === toggle.family)).toBe(true);
    }
  });

  it("switches a multi-type toggle on and off through disabled_types", () => {
    const toggle = NOTIFICATION_TOGGLES.find((t) => t.id === "shared.expenses")!;
    const off = setToggleEnabled(toggle, ["friend.request_received"], false);
    expect(off).toEqual(["friend.request_received", "shared.expense_added", "shared.expense_updated", "shared.expense_deleted"]);
    expect(isToggleEnabled(toggle, off)).toBe(false);
    expect(setToggleEnabled(toggle, off, true)).toEqual(["friend.request_received"]);
    expect(isToggleEnabled(toggle, [])).toBe(true);
  });
});

describe("renderNotification", () => {
  it.each(NOTIFICATION_TYPES)("%s renders clean text in both languages, with and without amounts", (type) => {
    for (const lang of LANGS) {
      const t = getTranslations(lang);
      for (const hideAmounts of [false, true]) {
        const { title, body, bodyParts } = renderNotification({ type, params: SAMPLES[type] }, t, lang, { hideAmounts });
        const label = `${lang} ${hideAmounts ? "hidden" : "shown"}`;
        expect(title.trim(), label).not.toBe("");
        expect(`${title}${body}`, label).not.toMatch(/[{}]|undefined|NaN/);
        expect(body, label).not.toMatch(/(^|\s)·\s*(·|$)|^\s*·/);
        expect(bodyParts.map((part) => part.text).join(""), label).toBe(body);
        if (hideAmounts) expect(`${title} ${body}`, label).not.toMatch(/€/);
        if (hideAmounts) expect(bodyParts.some((part) => part.amount), label).toBe(false);
      }
    }
  });

  it("formats amounts and dates for the language, and flags amounts as body parts", () => {
    const params = SAMPLES["subscription.renewal"];
    const es = renderNotification({ type: "subscription.renewal", params }, getTranslations("es"), "es");
    expect(es.title).toBe("Netflix se renueva en 3 días");
    expect(es.body).toBe("Cobro de 12,99 € el 12 oct");
    expect(es.bodyParts.filter((part) => part.amount).map((part) => part.text)).toEqual(["12,99 €"]);
    const en = renderNotification({ type: "subscription.renewal", params }, getTranslations("en"), "en");
    expect(en.title).toBe("Netflix renews in 3 days");
    expect(en.body).toContain("Oct 12");
  });

  it("removes amounts cleanly with hideAmounts", () => {
    const t = getTranslations("es");
    const summary = SAMPLES["summary.monthly"];
    const shown = renderNotification({ type: "summary.monthly", params: summary }, t, "es");
    expect(shown.title).toBe("Tu resumen de septiembre");
    expect(shown.body).toBe("Gastos 1.234,50 € · Ingresos 2.000,00 € · 2 presupuestos superados · Más gasto: Comida");
    const hidden = renderNotification({ type: "summary.monthly", params: summary }, t, "es", { hideAmounts: true });
    expect(hidden.body).toBe("2 presupuestos superados · Más gasto: Comida");
    const bare = renderNotification({ type: "summary.monthly", params: { ...summary, overBudgets: 0, topCategory: null } }, t, "es", { hideAmounts: true });
    expect(bare.body).toBe("Mira cómo fue septiembre");

    const expense = renderNotification({ type: "shared.expense_added", params: shared }, t, "es", { hideAmounts: true });
    expect(expense.body).toBe("Cena");
    expect(renderNotification({ type: "shared.expense_added", params: shared }, t, "es").body).toBe("Cena · Tu parte 12,50 €");
    expect(renderNotification({ type: "shared.expense_added", params: { ...shared, share: 0 } }, t, "es").body).toBe("Cena · Total 40,00 €");
  });

  it("renders aggregated joint transactions with their count", () => {
    const params: JointTransactionParams = { accountId: ID, accountName: "Cuenta común", actorName: "Luis", count: 4, kind: "added", items: ["Super", "Gasolina"] };
    expect(renderNotification({ type: "joint.transaction", params }, getTranslations("es"), "es").title).toBe("Luis añadió 4 movimientos en Cuenta común");
    expect(renderNotification({ type: "joint.transaction", params }, getTranslations("en"), "en").title).toBe("Luis added 4 transactions in Cuenta común");
    expect(renderNotification({ type: "joint.transaction", params }, getTranslations("es"), "es").body).toBe("Super, Gasolina");
    expect(renderNotification({ type: "joint.transaction", params: { ...params, kind: "changed" } }, getTranslations("es"), "es").title).toBe("Luis hizo 4 cambios en Cuenta común");
  });

  it("uses singular and plural texts and falls back for a missing actor", () => {
    const t = getTranslations("es");
    expect(renderNotification({ type: "joint.import", params: { ...SAMPLES["joint.import"], count: 1 } }, t, "es").title).toBe("Ana importó 1 movimiento");
    expect(renderNotification({ type: "joint.import", params: SAMPLES["joint.import"] }, t, "es").title).toBe("Ana importó 34 movimientos");
    expect(renderNotification({ type: "friend.request_accepted", params: {} }, t, "es").title).toBe("Alguien aceptó tu solicitud");
  });

  it("renders a generic title for unknown types", () => {
    const rendered = renderNotification({ type: "old.removed", params: {} }, getTranslations("es"), "es");
    expect(rendered).toEqual({ title: "Nueva notificación", body: "", bodyParts: [] });
  });

  it("only uses keys that exist in both languages", () => {
    const missing: string[] = [];
    for (const lang of LANGS) {
      const t = ((key: UIKey) => {
        if (!Object.hasOwn(ui[lang], key)) missing.push(`${lang} ${key}`);
        return key;
      }) as (key: UIKey) => string;
      for (const type of NOTIFICATION_TYPES) renderNotification({ type, params: SAMPLES[type] }, t, lang);
    }
    expect(missing).toEqual([]);
  });
});

describe("mergeAggregate", () => {
  const base: JointTransactionParams = { accountId: ID, accountName: "Cuenta común", actorName: "Luis", count: 1, kind: "added", items: ["Super"], txId: ID2, amount: 10 };

  it("adds the counts, keeps up to 3 labels and drops single-movement details", () => {
    const merged = mergeAggregate(base, { ...base, items: ["Gasolina"], txId: "x", amount: 5 });
    expect(merged).toMatchObject({ count: 2, kind: "added", items: ["Super", "Gasolina"], accountId: ID });
    expect(merged.txId).toBeUndefined();
    expect(merged.amount).toBeUndefined();
    const more = [1, 2, 3].reduce((acc, n) => mergeAggregate(acc, { ...base, items: [`Item ${n}`] }), merged);
    expect(more.count).toBe(5);
    expect(more.items).toEqual(["Super", "Gasolina", "Item 1"]);
  });

  it("becomes a generic change when kinds differ and counts batches", () => {
    expect(mergeAggregate(base, { ...base, kind: "deleted" }).kind).toBe("changed");
    expect(mergeAggregate({ ...base, count: 3 }, { ...base, count: 2 }).count).toBe(5);
    expect(mergeAggregate({ ...base, kind: "changed" }, { ...base, kind: "changed" }).kind).toBe("changed");
  });
});
