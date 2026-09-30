"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

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
    // Check if already in standalone mode
    const inStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || 
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(inStandaloneMode);

    if (inStandaloneMode) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

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
    if (isIosDevice && !inStandaloneMode && !dismissedUntil) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
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
          <Image
            src="/icon-app.svg"
            alt="Walpaca App Icon"
            width={36}
            height={36}
            className="w-full h-full object-contain filter drop-shadow-xs"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm text-[#181926] dark:text-white tracking-tight">
              Install Walpaca
            </h3>
            <button
              onClick={handleDismiss}
              className="text-[#8e90a6] hover:text-[#181926] dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <p className="text-xs text-[#6e7191] dark:text-[#a0a3bd] mt-1 leading-relaxed">
            {isIOS 
              ? "Tap Share button below and select 'Add to Home Screen' for standalone access."
              : "Install Walpaca as a desktop/mobile app for instant access and standalone windowing."
            }
          </p>

          <div className="mt-3 flex items-center gap-2">
            {!isIOS && deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="px-3.5 py-1.5 rounded-xl bg-[#7678ed] hover:bg-[#6365e6] text-white text-xs font-medium transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
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
