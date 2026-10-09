"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { ManagePromptsPanel, CustomPrompt } from "@/components/settings/ManagePromptsPanel";

export default function PromptsSettingsPage() {
    const { setCurrentView } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-prompts");

    const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const fetchPrompts = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${getApiUrl()}/prompts`);
            if (res.ok) {
                const data = await res.json();
                setPrompts(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.warn("Could not fetch custom prompts:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPrompts();
    }, []);

    return (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white rounded-none md:rounded-l-[32px] w-full h-full select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar
                activeSettingsCategory={activeSettingsCategory}
                setActiveSettingsCategory={setActiveSettingsCategory}
                setCurrentView={setCurrentView}
            />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
                <div className="mx-auto space-y-8">
                    <ManagePromptsPanel
                        prompts={prompts}
                        isLoading={isLoading}
                        getApiUrl={getApiUrl}
                        fetchPrompts={fetchPrompts}
                    />
                </div>
            </main>

            {/* 3. RIGHT SIDEBAR - HELP & TIPS */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
