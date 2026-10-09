"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

export const PinUnlockModal: React.FC = () => {
    const { verifyPin, authLockoutSeconds } = useAppStore();
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [lockoutTimer, setLockoutTimer] = useState(authLockoutSeconds);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLockoutTimer(authLockoutSeconds);
    }, [authLockoutSeconds]);

    useEffect(() => {
        if (lockoutTimer <= 0) return;
        const interval = setInterval(() => {
            setLockoutTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [lockoutTimer]);

    useEffect(() => {
        // Auto-focus on mount
        inputRef.current?.focus();
    }, []);

    const handleUnlock = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!pin.trim() || lockoutTimer > 0 || isLoading) return;

        setIsLoading(true);
        setErrorMsg("");

        try {
            const res = await verifyPin(pin.trim());
            if (!res.success) {
                setErrorMsg(res.error || "Incorrect PIN");
                if (res.lockout && res.remaining_seconds) {
                    setLockoutTimer(res.remaining_seconds);
                }
                setPin("");
                inputRef.current?.focus();
            }
        } catch {
            setErrorMsg("Error communicating with authentication server");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121214]/95 backdrop-blur-xl animate-in fade-in duration-300 select-none">
            {/* Ambient background glow */}
            <div className="absolute w-96 h-96 bg-[#7678ed]/20 rounded-full blur-3xl pointer-events-none -top-10 -left-10 animate-pulse" />
            <div className="absolute w-96 h-96 bg-[#6366f1]/15 rounded-full blur-3xl pointer-events-none -bottom-10 -right-10" />

            <div className="relative w-full max-w-md bg-[#202022] border border-[#34343a] rounded-3xl p-8 shadow-2xl text-white space-y-6 animate-in zoom-in-95 duration-200">
                {/* Header Icon */}
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7678ed] to-[#9394f8] flex items-center justify-center shadow-lg shadow-[#7678ed]/25">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-white">Walpaca Locked</h2>
                        <p className="text-sm text-[#9e9ea7] mt-1">Enter your security PIN to access the application</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleUnlock} className="space-y-4">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type={showPin ? "text" : "password"}
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value);
                                if (errorMsg) setErrorMsg("");
                            }}
                            disabled={isLoading || lockoutTimer > 0}
                            placeholder="Enter PIN..."
                            autoComplete="off"
                            className="w-full bg-[#18181b] border border-[#3f3f46] focus:border-[#7678ed] focus:ring-2 focus:ring-[#7678ed]/30 rounded-2xl px-5 py-4 text-center text-xl font-bold tracking-widest text-white outline-none transition-all placeholder:text-xs placeholder:tracking-normal placeholder:text-[#71717a] disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {pin.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowPin(!showPin)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-[#71717a] hover:text-white transition-colors cursor-pointer"
                                tabIndex={-1}
                            >
                                {showPin ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Error / Lockout Message */}
                    {errorMsg && (
                        <div className="p-3 bg-[#ef4444]/15 border border-[#ef4444]/30 rounded-xl text-center text-xs font-semibold text-[#f87171] animate-in fade-in duration-150">
                            {errorMsg}
                        </div>
                    )}

                    {lockoutTimer > 0 && (
                        <div className="p-3 bg-[#f59e0b]/15 border border-[#f59e0b]/30 rounded-xl text-center text-xs font-semibold text-[#fbbf24] animate-in fade-in duration-150">
                            Too many failed attempts. Try again in {lockoutTimer}s.
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !pin.trim() || lockoutTimer > 0}
                        className="w-full py-4 rounded-2xl bg-[#7678ed] hover:bg-[#686ae0] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-[#7678ed]/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                <span>Verifying...</span>
                            </>
                        ) : (
                            <span>Unlock Application</span>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
