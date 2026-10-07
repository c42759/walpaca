"use client";

import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { ArrowLeftIcon, ServerIcon } from "../icons/Icons";

export interface ChatHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    onOpenRename: () => void;
    onOpenDuplicate: () => void;
    onOpenExport: () => void;
    onOpenDelete: () => void;
    onSearchClick?: () => void;
    avatar?: string;
    onAvatarClick?: () => void;
    isSearchOpen?: boolean;
    searchQuery?: string;
    onSearchQueryChange?: (query: string) => void;
    matchCount?: number;
    activeMatchIndex?: number;
    onNextMatch?: () => void;
    onPrevMatch?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    title,
    subtitle = "Active chat session",
    onBack,
    onOpenRename,
    onOpenDuplicate,
    onOpenExport,
    onOpenDelete,
    onSearchClick,
    avatar,
    onAvatarClick,
    isSearchOpen = false,
    searchQuery = "",
    onSearchQueryChange,
    matchCount = 0,
    activeMatchIndex = 0,
    onNextMatch,
    onPrevMatch,
}) => {
    const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
    const { isRightDrawerOpen, setIsRightDrawerOpen } = useAppStore();
    const searchInputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        if (isSearchOpen) {
            searchInputRef.current?.focus();
        }
    }, [isSearchOpen]);

    return (
        <div className="h-16 sm:h-[76px] px-3 sm:px-6 md:px-8 border-b border-[#eef0f6] flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1 mr-2">
                {/* Mobile Back to Chat List Button (< md) */}
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="p-2 md:hidden text-[#202022] hover:bg-[#f4f6fc] rounded-xl transition-all cursor-pointer shrink-0"
                        title="Back to chat list"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                )}

                {avatar && (
                    <button
                        type="button"
                        onClick={onAvatarClick}
                        className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-[#eef0f6] hover:ring-2 hover:ring-[#7678ed]/50 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                        title="View persona details"
                    >
                        <img src={avatar} alt={title} className="w-full h-full object-cover" />
                    </button>
                )}
                <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-xl md:text-2xl font-bold text-[#202022] tracking-tight truncate">{title}</h2>
                    <p className="text-xs sm:text-sm md:text-base text-[#8e90a6] font-medium mt-0.5 truncate hidden sm:block">{subtitle}</p>
                </div>
            </div>

            {/* Action Icons */}
            <div className="flex items-center gap-1.5 sm:gap-3 text-[#8e90a6] relative shrink-0">
                {/* Context Drawer Toggle for Mobile / Tablet (< lg) */}
                <button
                    type="button"
                    onClick={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer lg:hidden ${
                        isRightDrawerOpen ? "text-[#7678ed] bg-[#7678ed]/10" : "hover:text-[#202022] hover:bg-[#f4f6fc]"
                    }`}
                    title="Toggle context details"
                >
                    <ServerIcon className="w-5 h-5" />
                </button>

                {/* Collapsible Slide-Left Search Box */}
                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out flex items-center ${
                        isSearchOpen
                            ? "max-w-[280px] sm:max-w-xs md:max-w-sm opacity-100 mr-1 sm:mr-2"
                            : "max-w-0 opacity-0 pointer-events-none"
                    }`}
                >
                    <div className="flex items-center bg-[#f4f6fc] border border-[#e2e5f1] focus-within:border-[#7678ed] focus-within:ring-2 focus-within:ring-[#7678ed]/20 rounded-xl px-2.5 py-1 text-sm gap-1.5 shadow-xs w-[240px] sm:w-[280px]">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange?.(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (e.shiftKey) onPrevMatch?.();
                                    else onNextMatch?.();
                                } else if (e.key === "Escape") {
                                    onSearchClick?.();
                                }
                            }}
                            placeholder="Search in chat..."
                            className="w-full bg-transparent border-none outline-none text-[#202022] placeholder-[#8e90a6] text-xs sm:text-sm font-medium"
                        />

                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => onSearchQueryChange?.("")}
                                className="text-[#8e90a6] hover:text-[#202022] p-0.5 rounded cursor-pointer transition-colors"
                                title="Clear search"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}

                        {searchQuery ? (
                            <span className="text-[11px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md bg-white border border-[#e2e5f1] text-[#5d6075] shrink-0 select-none">
                                {matchCount > 0 ? `${activeMatchIndex + 1}/${matchCount}` : "0/0"}
                            </span>
                        ) : null}

                        <div className="flex items-center gap-0.5 border-l border-[#e2e5f1] pl-1 shrink-0">
                            <button
                                type="button"
                                onClick={onPrevMatch}
                                disabled={matchCount === 0}
                                className="p-1 text-[#8e90a6] hover:text-[#202022] disabled:opacity-30 disabled:hover:text-[#8e90a6] rounded hover:bg-white/60 transition-colors cursor-pointer"
                                title="Previous match (Shift+Enter)"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="18 15 12 9 6 15" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={onNextMatch}
                                disabled={matchCount === 0}
                                className="p-1 text-[#8e90a6] hover:text-[#202022] disabled:opacity-30 disabled:hover:text-[#8e90a6] rounded hover:bg-white/60 transition-colors cursor-pointer"
                                title="Next match (Enter)"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onSearchClick}
                    className={`p-2 rounded-full transition-colors cursor-pointer ${
                        isSearchOpen ? "text-[#7678ed] bg-[#7678ed]/10" : "hover:text-[#202022] hover:bg-[#f4f6fc]"
                    }`}
                    title={isSearchOpen ? "Close search" : "Search in chat"}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </button>

                {/* 3 Dots Context Menu */}
                <div className="relative">
                    <button
                        onClick={() => setIsContextMenuOpen(!isContextMenuOpen)}
                        className="p-2 hover:text-[#202022] hover:bg-[#f4f6fc] rounded-full transition-colors cursor-pointer"
                        title="Chat options"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="19" r="1" />
                        </svg>
                    </button>

                    {isContextMenuOpen && (
                        <>
                            {/* Backdrop */}
                            <div className="fixed inset-0 z-30" onClick={() => setIsContextMenuOpen(false)} />
                            {/* Dropdown Menu */}
                            <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-[#e8ebf3] py-2 z-40 select-none animate-in fade-in duration-150">
                                <button
                                    onClick={() => {
                                        setIsContextMenuOpen(false);
                                        onOpenRename();
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-base font-semibold text-[#202022] hover:bg-[#f4f6fc] transition-colors flex items-center gap-2.5 cursor-pointer"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                    </svg>
                                    Rename
                                </button>
                                <button
                                    onClick={() => {
                                        setIsContextMenuOpen(false);
                                        onOpenDuplicate();
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-base font-semibold text-[#202022] hover:bg-[#f4f6fc] transition-colors flex items-center gap-2.5 cursor-pointer"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    Duplicate
                                </button>
                                <button
                                    onClick={() => {
                                        setIsContextMenuOpen(false);
                                        onOpenExport();
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-base font-semibold text-[#202022] hover:bg-[#f4f6fc] transition-colors flex items-center gap-2.5 cursor-pointer"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Export Chat
                                </button>
                                <button
                                    onClick={() => {
                                        setIsContextMenuOpen(false);
                                        onOpenDelete();
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-base font-semibold text-[#ff4d4f] hover:bg-[#fff1f0] transition-colors flex items-center gap-2.5 cursor-pointer"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                    Delete
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
