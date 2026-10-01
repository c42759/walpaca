'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface ChatFolder {
	id: string;
	name: string;
	color?: string;
	parent?: string | null;
}

export interface NavigationRailProps {
	activeTab: string;
	setActiveTab: (tab: string) => void;
	currentView: 'chat' | 'settings';
	setCurrentView: (view: 'chat' | 'settings') => void;
	folders: ChatFolder[];
	draggedChatId?: string | null;
	handleGoToRoot: () => void;
	handleDropChatToFolder: (chatId: string, folderId: string) => void;
	setFolderContextMenu: (menu: {
		x: number;
		y: number;
		folderId: string;
		folderName: string;
	} | null) => void;
	setIsCreatingFolder: (isCreating: boolean) => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
	activeTab,
	setActiveTab,
	currentView,
	setCurrentView,
	folders,
	draggedChatId,
	handleGoToRoot,
	handleDropChatToFolder,
	setFolderContextMenu,
	setIsCreatingFolder,
}) => {
	const router = useRouter();
	const pathname = usePathname();
	const isSettings = pathname.startsWith('/settings') || currentView === 'settings';
	const [dragOverFolderTarget, setDragOverFolderTarget] = useState<string | null>(null);

	const handleNavigateChatTab = (tab: string) => {
		setActiveTab(tab);
		setCurrentView('chat');
		if (pathname.startsWith('/settings')) {
			router.push('/');
		}
	};

	const handleNavigateSettings = () => {
		setCurrentView('settings');
		router.push('/settings/import');
	};

	const handleLogoClick = () => {
		handleGoToRoot();
		if (pathname.startsWith('/settings')) {
			router.push('/');
		}
	};

	return (
        <aside className="w-[100px] bg-[#202022] flex flex-col items-center justify-between py-6 px-2 select-none shrink-0 border-r border-[#202022]">
            {/* Top Alpaca Prism Logo */}
            <div className="flex flex-col items-center gap-8 w-full">
                <div onClick={handleLogoClick} className="w-12 h-12 flex items-center justify-center text-white cursor-pointer hover:opacity-85 transition-opacity">
                    <img src="/icon-white.svg" alt="Walpaca" className="w-9 h-9 object-contain" />
                </div>

                {/* Navigation Tabs (Backend Folders API Integrated) */}
                <nav className="flex flex-col items-center gap-3 w-full overflow-y-auto max-h-[calc(100vh-220px)] px-1">
                    {/* No Folder tab */}
                    <button
                        onClick={() => handleNavigateChatTab("none")}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDragOverFolderTarget("none");
                        }}
                        onDragLeave={() => {
                            if (dragOverFolderTarget === "none") setDragOverFolderTarget(null);
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            const droppedId = e.dataTransfer.getData("text/plain") || draggedChatId;
                            if (droppedId) handleDropChatToFolder(droppedId, "none");
                        }}
                        className={`w-full py-3 px-1 rounded-2xl flex flex-col items-center gap-1.5 transition-all relative cursor-pointer ${
                            dragOverFolderTarget === "none"
                                ? "bg-[#7678ed]/30 border-2 border-[#7678ed] text-white scale-105 shadow-lg"
                                : (activeTab === "none" || activeTab === "all") && !isSettings
                                  ? "bg-[#2e2f33] text-white shadow-inner"
                                  : "text-[#8b8d97] hover:text-white"
                        }`}
                        title="No Folder"
                    >
                        <div className="relative">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                        </div>
                        <span className="text-xs font-medium tracking-tight text-center truncate w-full px-1">No Folder</span>
                    </button>

                    {/* Dynamic Folders from /api/folders */}
                    {folders.map((folder) => {
                        const isActive = activeTab === folder.id && !isSettings;
                        const isDragOver = dragOverFolderTarget === folder.id;
                        return (
                            <button
                                key={folder.id}
                                onClick={() => handleNavigateChatTab(folder.id)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setFolderContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        folderId: folder.id,
                                        folderName: folder.name,
                                    });
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                    setDragOverFolderTarget(folder.id);
                                }}
                                onDragLeave={() => {
                                    if (dragOverFolderTarget === folder.id) setDragOverFolderTarget(null);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const droppedId = e.dataTransfer.getData("text/plain") || draggedChatId;
                                    if (droppedId) handleDropChatToFolder(droppedId, folder.id);
                                }}
                                className={`w-full py-3 px-1 rounded-2xl flex flex-col items-center gap-1.5 transition-all relative cursor-pointer group ${
                                    isDragOver
                                        ? "bg-[#7678ed]/30 border-2 border-[#7678ed] text-white scale-105 shadow-lg"
                                        : isActive
                                          ? "bg-[#2e2f33] text-white shadow-inner"
                                          : "text-[#8b8d97] hover:text-white"
                                }`}
                                title={`${folder.name} (Right-click for options)`}
                            >
                                <div className="relative">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    </svg>
                                </div>
                                <span className="text-sm font-medium tracking-tight truncate w-full text-center px-1">{folder.name}</span>
                            </button>
                        );
                    })}

                    {/* Add Folder Button */}
                    <button
                        onClick={() => setIsCreatingFolder(true)}
                        className="w-full py-2.5 px-1 rounded-2xl flex flex-col items-center gap-1 text-[#7678ed] hover:bg-[#2d2d30] hover:text-white transition-all border border-dashed border-[#7678ed]/40 mt-1 cursor-pointer"
                        title="Create New Folder"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="6" y1="12" x2="18" y2="12" />
                        </svg>
                        <span className="text-xs font-medium tracking-tight">+ Folder</span>
                    </button>
                </nav>
            </div>

            {/* Bottom Settings */}
            <button
                onClick={handleNavigateSettings}
                className={`w-full py-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    isSettings ? "bg-[#2e2f33] text-white shadow-inner" : "text-[#8b8d97] hover:text-white"
                }`}
                title="Settings"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-sm font-medium tracking-tight">Settings</span>
            </button>
        </aside>
    );
};
