"use client";

import React, { useEffect } from "react";
import { NavigationRail } from "./NavigationRail";
import { PinUnlockModal } from "../auth/PinUnlockModal";
import { useAppStore, triggerGoToRoot, triggerDropChatToFolder } from "../../store/useAppStore";
import { getThemeByName, applyThemeToDocument, DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from "../../lib/themes";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        currentView,
        setCurrentView,
        activeTab,
        setActiveTab,
        folders,
        fetchFolders,
        fetchAppPreferences,
        appPreferences,
        draggedChatId,
        setFolderContextMenu,
        setIsCreatingFolder,
        isMobileNavOpen,
        setIsMobileNavOpen,
        pinSecurityEnabled,
        isAuthenticated,
        isAuthChecking,
        checkAuthStatus,
        logoutPin,
    } = useAppStore();

    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

    // Sync active theme mode (System, Light, Dark) and selected Light/Dark theme templates onto <html> element
    useEffect(() => {
        if (typeof window === "undefined") return;

        let mode = appPreferences.theme_mode;
        let lightThemeName = appPreferences.light_theme;
        let darkThemeName = appPreferences.dark_theme;

        try {
            if (!mode) {
                const storedMode = localStorage.getItem("walpaca_theme_mode") as "system" | "light" | "dark" | null;
                if (storedMode === "system" || storedMode === "light" || storedMode === "dark") {
                    mode = storedMode;
                }
            }
            if (!lightThemeName) {
                const storedLight = localStorage.getItem("walpaca_light_theme");
                if (storedLight) lightThemeName = storedLight;
            }
            if (!darkThemeName) {
                const storedDark = localStorage.getItem("walpaca_dark_theme");
                if (storedDark) darkThemeName = storedDark;
            }
        } catch {
            // ignore storage errors
        }

        const effectiveMode = mode || "system";
        const effectiveLightTheme = getThemeByName(lightThemeName, DEFAULT_LIGHT_THEME);
        const effectiveDarkTheme = getThemeByName(darkThemeName, DEFAULT_DARK_THEME);

        const mediaQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

        const applyTheme = () => {
            const isDarkSlot =
                effectiveMode === "dark" ||
                (effectiveMode === "system" && Boolean(mediaQuery?.matches));
            const activePalette = isDarkSlot ? effectiveDarkTheme : effectiveLightTheme;
            applyThemeToDocument(activePalette);
        };

        applyTheme();

        if (effectiveMode === "system" && mediaQuery) {
            const handleMediaChange = () => applyTheme();
            if (typeof mediaQuery.addEventListener === "function") {
                mediaQuery.addEventListener("change", handleMediaChange);
                return () => mediaQuery.removeEventListener("change", handleMediaChange);
            }
        }
    }, [appPreferences.theme_mode, appPreferences.light_theme, appPreferences.dark_theme]);

    // Sync visible viewport height on mobile browsers (Chrome for Android address bar & keyboard)
    useEffect(() => {
        if (typeof window === "undefined") return;

        const updateViewportHeight = () => {
            const vv = window.visualViewport;
            const height = vv ? vv.height : window.innerHeight;
            document.documentElement.style.setProperty("--app-height", `${height}px`);
            if (vv && vv.offsetTop > 0) {
                window.scrollTo(0, 0);
            }
        };

        updateViewportHeight();
        window.addEventListener("resize", updateViewportHeight);
        window.addEventListener("orientationchange", updateViewportHeight);
        window.visualViewport?.addEventListener("resize", updateViewportHeight);
        window.visualViewport?.addEventListener("scroll", updateViewportHeight);

        return () => {
            window.removeEventListener("resize", updateViewportHeight);
            window.removeEventListener("orientationchange", updateViewportHeight);
            window.visualViewport?.removeEventListener("resize", updateViewportHeight);
            window.visualViewport?.removeEventListener("scroll", updateViewportHeight);
        };
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            fetchFolders();
            fetchAppPreferences();
            if (typeof window !== "undefined") {
                sessionStorage.setItem("walpaca_active_tab_session", "1");
            }
        }
    }, [isAuthenticated, fetchFolders, fetchAppPreferences]);

    // Handle "browser_close" auto-lock session check
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (pinSecurityEnabled && appPreferences.pin_auto_lock_timeout === "browser_close") {
            const hasActiveTabSession = sessionStorage.getItem("walpaca_active_tab_session");
            if (!hasActiveTabSession && isAuthenticated) {
                logoutPin();
            }
        }
    }, [pinSecurityEnabled, appPreferences.pin_auto_lock_timeout, isAuthenticated, logoutPin]);

    // Global quick-lock shortcut (Ctrl+Alt+L / Cmd+Alt+L)
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "l" || e.key === "L" || e.code === "KeyL")) {
                e.preventDefault();
                if (pinSecurityEnabled && isAuthenticated) {
                    logoutPin();
                }
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => {
            window.removeEventListener("keydown", handleGlobalKeyDown);
        };
    }, [pinSecurityEnabled, isAuthenticated, logoutPin]);

    // Auto-lock inactivity timer
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!pinSecurityEnabled || !isAuthenticated) return;

        const timeoutPref = appPreferences.pin_auto_lock_timeout || "15m";
        if (timeoutPref === "never" || timeoutPref === "browser_close") return;

        let timeoutMs = 15 * 60 * 1000;
        if (timeoutPref === "5m") timeoutMs = 5 * 60 * 1000;
        else if (timeoutPref === "15m") timeoutMs = 15 * 60 * 1000;
        else if (timeoutPref === "30m") timeoutMs = 30 * 60 * 1000;
        else if (timeoutPref === "1h") timeoutMs = 60 * 60 * 1000;

        let idleTimer: NodeJS.Timeout;

        const resetTimer = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                logoutPin();
            }, timeoutMs);
        };

        resetTimer();

        const activityEvents = ["mousedown", "keydown", "touchstart", "scroll", "pointermove"];
        let lastActivity = Date.now();

        const handleActivity = () => {
            const now = Date.now();
            // Throttle activity listener to at most once every 10 seconds
            if (now - lastActivity > 10000) {
                lastActivity = now;
                resetTimer();
            }
        };

        activityEvents.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

        return () => {
            clearTimeout(idleTimer);
            activityEvents.forEach((ev) => window.removeEventListener(ev, handleActivity));
        };
    }, [pinSecurityEnabled, isAuthenticated, appPreferences.pin_auto_lock_timeout, logoutPin]);

    return (
        <main className="topo-bg h-[var(--app-height,100dvh)] max-h-[var(--app-height,100dvh)] w-full flex justify-center font-sans antialiased text-[#202022] box-border overflow-hidden">
            {/* Outer Application Window (Full bleed on mobile, floating framed window on desktop) */}
            <div className="w-full h-full md:my-auto bg-[#202022] flex overflow-hidden border-0 md:border-8 border-[#202022] shadow-2xl relative">
                {/* 1. SLIM LEFT NAVIGATION RAIL - Desktop/Tablet permanent column */}
                <div className="hidden md:flex h-full shrink-0">
                    <NavigationRail
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        currentView={currentView}
                        setCurrentView={setCurrentView}
                        folders={folders}
                        draggedChatId={draggedChatId}
                        handleGoToRoot={triggerGoToRoot}
                        handleDropChatToFolder={triggerDropChatToFolder}
                        setFolderContextMenu={setFolderContextMenu}
                        setIsCreatingFolder={setIsCreatingFolder}
                    />
                </div>

                {/* Mobile Navigation Drawer Modal (< md) */}
                {isMobileNavOpen && (
                    <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
                        {/* Dim Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
                            onClick={() => setIsMobileNavOpen(false)}
                        />
                        {/* Slide-in Rail */}
                        <div className="relative z-10 h-full shadow-2xl animate-in slide-in-from-left duration-200">
                            <NavigationRail
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                currentView={currentView}
                                setCurrentView={setCurrentView}
                                folders={folders}
                                draggedChatId={draggedChatId}
                                handleGoToRoot={triggerGoToRoot}
                                handleDropChatToFolder={triggerDropChatToFolder}
                                setFolderContextMenu={setFolderContextMenu}
                                setIsCreatingFolder={setIsCreatingFolder}
                            />
                        </div>
                    </div>
                )}

                {/* Main Viewport Content - shielded if PIN authentication is active and locked */}
                {isAuthChecking ? (
                    <div className="flex-1 flex items-center justify-center bg-[#18181b] text-white">
                        <div className="flex flex-col items-center gap-3">
                            <svg className="animate-spin h-8 w-8 text-[#7678ed]" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        </div>
                    </div>
                ) : pinSecurityEnabled && !isAuthenticated ? (
                    <PinUnlockModal />
                ) : (
                    children
                )}
            </div>
        </main>
    );
};
