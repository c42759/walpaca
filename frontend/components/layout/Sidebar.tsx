import React from "react";
import { PlusIcon, SearchIcon, FolderIcon, SettingsIcon, ChatIcon, TrashIcon, EditIcon } from "../icons/Icons";
import { Button } from "../ui/Button";

export interface ChatFolder {
    id: string;
    name: string;
}

export interface ChatItem {
    id: string;
    name: string;
    avatarText?: string;
    avatarImg?: string;
    lastMessage: string;
    time: string;
    unreadCount?: number;
    isPinned?: boolean;
    isDelivered?: boolean;
    folder?: string;
}

export interface SidebarProps {
    currentView: "chat" | "settings";
    setCurrentView: (view: "chat" | "settings") => void;
    chats: ChatItem[];
    folders: ChatFolder[];
    activeChatId: string | null;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedFolderId: string | null;
    setSelectedFolderId: (id: string | null) => void;
    handleSelectChat: (id: string) => void;
    handleOpenNewChatModal: () => void;
    handleCreateFolder: () => void;
    handleOpenRenameFolderModal: (folder: ChatFolder) => void;
    handleDeleteFolder: (folderId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    currentView,
    setCurrentView,
    chats,
    folders,
    activeChatId,
    searchQuery,
    setSearchQuery,
    selectedFolderId,
    setSelectedFolderId,
    handleSelectChat,
    handleOpenNewChatModal,
    handleCreateFolder,
    handleOpenRenameFolderModal,
    handleDeleteFolder,
}) => {
    const filteredChats = chats.filter((chat) => {
        if (selectedFolderId && chat.folder !== selectedFolderId) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            return chat.name.toLowerCase().includes(q) || chat.lastMessage.toLowerCase().includes(q);
        }
        return true;
    });

    return (
        <aside className="w-[280px] bg-[#1a1b1e] text-white p-4 flex flex-col justify-between shrink-0 select-none">
            <div className="space-y-4 overflow-hidden flex flex-col flex-1">
                {/* Brand Header */}
                <div className="flex items-center justify-between px-2 pt-1">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#eaecf9] flex items-center justify-center p-1.5 shadow-sm">
                            <img src="/icon-app.svg" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="font-bold text-lg text-white tracking-tight">Walpaca</h1>
                    </div>
                    <button
                        onClick={handleOpenNewChatModal}
                        className="p-2 rounded-xl bg-[#7678ed] hover:bg-[#6869d9] text-white transition-all shadow-md shadow-[#7678ed]/30 cursor-pointer"
                        title="New Chat"
                    >
                        <PlusIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="relative px-1">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search chats..."
                        className="w-full bg-[#26272b] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-[#7678ed] transition-all"
                    />
                    <SearchIcon className="absolute left-3.5 top-2.5 text-white/40 w-3.5 h-3.5" />
                </div>

                {/* Folders List */}
                <div className="px-1 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/40 uppercase tracking-wider px-2 py-1">
                        <span>Folders</span>
                        <button onClick={handleCreateFolder} className="hover:text-white transition-colors cursor-pointer" title="New Folder">
                            + Add
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        <button
                            onClick={() => setSelectedFolderId(null)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                selectedFolderId === null ? "bg-[#7678ed] text-white" : "bg-[#26272b] text-white/60 hover:text-white hover:bg-white/10"
                            }`}
                        >
                            All Chats
                        </button>
                        {folders.map((folder) => {
                            const isSelected = selectedFolderId === folder.id;
                            return (
                                <div
                                    key={folder.id}
                                    className={`group relative flex items-center rounded-lg text-xs font-semibold transition-all ${
                                        isSelected ? "bg-[#7678ed] text-white" : "bg-[#26272b] text-white/60 hover:text-white hover:bg-white/10"
                                    }`}
                                >
                                    <button onClick={() => setSelectedFolderId(folder.id)} className="px-2.5 py-1 text-left truncate cursor-pointer">
                                        {folder.name}
                                    </button>
                                    <div className="hidden group-hover:flex items-center gap-1 pr-1.5">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenRenameFolderModal(folder);
                                            }}
                                            className="hover:text-white text-white/60"
                                            title="Rename Folder"
                                        >
                                            <EditIcon className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteFolder(folder.id);
                                            }}
                                            className="hover:text-rose-400 text-white/60"
                                            title="Delete Folder"
                                        >
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Chats List */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider px-3 py-1">Conversations ({filteredChats.length})</div>
                    {filteredChats.length === 0 ? (
                        <div className="p-6 text-center text-white/40 text-xs italic">No chats found.</div>
                    ) : (
                        filteredChats.map((chat) => {
                            const isActive = currentView === "chat" && activeChatId === chat.id;
                            return (
                                <button
                                    key={chat.id}
                                    onClick={() => {
                                        setCurrentView("chat");
                                        handleSelectChat(chat.id);
                                    }}
                                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                                        isActive ? "bg-[#2e2f33] text-white shadow-sm border border-white/10" : "text-white/70 hover:text-white hover:bg-white/5"
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="w-8 h-8 rounded-lg bg-[#26272b] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold text-[#7678ed]">
                                            {chat.avatarImg ? <img src={chat.avatarImg} alt={chat.name} className="w-full h-full object-cover" /> : chat.avatarText || "💬"}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-xs truncate leading-tight text-white">{chat.name}</p>
                                            <p className="text-[10px] text-white/40 truncate mt-0.5">{chat.lastMessage || "No messages yet"}</p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Bottom Settings Link */}
            <button
                onClick={() => setCurrentView("settings")}
                className={`w-full py-2.5 px-3 mt-3 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer font-semibold text-xs ${
                    currentView === "settings" ? "bg-[#7678ed] text-white shadow-md shadow-[#7678ed]/30" : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
            >
                <SettingsIcon className="w-4 h-4" />
                <span>Settings</span>
            </button>
        </aside>
    );
};
