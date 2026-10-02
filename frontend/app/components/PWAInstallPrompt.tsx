"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { CloseIcon, DownloadIcon } from "@/components/icons/Icons";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const inStandaloneMode =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);

        Promise.resolve().then(() => {
            if (!isMounted) return;
            setIsStandalone(inStandaloneMode);
            if (inStandaloneMode) return;
            setIsIOS(isIosDevice);
        });

        const dismissedUntil = localStorage.getItem("walpaca_pwa_dismissed_until");
        if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
            return;
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowPrompt(true);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        // If iOS Safari and not standalone, show iOS prompt after short delay
        let timer: NodeJS.Timeout | null = null;
        if (isIosDevice && !inStandaloneMode && !dismissedUntil) {
            timer = setTimeout(() => setShowPrompt(true), 3000);
        }

        return () => {
            isMounted = false;
            if (timer) clearTimeout(timer);
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        try {
            await deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            if (choiceResult.outcome === "accepted") {
                setShowPrompt(false);
            }
            setDeferredPrompt(null);
        } catch (err) {
            console.error("PWA install error:", err);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        // Suppress for 7 days
        localStorage.setItem("walpaca_pwa_dismissed_until", (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
    };

    if (!showPrompt || isStandalone) return null;

    return (
        <div className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full mx-4 sm:mx-0 p-4 rounded-3xl bg-white/95 dark:bg-[#181926]/95 backdrop-blur-xl border border-[#7678ed]/20 shadow-2xl shadow-[#7678ed]/15 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
            <div className="flex items-start gap-3.5">
                <div className="relative shrink-0 w-12 h-12 rounded-2xl bg-[#7678ed]/10 p-2 border border-[#7678ed]/30 flex items-center justify-center shadow-xs">
                    <Image src="/icon-app.svg" alt="Walpaca App Icon" width={36} height={36} className="w-full h-full object-contain filter drop-shadow-xs" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm text-[#181926] dark:text-white tracking-tight">Install Walpaca</h3>
                        <button
                            onClick={handleDismiss}
                            className="text-[#8e90a6] hover:text-[#181926] dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                            title="Dismiss"
                        >
                            <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <p className="text-xs text-[#6e7191] dark:text-[#a0a3bd] mt-1 leading-relaxed">
                        {isIOS
                            ? "Tap Share button below and select 'Add to Home Screen' for standalone access."
                            : "Install Walpaca as a desktop/mobile app for instant access and standalone windowing."}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                        {!isIOS && deferredPrompt && (
                            <button
                                onClick={handleInstallClick}
                                className="px-3.5 py-1.5 rounded-xl bg-[#7678ed] hover:bg-[#6365e6] text-white text-xs font-medium transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer flex items-center gap-1.5"
                            >
                                <DownloadIcon className="w-3.5 h-3.5" />
                                Install App
                            </button>
                        )}
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1.5 rounded-xl bg-[#f0f2f9] dark:bg-[#232538] hover:bg-[#e4e7f4] text-[#6e7191] dark:text-[#a0a3bd] text-xs font-medium transition-colors cursor-pointer"
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
