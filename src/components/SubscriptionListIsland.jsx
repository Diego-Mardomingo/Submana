import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useSubscriptions } from "../hooks/useSubscriptions";
import LoadingSpinner from "./LoadingSpinner";

export default function SubscriptionListIsland({ lang }) {
    return (
        <QueryClientProvider client={queryClient}>
            <SubscriptionList lang={lang} />
        </QueryClientProvider>
    );
}

function SubscriptionList({ lang }) {
    const { data: subscriptions = [], isLoading } = useSubscriptions();

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-US", {
            style: "currency",
            currency: "EUR",
        }).format(amount);
    };

    const calculateTotalMonthly = (subs) => {
        return subs.reduce((total, sub) => {
            const cost = Number(sub.cost) || 0;
            let monthlyEquivalent = 0;

            switch (sub.frequency) {
                case "weekly":
                    const weeksPerMonth = 30 / 7;
                    monthlyEquivalent = cost * weeksPerMonth;
                    break;
                case "monthly":
                    monthlyEquivalent = cost;
                    break;
                case "yearly":
                    monthlyEquivalent = cost / 12;
                    break;
                case "custom":
                    const days = sub.frequency_value || 1;
                    const repetitionsPerMonth = 30 / days;
                    monthlyEquivalent = cost * repetitionsPerMonth;
                    break;
                default:
                    monthlyEquivalent = cost;
            }

            return total + monthlyEquivalent;
        }, 0);
    };

    const isActive = (sub) => {
        if (!sub.end_date) return true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(sub.end_date);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= today;
    };

    const activeSubs = subscriptions.filter(isActive);
    const inactiveSubs = subscriptions.filter((s) => !isActive(s));
    const totalMonthly = calculateTotalMonthly(activeSubs);

    if (isLoading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <>
            {/* Total Monthly Section */}
            <section className="total-section">
                <p className="total-label">
                    {lang === "es" ? "Total mensual estimado" : "Estimated monthly total"}
                </p>
                <h2 className="total-monthly">{formatCurrency(totalMonthly)}</h2>
            </section>

            {/* Active Subscriptions */}
            {activeSubs.length > 0 && (
                <section className="subs-section">
                    <h2 className="section-title">
                        {lang === "es" ? "Activas" : "Active"}
                    </h2>
                    <div className="subs-grid">
                        {activeSubs.map((sub) => (
                            <a
                                key={sub.id}
                                href={`/subscription/${sub.id}`}
                                className="sub-item active"
                                data-astro-prefetch
                            >
                                <div className="sub-content">
                                    <div className="sub-icon">{sub.icon || "📦"}</div>
                                    <div className="sub-details">
                                        <h3 className="sub-name">{sub.service_name}</h3>
                                        <p className="sub-cost-freq">
                                            {formatCurrency(sub.cost)}{" "}
                                            <span className="freq-label">
                                                /{" "}
                                                {sub.frequency === "custom"
                                                    ? `${sub.frequency_value} ${lang === "es" ? "días" : "days"}`
                                                    : lang === "es"
                                                        ? {
                                                            weekly: "semana",
                                                            monthly: "mes",
                                                            yearly: "año",
                                                        }[sub.frequency]
                                                        : sub.frequency}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <span className="arrow">→</span>
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {/* Inactive Subscriptions */}
            {inactiveSubs.length > 0 && (
                <section className="subs-section inactive-section">
                    <h2 className="section-title">
                        {lang === "es" ? "Inactivas" : "Inactive"}
                    </h2>
                    <div className="subs-grid">
                        {inactiveSubs.map((sub) => (
                            <a
                                key={sub.id}
                                href={`/subscription/${sub.id}`}
                                className="sub-item inactive"
                                data-astro-prefetch
                            >
                                <div className="sub-content">
                                    <div className="sub-icon inactive">{sub.icon || "📦"}</div>
                                    <div className="sub-details">
                                        <h3 className="sub-name">{sub.service_name}</h3>
                                        <p className="sub-cost-freq">
                                            {formatCurrency(sub.cost)}{" "}
                                            <span className="freq-label">
                                                /{" "}
                                                {sub.frequency === "custom"
                                                    ? `${sub.frequency_value} ${lang === "es" ? "días" : "days"}`
                                                    : lang === "es"
                                                        ? {
                                                            weekly: "semana",
                                                            monthly: "mes",
                                                            yearly: "año",
                                                        }[sub.frequency]
                                                        : sub.frequency}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <span className="arrow">→</span>
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {subscriptions.length === 0 && (
                <div className="empty-state">
                    <p>
                        {lang === "es"
                            ? "No tienes suscripciones aún"
                            : "No subscriptions yet"}
                    </p>
                </div>
            )}
        </>
    );
}
