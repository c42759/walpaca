"use client";

import React, { useEffect } from "react";
import { NavigationRail } from "./NavigationRail";
import { useAppStore, triggerGoToRoot, triggerDropChatToFolder } from "../../store/useAppStore";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentView, setCurrentView, activeTab, setActiveTab, folders, fetchFolders, fetchAppPreferences, draggedChatId, setFolderContextMenu, setIsCreatingFolder } =
        useAppStore();

    useEffect(() => {
        fetchFolders();
        fetchAppPreferences();
    }, [fetchFolders, fetchAppPreferences]);

    return (
        <main className="topo-bg min-h-screen w-screen flex justify-center font-sans antialiased text-[#202022] box-border">
            {/* Outer Floating Application Window */}
            <div className="w-full min-w-[90vw] h-[calc(100vh-0px)] md:h-[calc(100vh-0px)] lg:h-100vh-0px)] bg-[#202022] flex overflow-hidden border-8 border-[#202022]">
                {/* 1. SLIM LEFT NAVIGATION RAIL (#202022) */}
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
                {children}
            </div>
        </main>
    );
};
