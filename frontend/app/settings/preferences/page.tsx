"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";

interface PreferencesData {
    auto_play_voice: boolean;
    desktop_notifications: boolean;
    play_sound_notification?: boolean;
    auto_scroll: boolean;
    default_audio_output: string;
}

interface AudioDeviceOption {
    deviceId: string;
    label: string;
}

export default function PreferencesSettingsPage() {
    const { setCurrentView, appPreferences, fetchAppPreferences, setAppPreferences } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("preferences");

    const [preferences, setPreferences] = useState<PreferencesData>(appPreferences);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<string>("");
    const [audioDevices, setAudioDevices] = useState<AudioDeviceOption[]>([]);

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

    const handleUpdatePreference = async (key: keyof PreferencesData, value: boolean | string) => {
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
            const res = await fetch(`${getApiUrl()}/preferences`, {
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

    return (
        <div className="flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar activeSettingsCategory={activeSettingsCategory} setActiveSettingsCategory={setActiveSettingsCategory} setCurrentView={setCurrentView} />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex items-center justify-between gap-3.5">
                            <div className="flex items-center gap-3.5">
                                <div>
                                    <div>
                                        <h3 className="text-xl font-bold text-[#202022] tracking-tight">Preferences</h3>
                                        <p className="text-sm text-[#7a7d90] mt-1 font-medium">Configure playback options, user interface defaults, and system notifications..</p>
                                    </div>
                                </div>
                            </div>

                            {saveStatus && (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#eaecf9] text-[#7678ed] border border-[#7678ed]/20 animate-in fade-in duration-150">
                                    {saveStatus}
                                </span>
                            )}
                        </div>

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
