import React from "react";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { ui } from "../i18n/ui";
import "../styles/SubscriptionsBody.css"; // We'll need to move styles here or keep them in astro and make them global

export default function SubscriptionsBody(props) {
    return (
        <QueryClientProvider client={queryClient}>
            <SubscriptionsBodyInner {...props} />
        </QueryClientProvider>
    );
}

function SubscriptionsBodyInner({ lang }) {
    const t = (key) => ui[lang]?.[key] || ui['en'][key];
    const { data: subscriptions, isLoading } = useSubscriptions();

    // Helper for formatting currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US', {
            style: 'currency',
            currency: 'EUR',
        }).format(amount);
    };

    const setToNoon = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);

    const isSubActive = (sub) => {
        const current = setToNoon(new Date());
        const start = setToNoon(new Date(sub.start_date));
        if (start > current) return false;
        if (sub.end_date) {
            const end = setToNoon(new Date(sub.end_date));
            if (end < current) return false;
        }
        return true;
    };

    const activeSubs = [];
    const inactiveSubs = [];

    if (subscriptions) {
        subscriptions.forEach(sub => {
            if (isSubActive(sub)) {
                activeSubs.push(sub);
            } else {
                inactiveSubs.push(sub);
            }
        });

        // Order by cost descending like in the original
        activeSubs.sort((a, b) => b.cost - a.cost);
        inactiveSubs.sort((a, b) => b.cost - a.cost);
    }

    const getFrequencyLabel = (freq, val) => {
        if (freq === 'monthly') return val === 1 ? t('sub.monthly') : `${t('sub.every')} ${val} ${t('sub.months')}`;
        if (freq === 'yearly') return val === 1 ? t('sub.yearly') : `${t('sub.every')} ${val} ${t('sub.years')}`;
        if (freq === 'weekly') return val === 1 ? t('sub.weekly') : `${t('sub.every')} ${val} ${t('sub.weeks')}`;
        return freq;
    };

    const calculateTotalMonthly = (subs) => {
        if (!subs) return 0;
        return subs.reduce((acc, sub) => {
            let monthlyCost = sub.cost;
            if (sub.frequency === 'yearly') monthlyCost = sub.cost / 12;
            if (sub.frequency === 'weekly') monthlyCost = sub.cost * 4;
            if (sub.frequency_value > 1) monthlyCost = monthlyCost / sub.frequency_value;
            return acc + monthlyCost;
        }, 0);
    };

    const totalMonthly = calculateTotalMonthly(activeSubs);

    if (isLoading) {
        return <SubscriptionsSkeleton t={t} />;
    }

    return (
        <div className="page-container fade-in">
            {/* Header with Total */}
            <header className="page-header">
                <div>
                    {/* Title is handled by Layout in Astro, but we need the total badge here if we want instant load 
                OR we can keep the title in Astro and just put the badge here. 
                Let's keep the whole header here to avoid layout shifts. 
                Wait, the original `subscriptions.astro` has the headerINSIDE the `active` logic? 
                No, page-header is outside. */}
                    <div className="title-with-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="title-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <h1 className="title">{t('nav.subscriptions')}</h1>
                    </div>
                    <p className="subtitle">
                        <span className="total-badge">
                            {formatCurrency(totalMonthly)}
                            <span className="period">/ {t('sub.month')}</span>
                        </span>
                    </p>
                </div>
                <a href="/newSubscription" className="add-btn" aria-label={t('sub.new')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                    <span className="btn-text">{t('sub.new')}</span>
                </a>
            </header>

            {/* Subscriptions List */}
            <div className="subs-list">
                {activeSubs.length === 0 && inactiveSubs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </div>
                        <p>No subscriptions found</p>
                        <a href="/newSubscription" className="create-first-btn">{t('sub.new')}</a>
                    </div>
                ) : (
                    <>
                        {/* Active Subs */}
                        {activeSubs.length > 0 && (
                            <div className="subs-group">
                                <h2 className="group-title">{t('sub.active')}</h2>
                                {activeSubs.map((sub) => (
                                    <a href={`/subscription/${sub.id}`} className="sub-item active" key={sub.id}>
                                        <div className="sub-icon-wrapper">
                                            <img
                                                src={sub.icon}
                                                alt={sub.service_name}
                                                className="sub-icon"
                                                style={{ viewTransitionName: `icon-${sub.id}` }}
                                            />
                                        </div>
                                        <div className="sub-info">
                                            <h2 className="sub-name" style={{ viewTransitionName: `name-${sub.id}` }}>{sub.service_name}</h2>
                                            <span className="sub-freq">{getFrequencyLabel(sub.frequency, sub.frequency_value)}</span>
                                        </div>
                                        <div className="sub-cost">
                                            <span className="cost-value">{formatCurrency(sub.cost)}</span>
                                            <span className="active-label">{t('sub.active')}</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}

                        {/* Divider if both exist */}
                        {activeSubs.length > 0 && inactiveSubs.length > 0 && (
                            <div className="divider"></div>
                        )}

                        {/* Inactive Subs */}
                        {inactiveSubs.length > 0 && (
                            <div className="subs-group inactive-group">
                                <h2 className="group-title">{t('sub.inactive')}</h2>
                                {inactiveSubs.map((sub) => (
                                    <a href={`/subscription/${sub.id}`} className="sub-item inactive" key={sub.id}>
                                        <div className="sub-icon-wrapper">
                                            <img
                                                src={sub.icon}
                                                alt={sub.service_name}
                                                className="sub-icon"
                                                style={{ viewTransitionName: `icon-${sub.id}` }}
                                            />
                                        </div>
                                        <div className="sub-info">
                                            <h2 className="sub-name" style={{ viewTransitionName: `name-${sub.id}` }}>{sub.service_name}</h2>
                                            <span className="sub-freq">{getFrequencyLabel(sub.frequency, sub.frequency_value)}</span>
                                        </div>
                                        <div className="sub-cost">
                                            <span className="cost-value">{formatCurrency(sub.cost)}</span>
                                            <span className="inactive-label">{t('sub.inactive')}</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function SubscriptionsSkeleton({ t }) {
    return (
        <div className="page-container">
            {/* Header Skeleton */}
            <header className="page-header">
                <div>
                    <div className="title-with-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" className="title-icon placeholder-icon" fill="#333" viewBox="0 0 24 24"><rect width="24" height="24" /></svg>
                        <h1 className="title">{t('nav.subscriptions')}</h1>
                    </div>
                    <div className="skeleton title-skeleton" style={{ width: '120px', height: '32px', marginTop: '8px', borderRadius: '20px' }}></div>
                </div>
                <div className="skeleton-btn" style={{ width: '100px', height: '40px', borderRadius: '8px', background: 'var(--gris-oscuro)' }}></div>
            </header>

            {/* List Skeleton */}
            <div className="subs-list">
                {[1, 2, 3].map(i => (
                    <div className="sub-item skeleton-item" key={i}>
                        <div className="skeleton circle" style={{ width: '48px', height: '48px', borderRadius: '12px' }}></div>
                        <div className="sub-info" style={{ flex: 1 }}>
                            <div className="skeleton text" style={{ width: '60%', height: '20px', marginBottom: '8px' }}></div>
                            <div className="skeleton text" style={{ width: '40%', height: '14px' }}></div>
                        </div>
                        <div className="sub-cost">
                            <div className="skeleton text" style={{ width: '50px', height: '24px' }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
