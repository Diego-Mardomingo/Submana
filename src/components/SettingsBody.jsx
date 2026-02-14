import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ui } from "../i18n/ui";
import "../styles/SettingsBody.css";

export default function SettingsBody({ lang, supabaseUrl, supabaseKey, user: initialUser }) {
    // Initialize Supabase client locally with props (safe for client-side when passed from server)
    const [supabase] = useState(() => createClient(supabaseUrl, supabaseKey, {
        auth: { flowType: 'pkce' }
    }));
    const t = (key) => ui[lang]?.[key] || ui['en'][key];
    const [user, setUser] = useState(initialUser);
    const [loading, setLoading] = useState(!initialUser);
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        // If no initial user (shouldn't happen via normal nav, but maybe dev), fetch it
        if (!initialUser) {
            async function fetchUser() {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);
                setLoading(false);
            }
            fetchUser();
        }

        // 2. Initialize Theme
        const storedTheme = localStorage.getItem('submana-theme') || 'dark';
        setTheme(storedTheme);
        document.documentElement.setAttribute('data-theme', storedTheme);

        // 3. Initialize Language UI (if needed for client-side updates, though we passed 'lang' prop)
    }, []);

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('submana-theme', newTheme);
        document.cookie = `submana-theme=${newTheme}; path=/; max-age=${60 * 60 * 24 * 365}`;
    };

    const handleLangChange = (newLang) => {
        localStorage.setItem('submana-lang', newLang);
        document.cookie = `submana-lang=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}`;
        window.location.reload(); // Reload to apply language change via server/Astro
    };

    const handleSignOut = async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        // Clear cookies
        document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        window.location.href = "/login";
    };

    return (
        <div className="settings-container fade-in">
            {/* Logo SVG (embedded directly to avoid .astro import issues) */}
            <div className="settings-logo">
                <svg width="40" height="40" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="512" height="512" rx="120" fill="url(#paint0_linear)" />
                    <path d="M365.257 141.623C363.393 129.987 353.447 121.282 341.674 121.282H170.326C158.553 121.282 148.607 129.987 146.743 141.623L128 258.641H170.326L182.015 185.795H329.985L341.674 258.641H384L365.257 141.623Z" fill="white" />
                    <path d="M128 290.872H384V258.641H128V290.872Z" fill="white" fillOpacity="0.5" />
                    <path d="M128 323.103H384V301.615H128V323.103Z" fill="white" fillOpacity="0.3" />
                    <path d="M128 355.333H384V333.846H128V355.333Z" fill="white" fillOpacity="0.1" />
                    <defs>
                        <linearGradient id="paint0_linear" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#8B5CF6" />
                            <stop offset="1" stopColor="#3B82F6" />
                        </linearGradient>
                    </defs>
                </svg>
                <span className="logo-text">Submana</span>
            </div>

            <div className="user-profile">
                {loading ? (
                    <div className="skeleton-profile">
                        <div className="skeleton circle" style={{ width: '80px', height: '80px', margin: '0 auto 1rem' }}></div>
                        <div className="skeleton" style={{ width: '150px', height: '24px', margin: '0 auto 0.5rem' }}></div>
                        <div className="skeleton" style={{ width: '200px', height: '16px', margin: '0 auto' }}></div>
                    </div>
                ) : (
                    <>
                        {user?.user_metadata?.avatar_url ? (
                            <img className="avatar" src={user.user_metadata.avatar_url} alt="User avatar" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                        ) : (
                            <div className="avatar-fallback">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" /></svg>
                            </div>
                        )}
                        <h2>{user?.user_metadata?.name || 'User'}</h2>
                        <p className="email">{user?.email}</p>
                    </>
                )}
            </div>

            <div className="settings-section">
                <h3>{t('settings.preferences')}</h3>
                <div className="setting-item">
                    <span>{t('settings.theme')}</span>
                    <div className="theme-selector" data-active={theme}>
                        <div className="theme-slider"></div>
                        <button className="theme-btn" onClick={() => handleThemeChange('light')}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                            <span>{t('settings.theme.light')}</span>
                        </button>
                        <button className="theme-btn" onClick={() => handleThemeChange('dark')}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                            <span>{t('settings.theme.dark')}</span>
                        </button>
                    </div>
                </div>
                <div className="setting-item">
                    <span>{t('settings.language')}</span>
                    <div className="lang-selector" data-active={lang}>
                        <button className="lang-btn" onClick={() => handleLangChange('en')}>English</button>
                        <button className="lang-btn" onClick={() => handleLangChange('es')}>Español</button>
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3>{t('settings.actions')}</h3>
                <button className="signout-btn" onClick={handleSignOut}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                        <path d="M13 12v.01"></path>
                        <path d="M3 21h18"></path>
                        <path d="M5 21v-16a2 2 0 0 1 2 -2h7.5m2.5 10.5v7.5"></path>
                        <path d="M14 7h7m-3 -3l3 3l-3 3"></path>
                    </svg>
                    <span>{t('settings.signout')}</span>
                </button>
            </div>

            <div className="settings-section">
                <h3>{t('settings.account')}</h3>
                <div className="setting-item">
                    <span>{t('settings.name')}</span>
                    <span className="value">{loading ? '...' : (user?.user_metadata?.name || '-')}</span>
                </div>
                <div className="setting-item">
                    <span>{t('settings.email')}</span>
                    <span className="value">{loading ? '...' : (user?.email || '-')}</span>
                </div>
            </div>

        </div>
    );
}
