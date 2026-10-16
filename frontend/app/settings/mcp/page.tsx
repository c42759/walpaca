"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { ManageMcpPanel, McpServerItem } from "@/components/settings/ManageMcpPanel";

export default function McpSettingsPage() {
    const { setCurrentView } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-mcp");

    const [servers, setServers] = useState<McpServerItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const fetchServers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${getApiUrl()}/mcp/servers`);
            if (res.ok) {
                const data = await res.json();
                setServers(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.warn("Could not fetch MCP servers:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchServers();
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
                    <ManageMcpPanel
                        servers={servers}
                        isLoading={isLoading}
                        getApiUrl={getApiUrl}
                        fetchServers={fetchServers}
                    />
                </div>
            </main>

            {/* 3. RIGHT SIDEBAR - HELP & TIPS */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
