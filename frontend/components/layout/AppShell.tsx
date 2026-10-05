"use client";

import React, { useEffect } from "react";
import { NavigationRail } from "./NavigationRail";
import { useAppStore, triggerGoToRoot, triggerDropChatToFolder } from "../../store/useAppStore";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        currentView,
        setCurrentView,
        activeTab,
        setActiveTab,
        folders,
        fetchFolders,
        fetchAppPreferences,
        draggedChatId,
        setFolderContextMenu,
        setIsCreatingFolder,
        isMobileNavOpen,
        setIsMobileNavOpen,
    } = useAppStore();

    useEffect(() => {
        fetchFolders();
        fetchAppPreferences();
    }, [fetchFolders, fetchAppPreferences]);

    return (
        <main className="topo-bg h-dvh w-screen flex justify-center font-sans antialiased text-[#202022] box-border overflow-hidden">
            {/* Outer Application Window (Full bleed on mobile, floating framed window on desktop) */}
            <div className="w-full h-full md:w-[96vw] md:h-[calc(100dvh-24px)] md:my-auto md:rounded-3xl bg-[#202022] flex overflow-hidden border-0 md:border-8 border-[#202022] shadow-2xl relative">
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

                {children}
            </div>
        </main>
    );
};
