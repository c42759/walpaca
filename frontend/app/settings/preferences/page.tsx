"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl, apiFetch } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";

interface PreferencesData {
    auto_play_voice: boolean;
    desktop_notifications: boolean;
    play_sound_notification?: boolean;
    auto_scroll: boolean;
    default_audio_output: string;
    pin_security_enabled?: boolean;
    pin_auto_lock_timeout?: string;
    processing_poll_interval?: number;
}


interface AudioDeviceOption {
    deviceId: string;
    label: string;
}

export default function PreferencesSettingsPage() {
    const {
        setCurrentView,
        appPreferences,
        fetchAppPreferences,
        setAppPreferences,
        pinSecurityEnabled,
        setupPin,
        disablePin,
        logoutPin,
    } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("preferences");

    const [preferences, setPreferences] = useState<PreferencesData>(appPreferences);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<string>("");
    const [audioDevices, setAudioDevices] = useState<AudioDeviceOption[]>([]);

    // PIN Security UI state
    const [isConfiguringPin, setIsConfiguringPin] = useState<boolean>(false);
    const [isChangingPin, setIsChangingPin] = useState<boolean>(false);
    const [isDisablingPin, setIsDisablingPin] = useState<boolean>(false);

    const [pinInput, setPinInput] = useState<string>("");
    const [repeatPinInput, setRepeatPinInput] = useState<string>("");
    const [currentPinInput, setCurrentPinInput] = useState<string>("");
    const [showPinText, setShowPinText] = useState<boolean>(false);
    const [pinError, setPinError] = useState<string>("");
    const [pinActionLoading, setPinActionLoading] = useState<boolean>(false);

    // Load preferences from API & store
    useEffect(() => {
        let isMounted = true;
        (async () => {
            setIsLoading(true);
            try {
                const data = await fetchAppPreferences(true);
                if (isMounted && data) {
                    setPreferences(data);
                }
            } catch (err) {
                console.warn("Could not load preferences:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [fetchAppPreferences]);

    // Enumerate audio output devices
    useEffect(() => {
        let isMounted = true;

        const updateAudioOutputs = async () => {
            if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
                return;
            }
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const outputs = devices
                    .filter((d) => d.kind === "audiooutput")
                    .map((d, index) => ({
                        deviceId: d.deviceId,
                        label: d.label || (d.deviceId === "default" ? "System Default Speaker" : `Audio Device ${index + 1}`),
                    }));

                if (isMounted) {
                    setAudioDevices(outputs);
                }
            } catch (err) {
                console.warn("Could not enumerate audio output devices:", err);
            }
        };

        updateAudioOutputs();

        if (typeof navigator !== "undefined" && navigator.mediaDevices?.addEventListener) {
            navigator.mediaDevices.addEventListener("devicechange", updateAudioOutputs);
            return () => {
                isMounted = false;
                navigator.mediaDevices.removeEventListener("devicechange", updateAudioOutputs);
            };
        }

        return () => {
            isMounted = false;
        };
    }, []);

    const handleUpdatePreference = async (key: keyof PreferencesData, value: boolean | string | number) => {
        if (key === "desktop_notifications" && value === true && typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "default") {
                Notification.requestPermission();
            }
        }

        const updated = { ...preferences, [key]: value };
        setPreferences(updated);
        setAppPreferences({ [key]: value });
        setSaveStatus("Saving...");

        try {
            const res = await apiFetch(`${getApiUrl()}/preferences`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [key]: value }),
            });
            if (res.ok) {
                const saved = await res.json();
                setAppPreferences(saved);
                setSaveStatus("Preferences saved");
                setTimeout(() => setSaveStatus(""), 2000);
            } else {
                setSaveStatus("Error saving preferences");
            }
        } catch (err) {
            console.error("Error saving preference:", err);
            setSaveStatus("Error saving preferences");
        }
    };

    const handleSaveNewPin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setPinError("");

        if (!pinInput || pinInput.length < 4) {
            setPinError("PIN must be at least 4 digits/characters");
            return;
        }
        if (pinInput !== repeatPinInput) {
            setPinError("PINs do not match");
            return;
        }

        setPinActionLoading(true);
        try {
            const res = await setupPin(pinInput);
            if (res.success) {
                setIsConfiguringPin(false);
                setPinInput("");
                setRepeatPinInput("");
                setSaveStatus("PIN Security Enabled");
                setTimeout(() => setSaveStatus(""), 3000);
            } else {
                setPinError(res.error || "Failed to set PIN");
            }
        } catch {
            setPinError("Network error while setting PIN");
        } finally {
            setPinActionLoading(false);
        }
    };

    const handleChangePin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setPinError("");

        if (!currentPinInput) {
            setPinError("Please enter your current PIN");
            return;
        }
        if (!pinInput || pinInput.length < 4) {
            setPinError("New PIN must be at least 4 digits/characters");
            return;
        }
        if (pinInput !== repeatPinInput) {
            setPinError("New PINs do not match");
            return;
        }

        setPinActionLoading(true);
        try {
            const res = await setupPin(pinInput, currentPinInput);
            if (res.success) {
                setIsChangingPin(false);
                setCurrentPinInput("");
                setPinInput("");
                setRepeatPinInput("");
                setSaveStatus("PIN Updated Successfully");
                setTimeout(() => setSaveStatus(""), 3000);
            } else {
                setPinError(res.error || "Failed to change PIN");
            }
        } catch {
            setPinError("Network error while changing PIN");
        } finally {
            setPinActionLoading(false);
        }
    };

    const handleDisablePin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setPinError("");

        if (!currentPinInput) {
            setPinError("Please enter your current PIN to disable security");
            return;
        }

        setPinActionLoading(true);
        try {
            const res = await disablePin(currentPinInput);
            if (res.success) {
                setIsDisablingPin(false);
                setCurrentPinInput("");
                setSaveStatus("PIN Security Disabled");
                setTimeout(() => setSaveStatus(""), 3000);
            } else {
                setPinError(res.error || "Incorrect current PIN");
            }
        } catch {
            setPinError("Network error while disabling PIN");
        } finally {
            setPinActionLoading(false);
        }
    };

    const handleTogglePinSecurity = (enabled: boolean) => {
        setPinError("");
        if (enabled) {
            setIsConfiguringPin(true);
            setIsChangingPin(false);
            setIsDisablingPin(false);
            setPinInput("");
            setRepeatPinInput("");
        } else {
            setIsDisablingPin(true);
            setIsConfiguringPin(false);
            setIsChangingPin(false);
            setCurrentPinInput("");
        }
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white rounded-none md:rounded-l-[32px] w-full h-full select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar activeSettingsCategory={activeSettingsCategory} setActiveSettingsCategory={setActiveSettingsCategory} setCurrentView={setCurrentView} />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
                <div className="mx-auto space-y-8">
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex items-center justify-between gap-3.5">
                            <div className="flex items-center gap-3.5">
                                <div>
                                    <div>
                                        <h3 className="text-xl font-bold text-[#202022] tracking-tight">Preferences</h3>
                                        <p className="text-sm text-[#7a7d90] mt-1 font-medium">Configure playback options, user interface defaults, security, and system notifications.</p>
                                    </div>
                                </div>
                            </div>

                            {saveStatus && (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#eaecf9] text-[#7678ed] border border-[#7678ed]/20 animate-in fade-in duration-150">
                                    {saveStatus}
                                </span>
                            )}
                        </div>

                        {/* SECURITY & PIN PROTECTION SECTION */}
                        <div className="space-y-4 bg-white border border-[#e8ebf3] rounded-2xl p-6 shadow-xs">
                            <div className="flex items-center justify-between pb-4 border-b border-[#e8ebf3]">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-base font-bold text-[#202022]">Enable PIN Security</h4>
                                        {pinSecurityEnabled && (
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[#8e90a6]">Require a security PIN upon opening Walpaca in browser before accessing chats.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    disabled={isLoading || pinActionLoading}
                                    checked={pinSecurityEnabled}
                                    onChange={(e) => handleTogglePinSecurity(e.target.checked)}
                                    className="w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer disabled:opacity-50"
                                />
                            </div>

                            {/* Active PIN Management Controls */}
                            {pinSecurityEnabled && !isChangingPin && !isDisablingPin && (
                                <>
                                    <div className="flex flex-wrap items-center gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsChangingPin(true);
                                                setIsDisablingPin(false);
                                                setPinError("");
                                                setCurrentPinInput("");
                                                setPinInput("");
                                                setRepeatPinInput("");
                                            }}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-[#202022] bg-[#f4f5fa] hover:bg-[#eaeef9] border border-[#e8ebf3] transition-all cursor-pointer"
                                        >
                                            Change PIN
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsDisablingPin(true);
                                                setIsChangingPin(false);
                                                setPinError("");
                                                setCurrentPinInput("");
                                            }}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-[#e11d48] bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
                                        >
                                            Disable PIN
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => logoutPin()}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7678ed] hover:bg-[#686ae0] transition-all cursor-pointer ml-auto flex items-center gap-1.5 shadow-xs"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                            Lock App Now
                                        </button>
                                    </div>

                                    <div className="pt-3 border-t border-[#e8ebf3] space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h5 className="text-sm font-bold text-[#202022]">Auto-Lock Inactivity Timeout</h5>
                                                <p className="text-xs text-[#8e90a6] mt-0.5">Automatically lock Walpaca after a period of user inactivity.</p>
                                            </div>
                                            <span className="text-[11px] font-medium text-[#7678ed] hidden sm:inline bg-[#eaecf9] px-2.5 py-1 rounded-lg border border-[#7678ed]/20">
                                                Shortcut: Ctrl+Alt+L
                                            </span>
                                        </div>
                                        <select
                                            disabled={isLoading || pinActionLoading}
                                            value={preferences.pin_auto_lock_timeout || "15m"}
                                            onChange={(e) => handleUpdatePreference("pin_auto_lock_timeout", e.target.value)}
                                            className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm text-[#202022] font-semibold outline-none focus:border-[#7678ed] transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            <option value="5m">5 Minutes</option>
                                            <option value="15m">15 Minutes (Recommended)</option>
                                            <option value="30m">30 Minutes</option>
                                            <option value="1h">1 Hour</option>
                                            <option value="browser_close">On Browser Close Only</option>
                                            <option value="never">Never (Manual Lock Only)</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* Set Initial PIN Form */}
                            {isConfiguringPin && !pinSecurityEnabled && (
                                <form onSubmit={handleSaveNewPin} className="p-4 bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl space-y-4 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-sm font-bold text-[#202022]">Set Security PIN</h5>
                                        <button
                                            type="button"
                                            onClick={() => setShowPinText(!showPinText)}
                                            className="text-xs font-semibold text-[#7678ed] hover:underline cursor-pointer"
                                        >
                                            {showPinText ? "Hide PIN" : "Show PIN"}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-[#7a7d90] mb-1">New PIN (min 4 digits)</label>
                                            <input
                                                type={showPinText ? "text" : "password"}
                                                value={pinInput}
                                                onChange={(e) => setPinInput(e.target.value)}
                                                placeholder="Enter PIN..."
                                                autoComplete="off"
                                                className="w-full bg-white border border-[#e8ebf3] focus:border-[#7678ed] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#202022] outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-[#7a7d90] mb-1">Repeat PIN</label>
                                            <input
                                                type={showPinText ? "text" : "password"}
                                                value={repeatPinInput}
                                                onChange={(e) => setRepeatPinInput(e.target.value)}
                                                placeholder="Confirm PIN..."
                                                autoComplete="off"
                                                className="w-full bg-white border border-[#e8ebf3] focus:border-[#7678ed] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#202022] outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {pinError && (
                                        <p className="text-xs font-semibold text-rose-500 animate-in fade-in duration-150">{pinError}</p>
                                    )}

                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsConfiguringPin(false)}
                                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#7a7d90] hover:bg-[#eaecf9] transition-all cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={pinActionLoading}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7678ed] hover:bg-[#686ae0] transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {pinActionLoading ? "Saving..." : "Enable PIN Security"}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Change PIN Form */}
                            {isChangingPin && pinSecurityEnabled && (
                                <form onSubmit={handleChangePin} className="p-4 bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl space-y-4 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-sm font-bold text-[#202022]">Change Security PIN</h5>
                                        <button
                                            type="button"
                                            onClick={() => setShowPinText(!showPinText)}
                                            className="text-xs font-semibold text-[#7678ed] hover:underline cursor-pointer"
                                        >
                                            {showPinText ? "Hide PIN" : "Show PIN"}
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-[#7a7d90] mb-1">Current PIN</label>
                                        <input
                                            type={showPinText ? "text" : "password"}
                                            value={currentPinInput}
                                            onChange={(e) => setCurrentPinInput(e.target.value)}
                                            placeholder="Enter your current PIN..."
                                            autoComplete="off"
                                            className="w-full bg-white border border-[#e8ebf3] focus:border-[#7678ed] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#202022] outline-none transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-[#7a7d90] mb-1">New PIN</label>
                                            <input
                                                type={showPinText ? "text" : "password"}
                                                value={pinInput}
                                                onChange={(e) => setPinInput(e.target.value)}
                                                placeholder="Enter new PIN..."
                                                autoComplete="off"
                                                className="w-full bg-white border border-[#e8ebf3] focus:border-[#7678ed] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#202022] outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-[#7a7d90] mb-1">Repeat New PIN</label>
                                            <input
                                                type={showPinText ? "text" : "password"}
                                                value={repeatPinInput}
                                                onChange={(e) => setRepeatPinInput(e.target.value)}
                                                placeholder="Confirm new PIN..."
                                                autoComplete="off"
                                                className="w-full bg-white border border-[#e8ebf3] focus:border-[#7678ed] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#202022] outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {pinError && (
                                        <p className="text-xs font-semibold text-rose-500 animate-in fade-in duration-150">{pinError}</p>
                                    )}

                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsChangingPin(false)}
                                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#7a7d90] hover:bg-[#eaecf9] transition-all cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={pinActionLoading}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7678ed] hover:bg-[#686ae0] transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {pinActionLoading ? "Updating..." : "Update PIN"}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Disable PIN Form */}
                            {isDisablingPin && pinSecurityEnabled && (
                                <form onSubmit={handleDisablePin} className="p-4 bg-rose-50/50 border border-rose-200 rounded-2xl space-y-4 animate-in fade-in duration-200">
                                    <div>
                                        <h5 className="text-sm font-bold text-[#202022]">Disable PIN Security</h5>
                                        <p className="text-xs text-[#7a7d90] mt-0.5">Please confirm your current PIN to turn off security protection.</p>
                                    </div>

                                    <div>
                                        <input
                                            type="password"
                                            value={currentPinInput}
                                            onChange={(e) => setCurrentPinInput(e.target.value)}
                                            placeholder="Enter current PIN..."
                                            autoComplete="off"
                                            className="w-full bg-white border border-[#e8ebf3] focus:border-rose-400 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#202022] outline-none transition-all"
                                        />
                                    </div>

                                    {pinError && (
                                        <p className="text-xs font-semibold text-rose-500 animate-in fade-in duration-150">{pinError}</p>
                                    )}

                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsDisablingPin(false)}
                                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#7a7d90] hover:bg-[#eaecf9] transition-all cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={pinActionLoading}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {pinActionLoading ? "Disabling..." : "Confirm & Disable PIN"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* GENERAL AUDIO & PLAYBACK PREFERENCES */}
                        <div className="space-y-4 bg-white border border-[#e8ebf3] rounded-2xl p-6 shadow-xs">
                            <div className="flex items-center justify-between pb-4 border-b border-[#e8ebf3]">
                                <div>
                                    <h4 className="text-base font-bold text-[#202022]">Auto-play Assistant Voice</h4>
                                    <p className="text-xs text-[#8e90a6] mt-0.5">Automatically start TTS voice playback when assistant finishes generating response.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    disabled={isLoading}
                                    checked={preferences.auto_play_voice}
                                    onChange={(e) => handleUpdatePreference("auto_play_voice", e.target.checked)}
                                    className="w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer disabled:opacity-50"
                                />
                            </div>

                            <div className="flex items-center justify-between pb-4 border-b border-[#e8ebf3]">
                                <div>
                                    <h4 className="text-base font-bold text-[#202022]">Desktop Notifications</h4>
                                    <p className="text-xs text-[#8e90a6] mt-0.5">Send desktop alert when background LLM generation completes.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    disabled={isLoading}
                                    checked={preferences.desktop_notifications}
                                    onChange={(e) => handleUpdatePreference("desktop_notifications", e.target.checked)}
                                    className="w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer disabled:opacity-50"
                                />
                            </div>

                            <div className="flex items-center justify-between pb-4 border-b border-[#e8ebf3]">
                                <div>
                                    <h4 className="text-base font-bold text-[#202022]">Play Sound Notification</h4>
                                    <p className="text-xs text-[#8e90a6] mt-0.5">Play an audio chime when assistant finishes delivering response.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    disabled={isLoading}
                                    checked={preferences.play_sound_notification !== false}
                                    onChange={(e) => handleUpdatePreference("play_sound_notification", e.target.checked)}
                                    className="w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer disabled:opacity-50"
                                />
                            </div>

                            <div className="flex items-center justify-between pb-4 border-b border-[#e8ebf3]">
                                <div>
                                    <h4 className="text-base font-bold text-[#202022]">Auto-scroll during generation</h4>
                                    <p className="text-xs text-[#8e90a6] mt-0.5">Keep chat window scrolled to the latest incoming message tokens.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    disabled={isLoading}
                                    checked={preferences.auto_scroll}
                                    onChange={(e) => handleUpdatePreference("auto_scroll", e.target.checked)}
                                    className="w-5 h-5 rounded-md text-[#7678ed] focus:ring-[#7678ed] accent-[#7678ed] cursor-pointer disabled:opacity-50"
                                />
                            </div>

                            <div className="flex items-center justify-between pb-4 border-b border-[#e8ebf3]">
                                <div>
                                    <h4 className="text-base font-bold text-[#202022]">Processing Refresh Interval</h4>
                                    <p className="text-xs text-[#8e90a6] mt-0.5">Polling interval in seconds to refresh incomplete assistant responses when background generation is active.</p>
                                </div>
                                <select
                                    disabled={isLoading}
                                    value={preferences.processing_poll_interval !== undefined ? Number(preferences.processing_poll_interval) : 2}
                                    onChange={(e) => handleUpdatePreference("processing_poll_interval", Number(e.target.value))}
                                    className="bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3.5 py-2 text-sm text-[#202022] font-semibold outline-none focus:border-[#7678ed] transition-all cursor-pointer disabled:opacity-50"
                                >
                                    <option value={1}>1 Second (Fast)</option>
                                    <option value={2}>2 Seconds (Default)</option>
                                    <option value={3}>3 Seconds</option>
                                    <option value={5}>5 Seconds</option>
                                    <option value={10}>10 Seconds</option>
                                </select>
                            </div>


                            <div className="pt-2 space-y-2">
                                <h4 className="text-base font-bold text-[#202022]">Default Audio Output Device</h4>
                                <select
                                    disabled={isLoading}
                                    value={preferences.default_audio_output || "default"}
                                    onChange={(e) => handleUpdatePreference("default_audio_output", e.target.value)}
                                    className="w-full bg-[#f9fafc] border border-[#e8ebf3] rounded-2xl px-4 py-3 text-sm text-[#202022] font-semibold outline-none focus:border-[#7678ed] transition-all cursor-pointer disabled:opacity-50"
                                >
                                    <option value="default">System Default Speaker</option>
                                    {audioDevices
                                        .filter((d) => d.deviceId !== "default")
                                        .map((d) => (
                                             <option key={d.deviceId} value={d.deviceId}>
                                                {d.label}
                                            </option>
                                        ))}
                                    {preferences.default_audio_output &&
                                        preferences.default_audio_output !== "default" &&
                                        !audioDevices.some((d) => d.deviceId === preferences.default_audio_output) && (
                                            <option value={preferences.default_audio_output}>
                                                {preferences.default_audio_output === "headphones"
                                                    ? "Headphones / Headset (Saved)"
                                                    : `Saved Device (${preferences.default_audio_output.slice(0, 10)}...) [Disconnected]`}
                                            </option>
                                        )}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* 3. RIGHT SIDEBAR - HELP & TIPS */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
