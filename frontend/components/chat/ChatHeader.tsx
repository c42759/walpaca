"use client";

import React, { useState } from "react";

export interface ChatHeaderProps {
    title: string;
    subtitle?: string;
    onOpenRename: () => void;
    onOpenDuplicate: () => void;
    onOpenExport: () => void;
    onOpenDelete: () => void;
    onSearchClick?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ title, subtitle = "Active chat session", onOpenRename, onOpenDuplicate, onOpenExport, onOpenDelete, onSearchClick }) => {
    const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

    return (
        <div className="h-[76px] px-8 border-b border-[#eef0f6] flex items-center justify-between shrink-0">
            <div>
                <h2 className="text-2xl font-bold text-[#202022] tracking-tight">{title}</h2>
                <p className="text-base text-[#8e90a6] font-medium mt-0.5">{subtitle}</p>
            </div>

            {/* Action Icons */}
            <div className="flex items-center gap-4 text-[#8e90a6] relative">
                <button onClick={onSearchClick} className="p-2 hover:text-[#202022] hover:bg-[#f4f6fc] rounded-full transition-colors cursor-pointer" title="Search in chat">
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
