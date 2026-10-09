"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PromptIcon, SearchIcon, CloseIcon, PlusIcon } from "../icons/Icons";
import { CustomPrompt } from "../settings/ManagePromptsPanel";

export interface CustomPromptsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPrompt: (content: string) => void;
    getApiUrl: () => string;
}

export const CustomPromptsModal: React.FC<CustomPromptsModalProps> = ({
    isOpen,
    onClose,
    onSelectPrompt,
    getApiUrl,
}) => {
    const router = useRouter();
    const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchPrompts = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${getApiUrl()}/prompts`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setPrompts(Array.isArray(data) ? data : []);
                    }
                }
            } catch (err) {
                console.warn("Could not fetch prompts:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchPrompts();
        setSearchQuery("");

        // Auto-focus search input
        const timer = setTimeout(() => {
            searchInputRef.current?.focus();
        }, 100);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [isOpen, getApiUrl]);

    // Keyboard ESC listener
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const filtered = prompts.filter((p) => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        const titleMatch = (p.title || "").toLowerCase().includes(q);
        const contentMatch = (p.content || "").toLowerCase().includes(q);
        return titleMatch || contentMatch;
    });

    const handleSelect = (content: string) => {
        onSelectPrompt(content);
        onClose();
    };

    const handleManagePrompts = () => {
        onClose();
        router.push("/settings/prompts");
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 select-none"
            onClick={onClose}
        >
            <div
                className="bg-white text-[#202022] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-[calc(100vw-24px)] sm:w-full max-w-xl sm:max-w-2xl max-h-[88dvh] flex flex-col shadow-2xl border border-[#e8ebf3] animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#eef0f6] shrink-0 mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center shrink-0">
                            <PromptIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-[#202022] tracking-tight">Custom Prompts</h3>
                            <p className="text-xs text-[#8e90a6] mt-0.5">Select a prompt template to insert into your chat message</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-[#8e90a6] hover:text-[#202022] hover:bg-[#f4f6fc] rounded-full transition-colors cursor-pointer"
                        title="Close"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-3 shrink-0">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search prompts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#f4f6fc] border border-[#eef0f6] rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm text-[#202022] placeholder-[#8e90a6] outline-none focus:border-[#7678ed] focus:bg-white transition-all font-medium"
                    />
                    <SearchIcon className="w-4 h-4 text-[#8e90a6] absolute left-3 top-3" />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-2.5 text-[#8e90a6] hover:text-[#202022] p-0.5 rounded-full cursor-pointer"
                        >
                            <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Prompt List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[220px]">
                    {isLoading ? (
                        <div className="p-10 text-center text-[#8e90a6] text-xs sm:text-sm font-medium animate-pulse">
                            Loading custom prompts...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-[#8e90a6] space-y-3">
                            <p className="text-xs sm:text-sm font-medium">
                                {searchQuery ? "No matching custom prompts found." : "No custom prompts available."}
                            </p>
                            <button
                                type="button"
                                onClick={handleManagePrompts}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#eaecf9] hover:bg-[#dfe3f8] text-[#7678ed] rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span>Manage Prompts in Settings</span>
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {filtered.map((prompt) => (
                                <button
                                    key={prompt.filename}
                                    type="button"
                                    onClick={() => handleSelect(prompt.content)}
                                    className="p-3.5 rounded-2xl text-left border border-[#eef0f6] bg-[#f9fafc] hover:bg-[#eaecf9]/40 hover:border-[#7678ed]/40 transition-all cursor-pointer flex flex-col justify-between group shadow-2xs"
                                >
                                    <div className="space-y-1.5 w-full">
                                        <div className="flex items-start justify-between gap-1.5">
                                            <span className="font-bold text-xs sm:text-sm text-[#202022] group-hover:text-[#7678ed] transition-colors truncate">
                                                {prompt.title}
                                            </span>
                                            <span className="text-[10px] font-semibold text-[#7678ed] bg-[#7678ed]/10 px-1.5 py-0.5 rounded-md shrink-0">
                                                {prompt.content ? `${prompt.content.length} chars` : "empty"}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[#5d6075] line-clamp-3 leading-relaxed font-mono select-none bg-white/70 p-2 rounded-xl border border-[#eef0f6]/60">
                                            {prompt.content || <span className="italic text-[#a0a3b5]">Empty content</span>}
                                        </p>
                                    </div>
                                    <div className="mt-2.5 pt-2 border-t border-[#eef0f6] flex items-center justify-end">
                                        <span className="text-[10px] font-bold text-[#7678ed] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                            Insert Prompt →
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="pt-3.5 mt-3 border-t border-[#eef0f6] flex items-center justify-between shrink-0">
                    <span className="text-xs text-[#8e90a6] font-medium">
                        {filtered.length} {filtered.length === 1 ? "prompt" : "prompts"}
                    </span>
                    <button
                        type="button"
                        onClick={handleManagePrompts}
                        className="text-xs font-bold text-[#7678ed] hover:text-[#6869d9] hover:underline transition-colors cursor-pointer flex items-center gap-1"
                    >
                        <span>Manage Prompts</span>
                        <span>→</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
